// Package main is the entry point for the Sentinel Server.
//
// The Sentinel Server is the central brain of the SIEM/XDR platform.
// It receives agent telemetry via gRPC, evaluates detection rules,
// generates alerts, and exposes REST + WebSocket APIs for the dashboard.
package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/sentinel-io/sentinel/server/internal/api"
	"github.com/sentinel-io/sentinel/server/internal/ca"
	"github.com/sentinel-io/sentinel/server/internal/config"
	"github.com/sentinel-io/sentinel/server/internal/ingest"
	"github.com/sentinel-io/sentinel/server/internal/store"
)

var (
	version   = "0.1.0-dev"
	buildTime = "unknown"
)

func main() {
	// ── Initialize logger ─────────────────────────────────────────
	logger, _ := zap.NewProduction()
	defer logger.Sync()
	log := logger.Sugar()

	log.Infow("Starting Sentinel Server",
		"version", version,
		"build_time", buildTime,
	)

	// ── Load configuration ────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	log.Infow("Configuration loaded",
		"grpc_port", cfg.GRPCPort,
		"rest_port", cfg.RESTPort,
	)

	// ── Initialize Certificate Authority ──────────────────────────
	certAuthority, err := ca.New(cfg.CA)
	if err != nil {
		log.Fatalf("Failed to initialize Certificate Authority: %v", err)
	}
	log.Info("Certificate Authority initialized")

	// ── Initialize OpenSearch client ──────────────────────────────
	osClient, err := store.NewOpenSearchClient(cfg.OpenSearch)
	if err != nil {
		log.Fatalf("Failed to connect to OpenSearch: %v", err)
	}
	if err := osClient.ApplyTemplates(context.Background()); err != nil {
		log.Warnw("Failed to apply index templates (OpenSearch may not be ready)", "error", err)
	}
	log.Info("OpenSearch client initialized")

	// ── Start gRPC server (agent telemetry ingest) ────────────────
	grpcServer := ingest.NewGRPCServer(certAuthority, log)
	grpcLis, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.GRPCPort))
	if err != nil {
		log.Fatalf("Failed to listen on gRPC port %d: %v", cfg.GRPCPort, err)
	}
	go func() {
		log.Infow("gRPC server listening", "port", cfg.GRPCPort)
		if err := grpcServer.Serve(grpcLis); err != nil {
			log.Fatalf("gRPC server error: %v", err)
		}
	}()

	// ── Start REST API server (dashboard API) ─────────────────────
	router := api.NewRouter(cfg, osClient, certAuthority, log)
	httpServer := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.RESTPort),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	go func() {
		log.Infow("REST API server listening", "port", cfg.RESTPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("REST server error: %v", err)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Infow("Shutting down Sentinel Server", "signal", sig.String())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown REST server
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Errorw("REST server shutdown error", "error", err)
	}

	// Shutdown gRPC server
	grpcServer.GracefulStop()

	log.Info("Sentinel Server stopped")
}
