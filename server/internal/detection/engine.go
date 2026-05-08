// Package detection provides the rule-based detection engine for analyzing events.
package detection

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	"go.uber.org/zap"

	"github.com/sentinel-io/sentinel/server/internal/broker"
	pb "github.com/sentinel-io/sentinel/server/proto/sentinelpb"
)

// Severity levels for alerts.
const (
	SevInfo     = "info"
	SevLow      = "low"
	SevMedium   = "medium"
	SevHigh     = "high"
	SevCritical = "critical"
)

// Rule represents a detection rule that evaluates incoming events.
type Rule struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Severity    string   `json:"severity"`
	Enabled     bool     `json:"enabled"`
	EventTypes  []int32  `json:"event_types"` // Which event types to evaluate (4=LOG, 1=PROCESS, etc.)
	Conditions  []Condition `json:"conditions"`
	Tags        []string `json:"tags,omitempty"` // MITRE ATT&CK tags, etc.
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
}

// Condition defines a single match condition within a rule.
// Field can be: "message", "program", "hostname", "log_type", "raw_data", or any key in event.Fields.
type Condition struct {
	Field    string `json:"field"`    // field name to check
	Operator string `json:"operator"` // "contains", "equals", "regex", "not_contains"
	Value    string `json:"value"`    // value to match against
}

// Alert represents a generated security alert.
type Alert struct {
	ID          string            `json:"id"`
	RuleID      string            `json:"rule_id"`
	RuleName    string            `json:"rule_name"`
	Severity    string            `json:"severity"`
	Description string            `json:"description"`
	Status      string            `json:"status"` // "open", "acknowledged", "resolved"
	Timestamp   time.Time         `json:"timestamp"`
	AgentID     string            `json:"agent_id"`
	EventID     string            `json:"event_id,omitempty"`
	Fields      map[string]string `json:"fields,omitempty"`
	RawData     string            `json:"raw_data,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
}

// Engine processes events and generates alerts based on rules.
type Engine struct {
	broker *broker.Broker
	log    *zap.SugaredLogger
	ctx    context.Context
	cancel context.CancelFunc

	mu    sync.RWMutex
	rules []Rule
}

// New creates a new DetectionEngine.
func New(msgBroker *broker.Broker, log *zap.SugaredLogger) *Engine {
	ctx, cancel := context.WithCancel(context.Background())
	e := &Engine{
		broker: msgBroker,
		log:    log,
		ctx:    ctx,
		cancel: cancel,
	}
	e.rules = DefaultRules()
	return e
}

// GetRules returns a copy of all loaded rules.
func (e *Engine) GetRules() []Rule {
	e.mu.RLock()
	defer e.mu.RUnlock()
	out := make([]Rule, len(e.rules))
	copy(out, e.rules)
	return out
}

// AddRule adds a new rule to the engine.
func (e *Engine) AddRule(r Rule) {
	e.mu.Lock()
	defer e.mu.Unlock()
	now := time.Now().UTC().Format(time.RFC3339)
	if r.ID == "" {
		r.ID = "rule-" + uuid.New().String()[:8]
	}
	if r.CreatedAt == "" {
		r.CreatedAt = now
	}
	r.UpdatedAt = now
	e.rules = append(e.rules, r)
}

// UpdateRule replaces a rule by ID. Returns false if not found.
func (e *Engine) UpdateRule(id string, updated Rule) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	for i, r := range e.rules {
		if r.ID == id {
			updated.ID = id
			updated.CreatedAt = r.CreatedAt
			updated.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			e.rules[i] = updated
			return true
		}
	}
	return false
}

// DeleteRule removes a rule by ID. Returns false if not found.
func (e *Engine) DeleteRule(id string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	for i, r := range e.rules {
		if r.ID == id {
			e.rules = append(e.rules[:i], e.rules[i+1:]...)
			return true
		}
	}
	return false
}

// Start begins processing events from NATS.
func (e *Engine) Start() error {
	e.log.Infow("Starting Detection Engine", "rules_loaded", len(e.rules))

	js := e.broker.JS()

	// Create a durable consumer on the EVENTS stream
	sub, err := js.PullSubscribe("events.>", "detection-engine", nats.BindStream("EVENTS"))
	if err != nil {
		// If binding fails, try to create it
		sub, err = js.PullSubscribe("events.>", "detection-engine")
		if err != nil {
			return fmt.Errorf("subscribe to events: %w", err)
		}
	}

	go e.processLoop(sub)
	return nil
}

func (e *Engine) processLoop(sub *nats.Subscription) {
	for {
		select {
		case <-e.ctx.Done():
			e.log.Info("Detection Engine stopped")
			return
		default:
			msgs, err := sub.Fetch(10, nats.MaxWait(1*time.Second))
			if err != nil {
				if err == nats.ErrTimeout {
					continue
				}
				e.log.Errorw("Error fetching events", "error", err)
				time.Sleep(1 * time.Second)
				continue
			}

			for _, msg := range msgs {
				var event pb.Event
				if err := json.Unmarshal(msg.Data, &event); err != nil {
					e.log.Errorw("Failed to unmarshal event", "error", err)
					msg.Ack()
					continue
				}

				e.evaluate(&event)
				msg.Ack()
			}
		}
	}
}

// evaluate runs all enabled rules against the event.
func (e *Engine) evaluate(event *pb.Event) {
	e.mu.RLock()
	rules := make([]Rule, len(e.rules))
	copy(rules, e.rules)
	e.mu.RUnlock()

	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}

		// Check if this rule applies to this event type
		if len(rule.EventTypes) > 0 {
			found := false
			for _, et := range rule.EventTypes {
				if et == int32(event.Type) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Evaluate all conditions (AND logic)
		if e.matchAllConditions(event, rule.Conditions) {
			e.generateAlert(event, rule)
		}
	}
}

// matchAllConditions returns true if ALL conditions match the event.
func (e *Engine) matchAllConditions(event *pb.Event, conditions []Condition) bool {
	for _, cond := range conditions {
		if !e.matchCondition(event, cond) {
			return false
		}
	}
	return true
}

// matchCondition evaluates a single condition against the event.
func (e *Engine) matchCondition(event *pb.Event, cond Condition) bool {
	fieldValue := e.getFieldValue(event, cond.Field)

	switch cond.Operator {
	case "contains":
		return strings.Contains(strings.ToLower(fieldValue), strings.ToLower(cond.Value))
	case "equals":
		return strings.EqualFold(fieldValue, cond.Value)
	case "not_contains":
		return !strings.Contains(strings.ToLower(fieldValue), strings.ToLower(cond.Value))
	case "regex":
		re, err := regexp.Compile(cond.Value)
		if err != nil {
			e.log.Warnw("Invalid regex in rule condition", "regex", cond.Value, "error", err)
			return false
		}
		return re.MatchString(fieldValue)
	case "starts_with":
		return strings.HasPrefix(strings.ToLower(fieldValue), strings.ToLower(cond.Value))
	default:
		return false
	}
}

// getFieldValue extracts the value of a field from the event.
func (e *Engine) getFieldValue(event *pb.Event, field string) string {
	switch field {
	case "raw_data":
		return string(event.RawData)
	case "agent_id":
		return event.AgentId
	case "event_id":
		return event.Id
	default:
		if event.Fields != nil {
			if v, ok := event.Fields[field]; ok {
				return v
			}
		}
		return ""
	}
}

func (e *Engine) generateAlert(event *pb.Event, rule Rule) {
	// Build a human-readable description with context
	desc := rule.Description
	if msg, ok := event.Fields["message"]; ok && msg != "" {
		desc = fmt.Sprintf("%s — %s", rule.Description, truncate(msg, 200))
	}

	alert := Alert{
		ID:          uuid.New().String(),
		RuleID:      rule.ID,
		RuleName:    rule.Name,
		Severity:    rule.Severity,
		Description: desc,
		Status:      "open",
		Timestamp:   time.Now(),
		AgentID:     event.AgentId,
		EventID:     event.Id,
		Fields:      event.Fields,
		RawData:     string(event.RawData),
		Tags:        rule.Tags,
	}

	payload, err := json.Marshal(alert)
	if err != nil {
		e.log.Errorw("Failed to marshal alert", "error", err)
		return
	}

	if _, err := e.broker.JS().Publish("alerts.generated", payload); err != nil {
		e.log.Errorw("Failed to publish alert", "error", err)
		return
	}

	e.log.Infow("Alert generated",
		"rule_id", rule.ID,
		"rule_name", rule.Name,
		"agent_id", alert.AgentID,
		"severity", rule.Severity,
	)
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "…"
}

// Stop gracefully shuts down the engine.
func (e *Engine) Stop() {
	e.cancel()
}
