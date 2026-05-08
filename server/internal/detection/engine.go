// Package detection provides the rule-based detection engine for analyzing events.
package detection

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	"go.uber.org/zap"

	"github.com/sentinel-io/sentinel/server/internal/broker"
	pb "github.com/sentinel-io/sentinel/server/proto/sentinelpb"
	"gopkg.in/yaml.v3"
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
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Severity    string      `json:"severity"`
	Enabled     bool        `json:"enabled"`
	EventTypes  []int32     `json:"event_types"`  // Which event types to evaluate (4=LOG, 1=PROCESS, etc.)
	Conditions  []Condition `json:"conditions"`
	Tags        []string    `json:"tags,omitempty"`  // MITRE ATT&CK tags, etc.
	Source      string      `json:"source"`          // "sigma" = predefined, "custom" = user-created
	CreatedAt   string      `json:"created_at"`
	UpdatedAt   string      `json:"updated_at"`
}

// Condition defines a single match condition within a rule.
// Field can be: "message", "program", "hostname", "log_type", "raw_data", or any key in event.Fields.
type Condition struct {
	Field    string `json:"field"`    // field name to check
	Operator string `json:"operator"` // "contains", "equals", "regex", "not_contains", "starts_with"
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
	broker   *broker.Broker
	log      *zap.SugaredLogger
	ctx      context.Context
	cancel   context.CancelFunc
	rulesDir       string
	customRulesDir string

	mu    sync.RWMutex
	rules []Rule
}

// New creates a new DetectionEngine.
// rulesDir is the path to the directory containing Sigma YAML rule files.
func New(msgBroker *broker.Broker, log *zap.SugaredLogger, rulesDir, customRulesDir string) *Engine {
	ctx, cancel := context.WithCancel(context.Background())
	e := &Engine{
		broker:         msgBroker,
		log:            log,
		ctx:            ctx,
		cancel:         cancel,
		rulesDir:       rulesDir,
		customRulesDir: customRulesDir,
	}

	// Create custom rules directory if it doesn't exist
	if customRulesDir != "" {
		if err := os.MkdirAll(customRulesDir, 0755); err != nil {
			log.Warnw("Failed to create custom rules directory", "dir", customRulesDir, "error", err)
		}
	}

	// Load predefined Sigma rules
	if rulesDir != "" {
		rules, err := LoadRulesFromDir(rulesDir, "sigma")
		if err != nil {
			log.Warnw("Failed to load rules from directory", "dir", rulesDir, "error", err)
		} else {
			e.rules = append(e.rules, rules...)
			log.Infow("Loaded Sigma rules from YAML", "count", len(rules), "dir", rulesDir)
		}
	}

	// Load custom rules
	if customRulesDir != "" && customRulesDir != rulesDir {
		rules, err := LoadRulesFromDir(customRulesDir, "custom")
		if err != nil {
			log.Warnw("Failed to load custom rules from directory", "dir", customRulesDir, "error", err)
		} else {
			e.rules = append(e.rules, rules...)
			log.Infow("Loaded custom rules from YAML", "count", len(rules), "dir", customRulesDir)
		}
	}

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
	if r.Source == "" {
		r.Source = "custom"
	}
	r.UpdatedAt = now
	e.rules = append(e.rules, r)
	
	// Persist to disk
	go e.saveRuleToDisk(r)
}

// ImportRulesYAML parses YAML bytes and adds all parsed rules to the engine.
// Returns the count of successfully imported rules.
func (e *Engine) ImportRulesYAML(data []byte) (int, error) {
	rules, err := ParseRulesYAML(data, "custom")
	if err != nil {
		return 0, err
	}

	// Save rules to disk if rulesDir is set
	if e.rulesDir != "" {
		// Split multi-document YAML and save each separately
		// This preserves original formatting better than re-marshaling
		docs := strings.Split(string(data), "---")
		for _, doc := range docs {
			doc = strings.TrimSpace(doc)
			if doc == "" {
				continue
			}
			// Get the title for the filename
			var meta struct {
				Title string `yaml:"title"`
			}
			// We use a simple unmarshal here just to get the title
			if err := yaml.Unmarshal([]byte(doc), &meta); err == nil && meta.Title != "" {
				filename := Slugify(meta.Title) + ".yml"
				// Custom rules always go to customRulesDir
				targetDir := e.customRulesDir
				if targetDir == "" {
					targetDir = e.rulesDir
				}
				filePath := filepath.Join(targetDir, filename)
				if err := os.WriteFile(filePath, []byte(doc), 0644); err != nil {
					e.log.Warnw("Failed to save rule to disk", "file", filePath, "error", err)
				} else {
					e.log.Infow("Saved imported rule to disk", "file", filename)
				}
			}
		}
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now().UTC().Format(time.RFC3339)
	count := 0
	for _, r := range rules {
		if r.ID == "" {
			r.ID = "rule-" + uuid.New().String()[:8]
		}
		if r.CreatedAt == "" {
			r.CreatedAt = now
		}
		r.UpdatedAt = now
		r.Source = "custom"
		e.rules = append(e.rules, r)
		count++
	}
	return count, nil
}

// UpdateRule replaces a rule by ID. Returns false if not found.
func (e *Engine) UpdateRule(id string, updated Rule) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	for i, r := range e.rules {
		if r.ID == id {
			updated.ID = id
			updated.CreatedAt = r.CreatedAt
			updated.Source = r.Source
			updated.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			
			// If name changed, delete the old file
			if updated.Name != r.Name {
				go e.deleteRuleFromDisk(r)
			}
			
			e.rules[i] = updated
			
			// Persist to disk
			go e.saveRuleToDisk(updated)
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
			// Remove from disk first
			go e.deleteRuleFromDisk(r)
			
			e.rules = append(e.rules[:i], e.rules[i+1:]...)
			return true
		}
	}
	return false
}

// saveRuleToDisk persists a custom rule to the rules directory as a Sigma YAML file.
func (e *Engine) saveRuleToDisk(r Rule) {
	// Predefined rules are not saved back to disk by the engine
	if r.Source == "sigma" {
		return
	}

	targetDir := e.customRulesDir
	if targetDir == "" {
		targetDir = e.rulesDir
	}
	if targetDir == "" {
		return
	}

	selections := make(map[string]interface{})
	for _, cond := range r.Conditions {
		key := cond.Field
		switch cond.Operator {
		case "equals":
			key += "|equals"
		case "starts_with":
			key += "|startswith"
		case "ends_with":
			key += "|endswith"
		case "regex":
			key += "|re"
		case "contains":
			key += "|contains"
		}
		selections[key] = cond.Value
	}

	yamlData := map[string]interface{}{
		"title":       r.Name,
		"id":          r.ID,
		"description": r.Description,
		"level":       r.Severity,
		"enabled":     r.Enabled,
		"tags":        r.Tags,
		"logsource": map[string]string{
			"product": "linux",
		},
		"detection": map[string]interface{}{
			"selection": selections,
			"condition": "selection",
		},
		"event_types": r.EventTypes,
		"date":        time.Now().Format("2006/01/02"),
	}

	data, err := yaml.Marshal(yamlData)
	if err != nil {
		e.log.Warnw("Failed to marshal rule to YAML", "rule", r.ID, "error", err)
		return
	}

	filename := Slugify(r.Name) + ".yml"
	filePath := filepath.Join(targetDir, filename)
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		e.log.Warnw("Failed to save rule to disk", "file", filePath, "error", err)
	} else {
		e.log.Infow("Persisted custom rule to disk", "file", filename)
	}
}

// deleteRuleFromDisk removes the YAML file for a rule if it exists.
func (e *Engine) deleteRuleFromDisk(r Rule) {
	if r.Source == "sigma" {
		return
	}
	targetDir := e.customRulesDir
	if targetDir == "" {
		targetDir = e.rulesDir
	}
	if targetDir == "" {
		return
	}
	filename := Slugify(r.Name) + ".yml"
	filePath := filepath.Join(targetDir, filename)
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		e.log.Warnw("Failed to delete rule file from disk", "file", filePath, "error", err)
	}
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
	case "ends_with":
		return strings.HasSuffix(strings.ToLower(fieldValue), strings.ToLower(cond.Value))
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
