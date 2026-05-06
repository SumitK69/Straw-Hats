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
	"os/signal"
	"runtime"
	"syscall"
	"time"

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
	}

	// ── Initialize collectors ─────────────────────────────────────
	// TODO: Initialize telemetry collectors based on config:
	// - Process events (auditd/eBPF on Linux, ETW on Windows)
	// - File integrity monitoring (inotify/FSEvents/ReadDirectoryChangesW)
	// - Network flows (conntrack/WFP)
	// - Log collection (syslog/journald/WEL)
	// - OS metrics (procfs/WMI/sysctl)
	log.Info("Telemetry collectors — Phase 2 E2E test mock")

	// ── Start event streaming ─────────────────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Use insecure credentials for Phase 2 E2E local mock
	// Force localhost:4222 for E2E local host testing
	serverAddr := cfg.ServerAddress
	if serverAddr == "sentinel-server:4222" {
		serverAddr = "localhost:4222"
	}
	
	conn, err := grpc.Dial(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("Failed to connect to server: %v", err)
	}
	defer conn.Close()

	client := pb.NewAgentTelemetryServiceClient(conn)
	stream, err := client.StreamEvents(ctx)
	if err != nil {
		log.Fatalf("Failed to open stream: %v", err)
	}

	go func() {
		// Send a test event to trigger detection rules
		for {
			event := &pb.Event{
				Id:       fmt.Sprintf("evt-%d", time.Now().UnixNano()),
				AgentId:  cfg.AgentID,
				Type:     pb.EventType_EVENT_TYPE_PROCESS,
				Fields: map[string]string{
					"event": "execve",
				},
				RawData: []byte("nmap -sV 192.168.1.0/24"),
			}

			batch := &pb.EventBatch{
				AgentId:        cfg.AgentID,
				Events:         []*pb.Event{event},
				SequenceNumber: 1,
			}

			if err := stream.Send(batch); err != nil {
				log.Errorf("Failed to send event: %v", err)
				return
			}
			log.Info("Sent test event to server")
			time.Sleep(5 * time.Second)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Infow("Shutting down Sentinel Agent", "signal", sig.String())

	cancel()
	log.Info("Sentinel Agent stopped")
}
