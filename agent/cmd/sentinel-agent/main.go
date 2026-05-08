// Package main is the entry point for the Sentinel Agent.
//
// The agent is a lightweight Go binary deployed on monitored endpoints.
// It collects telemetry (process events, FIM, network flows, logs, metrics),
// streams events to the Sentinel Server via mTLS gRPC, and executes
// active response commands.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/nxadm/tail"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/sentinel-io/sentinel/agent/internal/config"
	"github.com/sentinel-io/sentinel/agent/internal/enrollment"
	pb "github.com/sentinel-io/sentinel/server/proto/sentinelpb"
)

var (
	version   = "0.1.0-dev"
	buildTime = "unknown"
)

func main() {
	// ── Parse flags ───────────────────────────────────────────────
	token := flag.String("token", "", "Enrollment token (JWT) for initial registration")
	install := flag.Bool("install", false, "Install as system service after enrollment")
	configPath := flag.String("config", "", "Path to agent config file")
	showVersion := flag.Bool("version", false, "Print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("sentinel-agent %s (%s) %s/%s\n", version, buildTime, runtime.GOOS, runtime.GOARCH)
		os.Exit(0)
	}

	// ── Initialize logger ─────────────────────────────────────────
	logger, _ := zap.NewProduction()
	defer logger.Sync()
	log := logger.Sugar()

	log.Infow("Starting Sentinel Agent",
		"version", version,
		"os", runtime.GOOS,
		"arch", runtime.GOARCH,
	)

	// ── Load configuration ────────────────────────────────────────
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// ── Enrollment flow ───────────────────────────────────────────
	if *token != "" {
		log.Info("Enrollment token provided — starting enrollment flow")
		if err := enrollment.Enroll(cfg, *token); err != nil {
			log.Fatalf("Enrollment failed: %v", err)
		}
		log.Info("Enrollment successful")

		if *install {
			log.Info("Installing as system service — not yet implemented (Phase 1)")
			// TODO: Detect OS and install as systemd/launchd/Windows Service
		}

		// When running via install script, exit after enrollment
		// The systemd service will start the agent without --install
		if *install {
			log.Info("Enrollment complete — exiting. The systemd service will manage the agent.")
			os.Exit(0)
		}
	}

	// ── Graceful shutdown setup ───────────────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// ── Start the persistent event loop in a goroutine ────────────
	go runEventLoop(ctx, cfg, log)

	// ── Block until shutdown signal ───────────────────────────────
	sig := <-quit
	log.Infow("Shutting down Sentinel Agent", "signal", sig.String())

	cancel()
	log.Info("Sentinel Agent stopped")
}

// runEventLoop manages the persistent connection to the server with retry logic.
// It will keep trying to connect and stream events, reconnecting on failures.
// It only returns when ctx is cancelled (i.e. on shutdown signal).
func runEventLoop(ctx context.Context, cfg *config.Config, log *zap.SugaredLogger) {
	backoff := 5 * time.Second
	maxBackoff := 10 * time.Second

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// Use insecure credentials for Phase 2 E2E local mock
		// Force localhost:4222 for E2E local host testing
		serverAddr := cfg.ServerAddress
		if serverAddr == "sentinel-server:4222" {
			serverAddr = "localhost:4222"
		}

		log.Infow("Starting event loop — connecting to server", "address", serverAddr)

		conn, err := grpc.Dial(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			log.Warnw("Failed to connect to server, retrying...", "error", err, "retry_in", backoff)
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
				backoff = minDuration(backoff*2, maxBackoff)
				continue
			}
		}

		client := pb.NewAgentTelemetryServiceClient(conn)
		stream, err := client.StreamEvents(ctx)
		if err != nil {
			conn.Close()
			log.Warnw("Failed to open event stream, retrying...", "error", err, "retry_in", backoff)
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
				backoff = minDuration(backoff*2, maxBackoff)
				continue
			}
		}

		// Connection successful — reset backoff
		backoff = 5 * time.Second
		log.Info("Connected to server — starting telemetry collection")

		// ── Collect and stream real system logs ────────────────────
		// Create a child context so we can cancel collection goroutines
		// when the connection drops without killing the whole agent.
		streamCtx, streamCancel := context.WithCancel(ctx)

		logFiles := findLogFiles()
		if len(logFiles) > 0 {
			log.Infow("Starting log collection", "files", logFiles)
			for _, lf := range logFiles {
				go tailLogFile(streamCtx, streamCancel, lf, cfg.AgentID, stream, log)
			}
		} else {
			log.Info("No log files found — sending heartbeat events only")
		}

		// Always start the heartbeat routine to keep the agent 'active' in the UI
		// even if there are no new logs being generated.
		go sendHeartbeats(streamCtx, streamCancel, cfg.AgentID, stream, log)

		// Listen for server responses and errors (e.g. agent deletion)
		go func() {
			for {
				_, err := stream.Recv()
				if err != nil {
					if strings.Contains(err.Error(), "agent_deleted") {
						log.Fatal("Agent was deleted from dashboard. Uninstalling...")
						uninstallAgent(log)
						os.Exit(0)
					}
					// Other errors mean the stream broke, cancel context
					streamCancel()
					return
				}
			}
		}()

		// Wait for the stream to break or context to cancel
		<-streamCtx.Done()
		streamCancel()
		conn.Close()

		// If parent context is done, exit the loop
		select {
		case <-ctx.Done():
			return
		default:
			log.Warnw("Connection lost, reconnecting...", "retry_in", backoff)
			time.Sleep(backoff)
		}
	}
}

// minDuration returns the smaller of two durations.
func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}

// findLogFiles returns paths to common Linux log files that exist and are readable.
func findLogFiles() []string {
	candidates := []string{
		"/var/log/syslog",
		"/var/log/auth.log",
		"/var/log/messages",
		"/var/log/secure",
		"/var/log/kern.log",
	}
	var found []string
	for _, path := range candidates {
		if f, err := os.Open(path); err == nil {
			f.Close()
			found = append(found, path)
		}
	}
	return found
}

// tailLogFile tails a log file and streams new lines as events to the server.
func tailLogFile(ctx context.Context, cancelStream context.CancelFunc, path string, agentID string, stream pb.AgentTelemetryService_StreamEventsClient, log *zap.SugaredLogger) {
	t, err := tail.TailFile(path, tail.Config{
		Follow:    true,
		ReOpen:    true,
		MustExist: false,
		Poll:      false, // Use fsnotify for low latency
		Location:  &tail.SeekInfo{Offset: 0, Whence: 2}, // Seek to end
		Logger:    tail.DiscardingLogger,
	})
	if err != nil {
		log.Errorw("Failed to tail log file", "path", path, "error", err)
		return
	}
	defer t.Cleanup()

	// Determine log type from path
	logType := "syslog"
	if strings.Contains(path, "auth") || strings.Contains(path, "secure") {
		logType = "auth"
	} else if strings.Contains(path, "kern") {
		logType = "kernel"
	}

	var seq uint64
	var batch []*pb.Event

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			t.Stop()
			return
		case line, ok := <-t.Lines:
			if !ok {
				log.Warnw("Tail channel closed", "path", path)
				return
			}
			if line.Err != nil {
				log.Warnw("Tail error", "path", path, "error", line.Err)
				continue
			}

			if line.Text == "" {
				continue
			}

			// Parse syslog-style fields
			hostname, program, message := parseSyslogLine(line.Text)

			// PREVENT FEEDBACK LOOP: Ignore logs generated by this agent
			if program == "sentinel-agent" {
				continue
			}

			event := &pb.Event{
				Id:      fmt.Sprintf("evt-%d", time.Now().UnixNano()),
				AgentId: agentID,
				Type:    pb.EventType_EVENT_TYPE_LOG,
				Fields: map[string]string{
					"log_source": path,
					"log_type":   logType,
					"hostname":   hostname,
					"program":    program,
					"message":    message,
				},
				RawData: []byte(line.Text),
			}

			batch = append(batch, event)

			// Send in batches of 50
			if len(batch) >= 50 {
				seq++
				if !sendBatch(stream, agentID, batch, seq, log) {
					t.Stop()
					cancelStream()
					return
				}
				batch = nil
			}

		case <-ticker.C:
			// Flush remaining events every 100ms for low latency
			if len(batch) > 0 {
				seq++
				if !sendBatch(stream, agentID, batch, seq, log) {
					t.Stop()
					cancelStream()
					return
				}
				batch = nil
			}
		}
	}
}

func parseSyslogLine(line string) (hostname, program, message string) {
	// Standard syslog format: "May  7 08:30:01 hostname program[pid]: message"
	// Handle single-digit days which have a double space (e.g. "May  7")
	normalizedLine := strings.Replace(line, "  ", " ", 1)
	
	// Skip the timestamp (first 3 fields)
	parts := strings.SplitN(normalizedLine, " ", 6)
	if len(parts) >= 6 {
		// parts[0..2] = date/time, parts[3] = hostname, parts[4] = program, parts[5] = message
		hostname = parts[3]
		prog := parts[4]
		// Strip trailing colon and PID bracket
		if idx := strings.Index(prog, "["); idx > 0 {
			prog = prog[:idx]
		}
		prog = strings.TrimSuffix(prog, ":")
		program = prog
		message = parts[5]
	} else {
		// Can't parse, just use the whole line as message
		hostname = "unknown"
		program = "unknown"
		message = line
	}
	
	// Failsafe: if we couldn't extract the program but the line contains sentinel-agent, mark it to avoid feedback loops
	if program == "unknown" && strings.Contains(line, "sentinel-agent") {
		program = "sentinel-agent"
	}
	
	return
}

// sendBatch sends a batch of events to the server stream.
// Returns true on success, false on failure (indicating the stream is broken).
func sendBatch(stream pb.AgentTelemetryService_StreamEventsClient, agentID string, events []*pb.Event, seq uint64, log *zap.SugaredLogger) bool {
	batch := &pb.EventBatch{
		AgentId:        agentID,
		Events:         events,
		SequenceNumber: seq,
	}
	if err := stream.Send(batch); err != nil {
		log.Errorw("Failed to send event batch", "error", err, "count", len(events))
		return false
	}
	log.Infow("Sent log events to server", "count", len(events), "seq", seq)
	return true
}

// sendHeartbeats sends periodic heartbeat events when no log files are available.
func sendHeartbeats(ctx context.Context, cancelStream context.CancelFunc, agentID string, stream pb.AgentTelemetryService_StreamEventsClient, log *zap.SugaredLogger) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	var seq uint64

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			seq++
			event := &pb.Event{
				Id:      fmt.Sprintf("hb-%d", time.Now().UnixNano()),
				AgentId: agentID,
				Type:    pb.EventType_EVENT_TYPE_METRIC,
				Fields: map[string]string{
					"event":   "heartbeat",
					"os":      runtime.GOOS,
					"arch":    runtime.GOARCH,
					"version": version,
				},
				RawData: []byte(fmt.Sprintf("heartbeat from %s at %s", agentID, time.Now().UTC().Format(time.RFC3339))),
			}
			if !sendBatch(stream, agentID, []*pb.Event{event}, seq, log) {
				cancelStream()
				return
			}
		}
	}
}

// uninstallAgent completely removes the agent from the system
func uninstallAgent(log *zap.SugaredLogger) {
	log.Info("Uninstalling Sentinel Agent...")

	// Stop and disable systemd service
	if _, err := os.Stat("/etc/systemd/system/sentinel-agent.service"); err == nil {
		exec.Command("systemctl", "stop", "sentinel-agent").Run()
		exec.Command("systemctl", "disable", "sentinel-agent").Run()
		os.Remove("/etc/systemd/system/sentinel-agent.service")
		exec.Command("systemctl", "daemon-reload").Run()
	}

	// Remove installation directory
	os.RemoveAll("/opt/sentinel")
	log.Info("Uninstallation complete.")
}
