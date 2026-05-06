// Package indexer handles moving data from NATS JetStream to OpenSearch.
package indexer

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"go.uber.org/zap"

	"github.com/sentinel-io/sentinel/server/internal/broker"
	"github.com/sentinel-io/sentinel/server/internal/store"
)

// Indexer moves messages from NATS to OpenSearch.
type Indexer struct {
	broker *broker.Broker
	store  *store.Client
	log    *zap.SugaredLogger
	ctx    context.Context
	cancel context.CancelFunc
}

// New creates a new OpenSearch Indexer.
func New(msgBroker *broker.Broker, storeClient *store.Client, log *zap.SugaredLogger) *Indexer {
	ctx, cancel := context.WithCancel(context.Background())
	return &Indexer{
		broker: msgBroker,
		store:  storeClient,
		log:    log,
		ctx:    ctx,
		cancel: cancel,
	}
}

// Start begins processing streams from NATS and indexing them.
func (i *Indexer) Start() error {
	i.log.Info("Starting OpenSearch Indexer")

	js := i.broker.JS()

	// 1. Subscribe to events
	eventSub, err := js.PullSubscribe("events.>", "indexer-events", nats.BindStream("EVENTS"))
	if err != nil {
		eventSub, err = js.PullSubscribe("events.>", "indexer-events")
		if err != nil {
			return fmt.Errorf("subscribe to events: %w", err)
		}
	}
	go i.processLoop(eventSub, "sentinel-events")

	// 2. Subscribe to alerts
	alertSub, err := js.PullSubscribe("alerts.>", "indexer-alerts", nats.BindStream("ALERTS"))
	if err != nil {
		alertSub, err = js.PullSubscribe("alerts.>", "indexer-alerts")
		if err != nil {
			return fmt.Errorf("subscribe to alerts: %w", err)
		}
	}
	go i.processLoop(alertSub, "sentinel-alerts")

	return nil
}

func (i *Indexer) processLoop(sub *nats.Subscription, indexPrefix string) {
	for {
		select {
		case <-i.ctx.Done():
			i.log.Infow("Indexer loop stopped", "index_prefix", indexPrefix)
			return
		default:
			msgs, err := sub.Fetch(100, nats.MaxWait(1*time.Second))
			if err != nil {
				if err == nats.ErrTimeout {
					continue
				}
				i.log.Errorw("Error fetching messages for indexer", "error", err)
				time.Sleep(1 * time.Second)
				continue
			}

			if len(msgs) == 0 {
				continue
			}

			// Prepare documents for bulk indexing
			docs := make([]map[string]interface{}, 0, len(msgs))
			for _, msg := range msgs {
				var doc map[string]interface{}
				if err := json.Unmarshal(msg.Data, &doc); err != nil {
					i.log.Errorw("Failed to unmarshal message for indexing", "error", err)
					msg.Nak()
					continue
				}

				// Ensure @timestamp exists
				if _, ok := doc["@timestamp"]; !ok {
					// Check for timestamp field (which might be what event/alert uses)
					if ts, hasTs := doc["timestamp"]; hasTs {
						doc["@timestamp"] = ts
					} else {
						doc["@timestamp"] = time.Now().UTC().Format(time.RFC3339)
					}
				}

				docs = append(docs, doc)
			}

			// Determine daily index name (e.g., sentinel-events-2023.10.25)
			today := time.Now().UTC().Format("2006.01.02")
			indexName := fmt.Sprintf("%s-%s", indexPrefix, today)

			// Bulk insert
			if err := i.store.BulkIndex(i.ctx, indexName, docs); err != nil {
				i.log.Errorw("Failed to bulk index documents", "error", err, "index", indexName)
				// Nak all messages so they are redelivered
				for _, msg := range msgs {
					msg.Nak()
				}
				time.Sleep(2 * time.Second)
				continue
			}

			// Ack all messages after successful index
			for _, msg := range msgs {
				msg.AckSync()
			}
			i.log.Debugw("Indexed documents", "count", len(docs), "index", indexName)
		}
	}
}

// Stop gracefully shuts down the indexer.
func (i *Indexer) Stop() {
	i.cancel()
}
