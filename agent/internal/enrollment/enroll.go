// Package enrollment handles the agent enrollment flow with the server.
package enrollment

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/sentinel-io/sentinel/agent/internal/config"
	pb "github.com/sentinel-io/sentinel/server/proto/sentinelpb"
)

// SystemFingerprint contains system identification info sent during enrollment.
type SystemFingerprint struct {
	Hostname    string `json:"hostname"`
	OS          string `json:"os"`
	Arch        string `json:"arch"`
	OSVersion   string `json:"os_version"`
	Kernel      string `json:"kernel"`
	CPUCores    int    `json:"cpu_cores"`
	MemoryBytes uint64 `json:"memory_bytes"`
	MachineID   string `json:"machine_id"`
}

// CollectFingerprint gathers system information for enrollment.
func CollectFingerprint() (*SystemFingerprint, error) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	fp := &SystemFingerprint{
		Hostname: hostname,
		OS:       runtime.GOOS,
		Arch:     runtime.GOARCH,
		CPUCores: runtime.NumCPU(),
	}

	// TODO: Phase 2 - Collect actual OS version, kernel version, memory from OS-specific APIs
	fp.OSVersion = "unknown"
	fp.Kernel = "unknown"

	fp.MachineID = getMachineID()

	return fp, nil
}

// Enroll performs the agent enrollment with the server.
func Enroll(cfg *config.Config, tokenStr string) error {
	fp, err := CollectFingerprint()
	if err != nil {
		return fmt.Errorf("collect fingerprint: %w", err)
	}

	// Parse JWT without validating signature (we just need the claims to find the server address,
	// or we can just expect the server address to be passed in. Let's assume the token has a "server" claim).
	// If it doesn't, we'll try to connect to localhost:4222 as a fallback.
	serverAddr := "localhost:4222"
	token, _, _ := new(jwt.Parser).ParseUnverified(tokenStr, jwt.MapClaims{})
	if token != nil {
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if addr, ok := claims["server"].(string); ok {
				serverAddr = addr
			}
		}
	}

	// For enrollment, we use an insecure or trusting connection because we don't have the CA yet.
	// In a real production deployment, the initial enrollment might pin the expected CA hash
	// or use a secure bootstrap mechanism. For Phase 1, we use insecure connection to get the CA.
	conn, err := grpc.Dial(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return fmt.Errorf("failed to connect to server: %w", err)
	}
	defer conn.Close()

	client := pb.NewAgentEnrollmentServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req := &pb.EnrollmentRequest{
		Token: tokenStr,
		Fingerprint: &pb.SystemFingerprint{
			Hostname:    fp.Hostname,
			Os:          fp.OS,
			Arch:        fp.Arch,
			OsVersion:   fp.OSVersion,
			Kernel:      fp.Kernel,
			CpuCores:    uint32(fp.CPUCores),
			MemoryBytes: fp.MemoryBytes,
			MachineId:   fp.MachineID,
		},
		AgentVersion: "0.1.0-dev",
	}

	resp, err := client.Enroll(ctx, req)
	if err != nil {
		return fmt.Errorf("enrollment RPC failed: %w", err)
	}

	// Save certificates
	certDir := "/var/sentinel/certs"
	if err := os.MkdirAll(certDir, 0755); err != nil {
		return fmt.Errorf("failed to create cert dir: %w", err)
	}

	agentCertPath := fmt.Sprintf("%s/agent.crt", certDir)
	agentKeyPath := fmt.Sprintf("%s/agent.key", certDir)
	caCertPath := fmt.Sprintf("%s/ca.crt", certDir)

	if err := os.WriteFile(agentCertPath, resp.AgentCert, 0644); err != nil {
		return fmt.Errorf("failed to write agent cert: %w", err)
	}
	if err := os.WriteFile(agentKeyPath, resp.AgentKey, 0600); err != nil {
		return fmt.Errorf("failed to write agent key: %w", err)
	}
	if err := os.WriteFile(caCertPath, resp.CaCert, 0644); err != nil {
		return fmt.Errorf("failed to write CA cert: %w", err)
	}

	// Update config with server address
	cfg.ServerAddress = resp.ServerAddress
	// Normally we would write this back to sentinel-agent.yaml here.

	fmt.Printf("Successfully enrolled agent %s\n", resp.AgentId)
	return nil
}

// GetGRPCConn returns a secure mTLS gRPC connection to the server using the enrolled certificates.
func GetGRPCConn(cfg *config.Config) (*grpc.ClientConn, error) {
	agentCertPath := cfg.CertPath
	if agentCertPath == "" {
		agentCertPath = "/var/sentinel/certs/agent.crt"
	}
	agentKeyPath := cfg.KeyPath
	if agentKeyPath == "" {
		agentKeyPath = "/var/sentinel/certs/agent.key"
	}
	caCertPath := cfg.CACertPath
	if caCertPath == "" {
		caCertPath = "/var/sentinel/certs/ca.crt"
	}

	cert, err := tls.LoadX509KeyPair(agentCertPath, agentKeyPath)
	if err != nil {
		return nil, fmt.Errorf("load agent key pair: %w", err)
	}

	caCert, err := os.ReadFile(caCertPath)
	if err != nil {
		return nil, fmt.Errorf("load CA cert: %w", err)
	}

	caCertPool := x509.NewCertPool()
	caCertPool.AppendCertsFromPEM(caCert)

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      caCertPool,
	}

	creds := credentials.NewTLS(tlsConfig)
	return grpc.Dial(cfg.ServerAddress, grpc.WithTransportCredentials(creds))
}

func getMachineID() string {
	if data, err := os.ReadFile("/etc/machine-id"); err == nil {
		return string(data[:len(data)-1])
	}
	if data, err := os.ReadFile("/var/lib/dbus/machine-id"); err == nil {
		return string(data[:len(data)-1])
	}
	return uuid.New().String()
}
