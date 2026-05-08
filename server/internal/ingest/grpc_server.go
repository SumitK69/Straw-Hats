// Package ingest provides the gRPC server for agent telemetry ingestion.
package ingest

import (
	"context"
	"fmt"
	"io"
	"net"
	"time"

	"encoding/json"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/sentinel-io/sentinel/server/internal/broker"
	"github.com/sentinel-io/sentinel/server/internal/ca"
	"github.com/sentinel-io/sentinel/server/internal/config"
	"github.com/sentinel-io/sentinel/server/internal/store"
	pb "github.com/sentinel-io/sentinel/server/proto/sentinelpb"
)

// GRPCServer wraps a gRPC server for agent communication.
type GRPCServer struct {
	server *grpc.Server
	cfg    *config.Config
	ca     *ca.CertAuthority
	broker *broker.Broker
	store  *store.Client
	log    *zap.SugaredLogger

	pb.UnimplementedAgentEnrollmentServiceServer
	pb.UnimplementedAgentTelemetryServiceServer
}

// NewGRPCServer creates a new gRPC server for agent telemetry.
func NewGRPCServer(cfg *config.Config, certAuth *ca.CertAuthority, msgBroker *broker.Broker, osClient *store.Client, log *zap.SugaredLogger) *GRPCServer {
	s := &GRPCServer{
		cfg:    cfg,
		ca:     certAuth,
		broker: msgBroker,
		store:  osClient,
		log:    log,
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

	// Extract or generate an agent ID
	agentID := req.Fingerprint.MachineId
	if agentID == "" {
		return nil, status.Error(codes.InvalidArgument, "machine_id is required in fingerprint")
	}

	s.log.Infow("Agent enrollment request", "agent_id", agentID, "hostname", req.Fingerprint.Hostname)

	// Issue certificate
	certPEM, keyPEM, caCertPEM, err := s.ca.IssueCert(agentID, req.Fingerprint.Hostname)
	if err != nil {
		s.log.Errorw("Failed to issue cert", "agent_id", agentID, "error", err)
		return nil, status.Error(codes.Internal, "failed to issue certificate")
	}

	// Register agent in OpenSearch
	now := time.Now().UTC().Format(time.RFC3339)
	agentDoc := map[string]interface{}{
		"agent_id":    agentID,
		"hostname":    req.Fingerprint.Hostname,
		"os":          req.Fingerprint.Os,
		"arch":        req.Fingerprint.Arch,
		"version":     req.AgentVersion,
		"status":      "active",
		"last_seen":   now,
		"enrolled_at": now,
	}

	if err := s.store.IndexDoc(ctx, "sentinel-agents", agentID, agentDoc); err != nil {
		s.log.Errorw("Failed to register agent in OpenSearch", "agent_id", agentID, "error", err)
		// Non-fatal: enrollment still succeeds, the agent just won't appear in the dashboard yet
	} else {
		s.log.Infow("Agent registered in OpenSearch", "agent_id", agentID)
	}

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
	s.log.Info("Agent stream connected")

	var agentID string
	var lastUpdate time.Time

	for {
		batch, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			s.log.Errorw("Error receiving event batch", "error", err)
			return err
		}

		s.log.Debugw("Received event batch", "agent_id", batch.AgentId, "events_count", len(batch.Events))

		// Update agent last_seen periodically (e.g., every 30 seconds)
		if batch.AgentId != "" && time.Since(lastUpdate) > 30*time.Second {
			agentID = batch.AgentId
			lastUpdate = time.Now()
			
			go func(aid string) {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				now := time.Now().UTC().Format(time.RFC3339)
				update := map[string]interface{}{
					"agent_id":  aid,
					"status":    "active",
					"last_seen": now,
				}
				if err := s.store.UpdateDoc(ctx, "sentinel-agents", aid, update); err != nil {
					s.log.Debugw("Failed to update agent last_seen", "agent_id", aid, "error", err)
				}
			}(agentID)
		}

		// Process and queue events to NATS
		for _, e := range batch.Events {
			// Convert pb.Event to JSON payload for NATS
			payload, err := json.Marshal(e)
			if err != nil {
				s.log.Errorw("Failed to marshal event", "error", err, "event_id", e.Id)
				continue
			}

			// Publish to NATS JetStream synchronously (for MVP simplicity)
			subject := fmt.Sprintf("events.%s", e.Type.String())
			if _, err := s.broker.JS().Publish(subject, payload); err != nil {
				s.log.Errorw("Failed to publish event to NATS", "error", err, "event_id", e.Id)
				// We should probably return an error or handle retry, but for MVP we continue
			}
		}

		// Send acknowledgment
		err = stream.Send(&pb.IngestResponse{
			Accepted:      true,
			AckedSequence: batch.SequenceNumber,
		})
		if err != nil {
			s.log.Errorw("Error sending ingest response", "error", err)
			return err
		}
	}
}

// CommandChannel handles the active response command stream.
func (s *GRPCServer) CommandChannel(stream pb.AgentTelemetryService_CommandChannelServer) error {
	s.log.Info("CommandChannel connection opened (Phase 4 implementation pending)")
	return status.Error(codes.Unimplemented, "not implemented")
}
