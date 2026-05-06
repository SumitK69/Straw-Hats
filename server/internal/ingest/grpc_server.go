// Package ingest provides the gRPC server for agent telemetry ingestion.
package ingest

import (
	"context"
	"fmt"
	"net"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/sentinel-io/sentinel/server/internal/ca"
	"github.com/sentinel-io/sentinel/server/internal/config"
	pb "github.com/sentinel-io/sentinel/server/proto/sentinelpb"
)

// GRPCServer wraps a gRPC server for agent communication.
type GRPCServer struct {
	server *grpc.Server
	cfg    *config.Config
	ca     *ca.CertAuthority
	log    *zap.SugaredLogger

	pb.UnimplementedAgentEnrollmentServiceServer
	pb.UnimplementedAgentTelemetryServiceServer
}

// NewGRPCServer creates a new gRPC server for agent telemetry.
func NewGRPCServer(cfg *config.Config, certAuth *ca.CertAuthority, log *zap.SugaredLogger) *GRPCServer {
	s := &GRPCServer{
		cfg: cfg,
		ca:  certAuth,
		log: log,
	}

	opts := []grpc.ServerOption{
		grpc.MaxRecvMsgSize(16 * 1024 * 1024), // 16MB max message
	}

	s.server = grpc.NewServer(opts...)
	pb.RegisterAgentEnrollmentServiceServer(s.server, s)
	pb.RegisterAgentTelemetryServiceServer(s.server, s)
	return s
}

// Serve starts the gRPC server on the given listener.
func (s *GRPCServer) Serve(lis net.Listener) error {
	s.log.Info("gRPC server starting")
	return s.server.Serve(lis)
}

// GracefulStop stops the gRPC server gracefully.
func (s *GRPCServer) GracefulStop() {
	if s.server != nil {
		s.server.GracefulStop()
	}
}

// ── AgentEnrollmentService ──────────────────────────────────────────────

// Enroll handles agent enrollment requests.
func (s *GRPCServer) Enroll(ctx context.Context, req *pb.EnrollmentRequest) (*pb.EnrollmentResponse, error) {
	if req.Token == "" {
		return nil, status.Error(codes.Unauthenticated, "missing enrollment token")
	}

	// Validate JWT token
	token, err := jwt.Parse(req.Token, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWT.SigningKey), nil
	})

	if err != nil || !token.Valid {
		s.log.Warnw("Invalid enrollment token", "error", err)
		return nil, status.Error(codes.Unauthenticated, "invalid enrollment token")
	}

	// Extract or generate an agent ID. For simplicity, we use the MachineId from fingerprint if available,
	// otherwise we just let the CA generate the Common Name which acts as the agent ID.
	// Actually, let's use MachineId if it's there.
	agentID := req.Fingerprint.MachineId
	if agentID == "" {
		return nil, status.Error(codes.InvalidArgument, "machine_id is required in fingerprint")
	}

	s.log.Infow("Agent enrollment request", "agent_id", agentID, "hostname", req.Fingerprint.Hostname)

	// Issue certificate
	// We pass the hostname as the fingerprint argument for the CA to include in the cert subject if needed.
	certPEM, keyPEM, caCertPEM, err := s.ca.IssueCert(agentID, req.Fingerprint.Hostname)
	if err != nil {
		s.log.Errorw("Failed to issue cert", "agent_id", agentID, "error", err)
		return nil, status.Error(codes.Internal, "failed to issue certificate")
	}

	// TODO: Phase 2 - Store agent metadata in OpenSearch

	// Build the response
	// The server address for telemetry is usually the gRPC endpoint.
	// For production, this should be configurable. We'll use a placeholder for now.
	serverAddr := fmt.Sprintf("sentinel-server:%d", s.cfg.GRPCPort)

	return &pb.EnrollmentResponse{
		AgentId:       agentID,
		AgentCert:     certPEM,
		AgentKey:      keyPEM,
		CaCert:        caCertPEM,
		ServerAddress: serverAddr,
	}, nil
}

// ── AgentTelemetryService ───────────────────────────────────────────────

// StreamEvents handles bidirectional event streaming from agents.
func (s *GRPCServer) StreamEvents(stream pb.AgentTelemetryService_StreamEventsServer) error {
	s.log.Info("StreamEvents connection opened (Phase 2 implementation pending)")
	return status.Error(codes.Unimplemented, "not implemented")
}

// CommandChannel handles the active response command stream.
func (s *GRPCServer) CommandChannel(stream pb.AgentTelemetryService_CommandChannelServer) error {
	s.log.Info("CommandChannel connection opened (Phase 2 implementation pending)")
	return status.Error(codes.Unimplemented, "not implemented")
}
