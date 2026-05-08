// Package config handles server configuration loading from YAML files
// and environment variables.
package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all server configuration.
type Config struct {
	GRPCPort   int              `mapstructure:"grpc_port"`
	RESTPort   int              `mapstructure:"rest_port"`
	CA         CAConfig         `mapstructure:"ca"`
	OpenSearch OpenSearchConfig `mapstructure:"opensearch"`
	NATS       NATSConfig       `mapstructure:"nats"`
	JWT        JWTConfig        `mapstructure:"jwt"`
	LogLevel   string           `mapstructure:"log_level"`
	RulesDir   string           `mapstructure:"rules_dir"`
}

// CAConfig holds Certificate Authority settings.
type CAConfig struct {
	CertDir          string `mapstructure:"cert_dir"`           // directory to store CA and agent certs
	CAValidityDays   int    `mapstructure:"ca_validity_days"`   // default: 3650 (10 years)
	CertValidityDays int    `mapstructure:"cert_validity_days"` // default: 365 (1 year)
	RenewalDays      int    `mapstructure:"renewal_days"`       // renew N days before expiry (default: 30)
	KeyAlgorithm     string `mapstructure:"key_algorithm"`      // "ecdsa-p256" or "rsa-4096"
}

// OpenSearchConfig holds OpenSearch connection settings.
type OpenSearchConfig struct {
	Addresses  []string `mapstructure:"addresses"`
	Username   string   `mapstructure:"username"`
	Password   string   `mapstructure:"password"`
	TLSEnabled bool     `mapstructure:"tls_enabled"`
	CACertPath string   `mapstructure:"ca_cert_path"`
}

// NATSConfig holds embedded NATS JetStream settings.
type NATSConfig struct {
	URL       string `mapstructure:"url"`
	Embedded  bool   `mapstructure:"embedded"`   // use embedded NATS server
	DataDir   string `mapstructure:"data_dir"`   // JetStream storage directory
	MaxMemory int64  `mapstructure:"max_memory"` // max memory for JetStream (bytes)
}

// JWTConfig holds JWT authentication settings.
type JWTConfig struct {
	SigningKey      string `mapstructure:"signing_key"`
	AccessTokenTTL  string `mapstructure:"access_token_ttl"`  // default: "1h"
	RefreshTokenTTL string `mapstructure:"refresh_token_ttl"` // default: "168h" (7 days)
}

// Load reads configuration from sentinel-server.yaml and environment variables.
// Environment variables are prefixed with SENTINEL_ and use underscores.
// e.g., SENTINEL_GRPC_PORT=4222
func Load() (*Config, error) {
	v := viper.New()

	// Defaults
	v.SetDefault("grpc_port", 4222)
	v.SetDefault("rest_port", 8443)
	v.SetDefault("log_level", "info")

	// CA defaults
	v.SetDefault("ca.cert_dir", "/var/sentinel/certs")
	v.SetDefault("ca.ca_validity_days", 3650)
	v.SetDefault("ca.cert_validity_days", 365)
	v.SetDefault("ca.renewal_days", 30)
	v.SetDefault("ca.key_algorithm", "ecdsa-p256")

	// OpenSearch defaults
	v.SetDefault("opensearch.addresses", []string{"https://localhost:9200"})
	v.SetDefault("opensearch.username", "admin")
	v.SetDefault("opensearch.password", "admin")
	v.SetDefault("opensearch.tls_enabled", true)

	// NATS defaults
	v.SetDefault("nats.embedded", true)
	v.SetDefault("nats.url", "nats://localhost:4223")
	v.SetDefault("nats.data_dir", "/var/sentinel/nats")
	v.SetDefault("nats.max_memory", 1073741824) // 1GB

	// JWT defaults
	v.SetDefault("jwt.access_token_ttl", "1h")
	v.SetDefault("jwt.refresh_token_ttl", "168h")

	// Rules directory
	v.SetDefault("rules_dir", "/var/sentinel/rules/sigma")

	// Config file
	v.SetConfigName("sentinel-server")
	v.SetConfigType("yaml")
	v.AddConfigPath("/etc/sentinel/")
	v.AddConfigPath(".")

	// Environment variables
	v.SetEnvPrefix("SENTINEL")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Read config file (optional — env vars and defaults are fine)
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
		// Config file not found is okay — use defaults + env vars
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	return &cfg, nil
}
