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

	"go.uber.org/zap"

	"github.com/sentinel-io/sentinel/agent/internal/config"
	"github.com/sentinel-io/sentinel/agent/internal/enrollment"
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
	log.Info("Telemetry collectors — not yet implemented (Phase 1)")

	// ── Start event streaming ─────────────────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	_ = ctx // Will be used for collector goroutines
	_ = cfg // Will be used for server connection

	// ── Graceful shutdown ─────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Infow("Shutting down Sentinel Agent", "signal", sig.String())

	cancel()
	log.Info("Sentinel Agent stopped")
}
