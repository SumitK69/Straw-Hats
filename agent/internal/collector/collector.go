// Package collector defines the interface for telemetry collection modules.
package collector

import (
	"context"
	"time"
)

// Event represents a telemetry event collected by a module.
type Event struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`       // "process", "file", "network", "log", "metric"
	Timestamp time.Time         `json:"timestamp"`
	Fields    map[string]string `json:"fields"`
	RawData   []byte            `json:"raw_data,omitempty"`
}

// Collector is the interface that all telemetry modules must implement.
type Collector interface {
	// Name returns the collector name (e.g., "process", "fim", "network").
	Name() string

	// Start begins collecting telemetry events.
	// Events should be sent to the provided channel.
	// The collector should stop when the context is cancelled.
	Start(ctx context.Context, events chan<- Event) error

	// Stop gracefully stops the collector.
	Stop() error
}

// ── Placeholder collectors (Phase 1 implementations) ─────────────────

// ProcessCollector monitors process creation and termination.
type ProcessCollector struct{}

func (c *ProcessCollector) Name() string { return "process" }
func (c *ProcessCollector) Start(ctx context.Context, events chan<- Event) error {
	// Phase 1: Linux auditd/eBPF, Windows ETW, macOS OpenBSM
	<-ctx.Done()
	return nil
}
func (c *ProcessCollector) Stop() error { return nil }

// FIMCollector monitors file integrity changes.
type FIMCollector struct{}

func (c *FIMCollector) Name() string { return "fim" }
func (c *FIMCollector) Start(ctx context.Context, events chan<- Event) error {
	// Phase 1: Linux inotify, Windows ReadDirectoryChangesW, macOS FSEvents
	<-ctx.Done()
	return nil
}
func (c *FIMCollector) Stop() error { return nil }

// NetworkCollector captures network flow metadata.
type NetworkCollector struct{}

func (c *NetworkCollector) Name() string { return "network" }
func (c *NetworkCollector) Start(ctx context.Context, events chan<- Event) error {
	// Phase 1: Linux conntrack/eBPF, Windows WFP/ETW, macOS pflog
	<-ctx.Done()
	return nil
}
func (c *NetworkCollector) Stop() error { return nil }

// LogCollector tails log files and system logs.
type LogCollector struct{}

func (c *LogCollector) Name() string { return "log" }
func (c *LogCollector) Start(ctx context.Context, events chan<- Event) error {
	// Phase 1: syslog, journald, file tail, Windows Event Log
	<-ctx.Done()
	return nil
}
func (c *LogCollector) Stop() error { return nil }

// MetricsCollector collects OS-level metrics.
type MetricsCollector struct{}

func (c *MetricsCollector) Name() string { return "metrics" }
func (c *MetricsCollector) Start(ctx context.Context, events chan<- Event) error {
	// Phase 1: procfs on Linux, WMI on Windows, sysctl on macOS
	<-ctx.Done()
	return nil
}
func (c *MetricsCollector) Stop() error { return nil }
