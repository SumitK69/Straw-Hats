// Package config handles agent configuration.
package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all agent configuration.
type Config struct {
	ServerAddress string        `mapstructure:"server_address"` // gRPC endpoint
	AgentID       string        `mapstructure:"agent_id"`
	CertPath      string        `mapstructure:"cert_path"`      // mTLS cert
	KeyPath       string        `mapstructure:"key_path"`       // mTLS key
	CACertPath    string        `mapstructure:"ca_cert_path"`   // Server CA cert
	BufferDir     string        `mapstructure:"buffer_dir"`     // local event buffer
	BufferMaxMB   int           `mapstructure:"buffer_max_mb"`  // max buffer size (default: 500)
	Modules       ModuleConfig  `mapstructure:"modules"`
	LogLevel      string        `mapstructure:"log_level"`
}

// ModuleConfig toggles for telemetry modules (PRD Section 6.2).
type ModuleConfig struct {
	ProcessEvents    bool `mapstructure:"process_events"`    // default: true
	FileIntegrity    bool `mapstructure:"file_integrity"`    // default: true
	NetworkFlows     bool `mapstructure:"network_flows"`     // default: true
	LogCollection    bool `mapstructure:"log_collection"`    // default: true
	OSMetrics        bool `mapstructure:"os_metrics"`        // default: true
	VulnerabilityScan bool `mapstructure:"vulnerability_scan"` // default: false
	ContainerEvents  bool `mapstructure:"container_events"`  // default: false
}

// Load reads agent configuration from file and environment variables.
func Load(configPath string) (*Config, error) {
	v := viper.New()

	v.SetDefault("server_address", "localhost:4222")
	v.SetDefault("buffer_dir", "/var/sentinel/buffer")
	v.SetDefault("buffer_max_mb", 500)
	v.SetDefault("log_level", "info")
	v.SetDefault("modules.process_events", true)
	v.SetDefault("modules.file_integrity", true)
	v.SetDefault("modules.network_flows", true)
	v.SetDefault("modules.log_collection", true)
	v.SetDefault("modules.os_metrics", true)
	v.SetDefault("modules.vulnerability_scan", false)
	v.SetDefault("modules.container_events", false)

	v.SetConfigName("sentinel-agent")
	v.SetConfigType("yaml")
	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		v.AddConfigPath("/etc/sentinel/")
		v.AddConfigPath(".")
	}

	v.SetEnvPrefix("SENTINEL_AGENT")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("read config: %w", err)
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}
	return &cfg, nil
}
