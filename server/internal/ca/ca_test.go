package ca

import (
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"

	"github.com/sentinel-io/sentinel/server/internal/config"
)

func testConfig(t *testing.T) config.CAConfig {
	t.Helper()
	dir := t.TempDir()
	return config.CAConfig{
		CertDir:          dir,
		CAValidityDays:   3650,
		CertValidityDays: 365,
		RenewalDays:      30,
		KeyAlgorithm:     "ecdsa-p256",
	}
}

func TestNewCA_GeneratesKeypair(t *testing.T) {
	cfg := testConfig(t)
	ca, err := New(cfg)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}
	if ca.CACertPEM() == nil {
		t.Fatal("CA cert PEM is nil")
	}
	// Verify files exist on disk
	if !fileExists(filepath.Join(cfg.CertDir, "ca.key")) {
		t.Fatal("ca.key not written to disk")
	}
	if !fileExists(filepath.Join(cfg.CertDir, "ca.crt")) {
		t.Fatal("ca.crt not written to disk")
	}
}

func TestNewCA_LoadsExisting(t *testing.T) {
	cfg := testConfig(t)
	ca1, _ := New(cfg)
	cert1 := ca1.CACertPEM()

	ca2, err := New(cfg)
	if err != nil {
		t.Fatalf("New() reload error: %v", err)
	}
	cert2 := ca2.CACertPEM()
	if string(cert1) != string(cert2) {
		t.Fatal("Reloaded CA cert differs from original")
	}
}

func TestIssueCert(t *testing.T) {
	cfg := testConfig(t)
	ca, _ := New(cfg)

	certPEM, keyPEM, caCertPEM, err := ca.IssueCert("test-agent-001", "fp-abc123")
	if err != nil {
		t.Fatalf("IssueCert() error: %v", err)
	}
	if len(certPEM) == 0 || len(keyPEM) == 0 || len(caCertPEM) == 0 {
		t.Fatal("IssueCert() returned empty PEM")
	}

	// Parse and validate agent cert
	block, _ := pem.Decode(certPEM)
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatalf("Failed to parse agent cert: %v", err)
	}
	if cert.Subject.CommonName != "agent-test-agent-001" {
		t.Fatalf("Unexpected CN: %s", cert.Subject.CommonName)
	}

	// Verify cert is signed by CA
	caBlock, _ := pem.Decode(caCertPEM)
	caCert, _ := x509.ParseCertificate(caBlock.Bytes)
	pool := x509.NewCertPool()
	pool.AddCert(caCert)
	_, err = cert.Verify(x509.VerifyOptions{Roots: pool, KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}})
	if err != nil {
		t.Fatalf("Agent cert verification failed: %v", err)
	}
}

func TestNeedsRenewal(t *testing.T) {
	cfg := testConfig(t)
	ca, _ := New(cfg)

	// Issue a cert and check — should not need renewal (365 day validity, 30 day threshold)
	certPEM, _, _, _ := ca.IssueCert("renewal-test", "fp")
	block, _ := pem.Decode(certPEM)
	cert, _ := x509.ParseCertificate(block.Bytes)
	if ca.NeedsRenewal(cert) {
		t.Fatal("Fresh cert should not need renewal")
	}
}

func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
