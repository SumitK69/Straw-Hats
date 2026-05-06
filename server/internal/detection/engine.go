// Package detection provides the basic rule engine for analyzing events.
package detection

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	"go.uber.org/zap"

	"github.com/sentinel-io/sentinel/server/internal/broker"
	pb "github.com/sentinel-io/sentinel/server/proto/sentinelpb"
)

// Alert represents a generated security alert.
type Alert struct {
	ID          string    `json:"id"`
	RuleID      string    `json:"rule_id"`
	Severity    string    `json:"severity"` // low, medium, high, critical
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
	AgentID     string    `json:"agent_id"`
	Event       *pb.Event `json:"event"`
}

// Engine processes events and generates alerts.
type Engine struct {
	broker *broker.Broker
	log    *zap.SugaredLogger
	ctx    context.Context
	cancel context.CancelFunc
}

// New creates a new DetectionEngine.
func New(msgBroker *broker.Broker, log *zap.SugaredLogger) *Engine {
	ctx, cancel := context.WithCancel(context.Background())
	return &Engine{
		broker: msgBroker,
		log:    log,
		ctx:    ctx,
		cancel: cancel,
	}
}

// Start begins processing events from NATS.
func (e *Engine) Start() error {
	e.log.Info("Starting Detection Engine")

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

// evaluate runs basic hardcoded rules against the event.
// Phase 2 MVP: Hardcoded basic rules.
func (e *Engine) evaluate(event *pb.Event) {
	// Rule 1: Suspicious process execution (nmap or nc)
	if event.Type == pb.EventType_EVENT_TYPE_PROCESS {
		action := event.Fields["event"]
		rawData := string(event.RawData)

		if action == "execve" && (strings.Contains(rawData, "nmap") || strings.Contains(rawData, "nc ")) {
			e.generateAlert(event, "rule-suspicious-process", "high", "Suspicious network tool executed (nmap/nc)")
		}
	}

	// Rule 2: FIM detected change in /etc
	if event.Type == pb.EventType_EVENT_TYPE_FILE {
		file := event.Fields["file"]
		action := event.Fields["action"]

		if strings.HasPrefix(file, "/etc/") && (action == "modify" || action == "delete") {
			e.generateAlert(event, "rule-etc-modified", "medium", fmt.Sprintf("Sensitive file modified: %s", file))
		}
	}
}

func (e *Engine) generateAlert(event *pb.Event, ruleID, severity, description string) {
	alert := Alert{
		ID:          uuid.New().String(),
		RuleID:      ruleID,
		Severity:    severity,
		Description: description,
		Timestamp:   time.Now(),
		AgentID:     event.AgentId,
		Event:       event,
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

	e.log.Infow("Alert generated", "rule_id", ruleID, "agent_id", alert.AgentID, "severity", severity)
}

// Stop gracefully shuts down the engine.
func (e *Engine) Stop() {
	e.cancel()
}
