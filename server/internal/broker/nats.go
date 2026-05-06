// Package broker provides messaging queue functionality using NATS JetStream.
package broker

import (
	"fmt"
	"os"
	"time"

	"github.com/nats-io/nats-server/v2/server"
	"github.com/nats-io/nats.go"
	"go.uber.org/zap"

	"github.com/sentinel-io/sentinel/server/internal/config"
)

// Broker represents the messaging broker.
type Broker struct {
	server *server.Server
	conn   *nats.Conn
	js     nats.JetStreamContext
	log    *zap.SugaredLogger
}

// New initializes the NATS broker, either embedded or remote.
func New(cfg config.NATSConfig, log *zap.SugaredLogger) (*Broker, error) {
	b := &Broker{
		log: log,
	}

	if cfg.Embedded {
		if err := b.startEmbedded(cfg); err != nil {
			return nil, fmt.Errorf("start embedded NATS: %w", err)
		}
		// When embedded, we connect to the in-process server client URL
		cfg.URL = b.server.ClientURL()
	}

	// Connect NATS client
	opts := []nats.Option{
		nats.Name("sentinel-server"),
		nats.Timeout(10 * time.Second),
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1),
	}

	nc, err := nats.Connect(cfg.URL, opts...)
	if err != nil {
		if b.server != nil {
			b.server.Shutdown()
		}
		return nil, fmt.Errorf("nats connect: %w", err)
	}
	b.conn = nc

	// Initialize JetStream
	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		if b.server != nil {
			b.server.Shutdown()
		}
		return nil, fmt.Errorf("jetstream init: %w", err)
	}
	b.js = js

	// Create required streams
	if err := b.setupStreams(); err != nil {
		nc.Close()
		if b.server != nil {
			b.server.Shutdown()
		}
		return nil, fmt.Errorf("setup streams: %w", err)
	}

	log.Infow("NATS broker initialized", "embedded", cfg.Embedded, "url", cfg.URL)
	return b, nil
}

// startEmbedded starts an in-process NATS JetStream server.
func (b *Broker) startEmbedded(cfg config.NATSConfig) error {
	if err := os.MkdirAll(cfg.DataDir, 0755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}

	opts := &server.Options{
		ServerName: "sentinel-nats",
		Port:       server.RANDOM_PORT, // We only connect locally for embedded
		JetStream:  true,
		StoreDir:   cfg.DataDir,
		NoLog:      true, // Let zap handle our logs
		NoSigs:     true,
	}

	// Set JetStream limits
	opts.JetStreamMaxMemory = cfg.MaxMemory
	opts.JetStreamMaxStore = cfg.MaxMemory * 10 // File store limit

	ns, err := server.NewServer(opts)
	if err != nil {
		return err
	}

	go ns.Start()

	if !ns.ReadyForConnections(10 * time.Second) {
		return fmt.Errorf("embedded NATS failed to become ready")
	}

	b.server = ns
	return nil
}

// setupStreams creates the required JetStream streams if they don't exist.
func (b *Broker) setupStreams() error {
	streams := []struct {
		name     string
		subjects []string
	}{
		{
			name:     "EVENTS",
			subjects: []string{"events.>"},
		},
		{
			name:     "ALERTS",
			subjects: []string{"alerts.>"},
		},
	}

	for _, s := range streams {
		_, err := b.js.StreamInfo(s.name)
		if err != nil {
			// Try to add the stream
			_, err = b.js.AddStream(&nats.StreamConfig{
				Name:      s.name,
				Subjects:  s.subjects,
				Storage:   nats.FileStorage,
				Retention: nats.LimitsPolicy,
				MaxAge:    7 * 24 * time.Hour, // Keep data for 7 days in buffer
				Discard:   nats.DiscardOld,
			})
			if err != nil {
				return fmt.Errorf("add stream %s: %w", s.name, err)
			}
			b.log.Infow("Created JetStream stream", "stream", s.name)
		}
	}

	return nil
}

// JS returns the JetStream context for publishing and subscribing.
func (b *Broker) JS() nats.JetStreamContext {
	return b.js
}

// Close gracefully shuts down the client connection and embedded server.
func (b *Broker) Close() {
	if b.conn != nil {
		b.conn.Close()
	}
	if b.server != nil {
		b.server.Shutdown()
		b.server.WaitForShutdown()
	}
}
