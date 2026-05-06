// Package collector defines the interface for telemetry collection modules.
package collector

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/google/uuid"
	"github.com/nxadm/tail"
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
	Name() string
	Start(ctx context.Context, events chan<- Event) error
	Stop() error
}

// ── Process Collector (Phase 1) ──────────────────────────────────────────

// ProcessCollector monitors process creation and termination.
type ProcessCollector struct {
	// For Phase 1, we read from /var/log/audit/audit.log instead of direct netlink
	// to avoid complex root requirements in a basic setup.
	tailer *tail.Tail
}

func (c *ProcessCollector) Name() string { return "process" }

func (c *ProcessCollector) Start(ctx context.Context, events chan<- Event) error {
	// Simple audit.log tailer for Phase 1. Real implementation would use go-libaudit via netlink.
	auditLogPath := "/var/log/audit/audit.log"
	
	// Check if audit log exists and is readable
	if _, err := os.Stat(auditLogPath); os.IsNotExist(err) {
		// Log a warning that process monitoring needs auditd
		fmt.Println("Warning: auditd not installed or audit.log not found. Process monitoring disabled.")
		<-ctx.Done()
		return nil
	}

	t, err := tail.TailFile(auditLogPath, tail.Config{
		Follow: true, ReOpen: true, MustExist: false,
		Location: &tail.SeekInfo{Offset: 0, Whence: 2}, // End of file
	})
	if err != nil {
		return err
	}
	c.tailer = t

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case line, ok := <-t.Lines:
				if !ok {
					return
				}
				if strings.Contains(line.Text, "type=EXECVE") {
					events <- Event{
						ID:        uuid.New().String(),
						Type:      "process",
						Timestamp: line.Time,
						Fields: map[string]string{
							"event": "execve",
						},
						RawData: []byte(line.Text),
					}
				}
			}
		}
	}()

	return nil
}

func (c *ProcessCollector) Stop() error {
	if c.tailer != nil {
		return c.tailer.Stop()
	}
	return nil
}

// ── FIM Collector (Phase 1) ──────────────────────────────────────────────

// FIMCollector monitors file integrity changes.
type FIMCollector struct {
	watcher *fsnotify.Watcher
	dirs    []string
}

// NewFIMCollector creates a new FIM collector watching specific directories.
func NewFIMCollector(dirs []string) *FIMCollector {
	return &FIMCollector{dirs: dirs}
}

func (c *FIMCollector) Name() string { return "fim" }

func (c *FIMCollector) Start(ctx context.Context, events chan<- Event) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	c.watcher = watcher

	for _, dir := range c.dirs {
		if err := watcher.Add(dir); err != nil {
			fmt.Printf("Warning: failed to watch FIM directory %s: %v\n", dir, err)
		}
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				op := ""
				switch {
				case event.Has(fsnotify.Create):
					op = "create"
				case event.Has(fsnotify.Write):
					op = "modify"
				case event.Has(fsnotify.Remove):
					op = "delete"
				case event.Has(fsnotify.Rename):
					op = "rename"
				case event.Has(fsnotify.Chmod):
					op = "chmod"
				}
				
				if op != "" {
					events <- Event{
						ID:        uuid.New().String(),
						Type:      "file",
						Timestamp: time.Now(),
						Fields: map[string]string{
							"action": op,
							"file":   event.Name,
						},
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				fmt.Printf("FIM watcher error: %v\n", err)
			}
		}
	}()

	return nil
}

func (c *FIMCollector) Stop() error {
	if c.watcher != nil {
		return c.watcher.Close()
	}
	return nil
}

// ── Log Collector (Phase 1) ──────────────────────────────────────────────

// LogCollector tails log files and system logs.
type LogCollector struct {
	tailers []*tail.Tail
	files   []string
}

// NewLogCollector creates a collector tailing the specified log files.
func NewLogCollector(files []string) *LogCollector {
	return &LogCollector{files: files}
}

func (c *LogCollector) Name() string { return "log" }

func (c *LogCollector) Start(ctx context.Context, events chan<- Event) error {
	for _, file := range c.files {
		// Ignore if file doesn't exist yet
		if _, err := os.Stat(file); os.IsNotExist(err) {
			continue
		}

		t, err := tail.TailFile(file, tail.Config{
			Follow: true, ReOpen: true, MustExist: false,
			Location: &tail.SeekInfo{Offset: 0, Whence: 2},
		})
		if err != nil {
			fmt.Printf("Warning: failed to tail %s: %v\n", file, err)
			continue
		}
		c.tailers = append(c.tailers, t)

		go func(t *tail.Tail, filename string) {
			for {
				select {
				case <-ctx.Done():
					return
				case line, ok := <-t.Lines:
					if !ok {
						return
					}
					events <- Event{
						ID:        uuid.New().String(),
						Type:      "log",
						Timestamp: line.Time,
						Fields: map[string]string{
							"source": filename,
						},
						RawData: []byte(line.Text),
					}
				}
			}
		}(t, file)
	}

	return nil
}

func (c *LogCollector) Stop() error {
	for _, t := range c.tailers {
		t.Stop()
	}
	return nil
}

// ── Stubs for Phase 2 ────────────────────────────────────────────────────

// NetworkCollector captures network flow metadata.
type NetworkCollector struct{}
func (c *NetworkCollector) Name() string { return "network" }
func (c *NetworkCollector) Start(ctx context.Context, events chan<- Event) error {
	<-ctx.Done()
	return nil
}
func (c *NetworkCollector) Stop() error { return nil }

// MetricsCollector collects OS-level metrics.
type MetricsCollector struct{}
func (c *MetricsCollector) Name() string { return "metrics" }
func (c *MetricsCollector) Start(ctx context.Context, events chan<- Event) error {
	<-ctx.Done()
	return nil
}
func (c *MetricsCollector) Stop() error { return nil }
