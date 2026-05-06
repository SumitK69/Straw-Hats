// Package ingest provides the gRPC server for agent telemetry ingestion.
package ingest

import (
	"context"
	"fmt"
	"net"

	"go.uber.org/zap"
	"google.golang.org/grpc"

	"github.com/sentinel-io/sentinel/server/internal/ca"
)

// GRPCServer wraps a gRPC server for agent communication.
type GRPCServer struct {
	server *grpc.Server
	ca     *ca.CertAuthority
	log    *zap.SugaredLogger
}

// NewGRPCServer creates a new gRPC server for agent telemetry.
func NewGRPCServer(certAuth *ca.CertAuthority, log *zap.SugaredLogger) *GRPCServer {
	s := &GRPCServer{
		ca:  certAuth,
		log: log,
	}

	// TODO: Configure mTLS credentials from CA
	// TODO: Register protobuf service implementations
	opts := []grpc.ServerOption{
		grpc.MaxRecvMsgSize(16 * 1024 * 1024), // 16MB max message
	}

	s.server = grpc.NewServer(opts...)
	return s
}

// Serve starts the gRPC server on the given listener.
func (s *GRPCServer) Serve(lis net.Listener) error {
	s.log.Info("gRPC server starting (skeleton — no services registered yet)")
	return s.server.Serve(lis)
}

// GracefulStop stops the gRPC server gracefully.
func (s *GRPCServer) GracefulStop() {
	if s.server != nil {
		s.server.GracefulStop()
	}
}

// ── Placeholder service implementations (Phase 2) ────────────────────

// StreamEvents handles bidirectional event streaming from agents.
func (s *GRPCServer) StreamEvents(stream interface{}) error {
	s.log.Info("StreamEvents called (not implemented)")
	return fmt.Errorf("not implemented")
}

// Enroll handles agent enrollment requests.
func (s *GRPCServer) Enroll(ctx context.Context, agentID, token, fingerprint string) (certPEM, keyPEM, caCertPEM []byte, err error) {
	s.log.Infow("Agent enrollment request", "agent_id", agentID)

	// Issue certificate
	certPEM, keyPEM, caCertPEM, err = s.ca.IssueCert(agentID, fingerprint)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to issue cert: %w", err)
	}

	return certPEM, keyPEM, caCertPEM, nil
}
