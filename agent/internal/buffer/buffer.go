// Package buffer implements a WAL-style local event buffer.
// When the server is unreachable, events are buffered to disk
// and replayed on reconnect (PRD Section 6.4).
package buffer

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/sentinel-io/sentinel/agent/internal/collector"
)

// Buffer provides durable local storage for events when server is unreachable.
type Buffer struct {
	mu       sync.Mutex
	dir      string
	maxBytes int64
	size     atomic.Int64
	sequence atomic.Uint64
	current  *os.File
}

// New creates a new event buffer.
func New(dir string, maxMB int) (*Buffer, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, fmt.Errorf("create buffer dir: %w", err)
	}
	b := &Buffer{
		dir:      dir,
		maxBytes: int64(maxMB) * 1024 * 1024,
	}
	return b, nil
}

// Write appends an event to the buffer.
func (b *Buffer) Write(event collector.Event) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.size.Load() >= b.maxBytes {
		// Drop oldest segment to make room
		if err := b.dropOldest(); err != nil {
			return fmt.Errorf("drop oldest: %w", err)
		}
	}

	if b.current == nil {
		if err := b.newSegment(); err != nil {
			return err
		}
	}

	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}
	data = append(data, '\n')

	n, err := b.current.Write(data)
	if err != nil {
		return fmt.Errorf("write event: %w", err)
	}
	b.size.Add(int64(n))

	return nil
}

// Replay reads all buffered events in order and sends them to the channel.
func (b *Buffer) Replay(events chan<- collector.Event) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	// TODO Phase 1: Read all segment files in order, deserialize, send to channel
	// After successful replay, delete segment files

	return nil
}

// Size returns the current buffer size in bytes.
func (b *Buffer) Size() int64 {
	return b.size.Load()
}

func (b *Buffer) newSegment() error {
	seq := b.sequence.Add(1)
	name := filepath.Join(b.dir, fmt.Sprintf("segment-%010d.wal", seq))
	f, err := os.OpenFile(name, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		return fmt.Errorf("create segment: %w", err)
	}
	b.current = f
	return nil
}

func (b *Buffer) dropOldest() error {
	entries, err := os.ReadDir(b.dir)
	if err != nil {
		return err
	}
	if len(entries) == 0 {
		return nil
	}
	oldest := filepath.Join(b.dir, entries[0].Name())
	info, _ := os.Stat(oldest)
	if info != nil {
		b.size.Add(-info.Size())
	}
	return os.Remove(oldest)
}
