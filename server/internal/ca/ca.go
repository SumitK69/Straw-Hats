// Package ca implements the embedded Certificate Authority for Sentinel.
package ca

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/sentinel-io/sentinel/server/internal/config"
)

// CertAuthority manages the server's internal CA and issues agent certificates.
type CertAuthority struct {
	mu      sync.RWMutex
	caCert  *x509.Certificate
	caKey   *ecdsa.PrivateKey
	certDir string
	config  config.CAConfig
}

// New creates or loads an existing Certificate Authority.
func New(cfg config.CAConfig) (*CertAuthority, error) {
	ca := &CertAuthority{certDir: cfg.CertDir, config: cfg}
	if err := os.MkdirAll(cfg.CertDir, 0700); err != nil {
		return nil, fmt.Errorf("create cert dir: %w", err)
	}
	keyPath := filepath.Join(cfg.CertDir, "ca.key")
	certPath := filepath.Join(cfg.CertDir, "ca.crt")
	if fileExists(keyPath) && fileExists(certPath) {
		return ca, ca.loadCA(keyPath, certPath)
	}
	return ca, ca.generateCA(keyPath, certPath)
}

func (c *CertAuthority) generateCA(keyPath, certPath string) error {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}
	sn, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	tmpl := &x509.Certificate{
		SerialNumber:          sn,
		Subject:               pkix.Name{Organization: []string{"Sentinel"}, CommonName: "Sentinel Internal CA"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().AddDate(0, 0, c.config.CAValidityDays),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
		MaxPathLen:            1,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return err
	}
	cert, _ := x509.ParseCertificate(der)
	kb, _ := x509.MarshalECPrivateKey(key)
	if err := writePEM(keyPath, "EC PRIVATE KEY", kb, 0600); err != nil {
		return err
	}
	if err := writePEM(certPath, "CERTIFICATE", der, 0644); err != nil {
		return err
	}
	c.mu.Lock()
	c.caCert, c.caKey = cert, key
	c.mu.Unlock()
	return nil
}

func (c *CertAuthority) loadCA(keyPath, certPath string) error {
	keyPEM, _ := os.ReadFile(keyPath)
	kb, _ := pem.Decode(keyPEM)
	key, err := x509.ParseECPrivateKey(kb.Bytes)
	if err != nil {
		return err
	}
	certPEM, _ := os.ReadFile(certPath)
	cb, _ := pem.Decode(certPEM)
	cert, err := x509.ParseCertificate(cb.Bytes)
	if err != nil {
		return err
	}
	c.mu.Lock()
	c.caCert, c.caKey = cert, key
	c.mu.Unlock()
	return nil
}

// IssueCert generates a new TLS certificate for an agent signed by the CA.
func (c *CertAuthority) IssueCert(agentID, fingerprint string) (certPEM, keyPEM, caCertPEM []byte, err error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.caCert == nil {
		return nil, nil, nil, fmt.Errorf("CA not initialized")
	}
	agentKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	sn, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	tmpl := &x509.Certificate{
		SerialNumber: sn,
		Subject:      pkix.Name{Organization: []string{"Sentinel"}, CommonName: fmt.Sprintf("agent-%s", agentID)},
		DNSNames:     []string{fmt.Sprintf("agent-%s.sentinel.local", agentID)},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().AddDate(0, 0, c.config.CertValidityDays),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, c.caCert, &agentKey.PublicKey, c.caKey)
	if err != nil {
		return nil, nil, nil, err
	}
	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	akb, _ := x509.MarshalECPrivateKey(agentKey)
	keyPEM = pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: akb})
	caCertPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: c.caCert.Raw})
	return
}

// CACertPEM returns the PEM-encoded CA certificate.
func (c *CertAuthority) CACertPEM() []byte {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.caCert == nil {
		return nil
	}
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: c.caCert.Raw})
}

// NeedsRenewal checks if a certificate needs renewal.
func (c *CertAuthority) NeedsRenewal(cert *x509.Certificate) bool {
	return cert.NotAfter.Before(time.Now().AddDate(0, 0, c.config.RenewalDays))
}

func writePEM(path, typ string, data []byte, perm os.FileMode) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, perm)
	if err != nil {
		return err
	}
	defer f.Close()
	return pem.Encode(f, &pem.Block{Type: typ, Bytes: data})
}

func fileExists(p string) bool { _, err := os.Stat(p); return err == nil }
