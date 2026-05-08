package detection

// DefaultRules returns the built-in SIEM detection rules.
// These are standard rules that any SIEM should ship with out-of-the-box.
// They match against the syslog/auth.log/kern.log events that the Sentinel agent collects.
func DefaultRules() []Rule {
	return []Rule{
		// ─── Authentication & Access Rules ─────────────────────────────────

		{
			ID:          "rule-ssh-brute-force",
			Name:        "SSH Brute Force Attempt",
			Description: "Multiple failed SSH login attempts detected",
			Severity:    SevHigh,
			Enabled:     true,
			EventTypes:  []int32{4}, // LOG
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "Failed password"},
			},
			Tags:      []string{"T1110", "MITRE:Credential-Access", "SSH"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-ssh-invalid-user",
			Name:        "SSH Login with Invalid User",
			Description: "SSH login attempt using a non-existent username",
			Severity:    SevMedium,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "Invalid user"},
			},
			Tags:      []string{"T1078", "MITRE:Valid-Accounts", "SSH"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-ssh-root-login",
			Name:        "SSH Root Login",
			Description: "Direct root login via SSH detected",
			Severity:    SevCritical,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "Accepted"},
				{Field: "message", Operator: "contains", Value: "root"},
			},
			Tags:      []string{"T1078.003", "MITRE:Valid-Accounts", "SSH"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-ssh-accepted-publickey",
			Name:        "SSH Public Key Authentication",
			Description: "User logged in via SSH public key",
			Severity:    SevInfo,
			Enabled:     false, // Informational — disabled by default
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "Accepted publickey"},
			},
			Tags:      []string{"SSH", "authentication"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},

		// ─── Privilege Escalation Rules ────────────────────────────────────

		{
			ID:          "rule-sudo-failed",
			Name:        "Failed sudo Attempt",
			Description: "User attempted sudo and was denied",
			Severity:    SevHigh,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "NOT in sudoers"},
			},
			Tags:      []string{"T1548.003", "MITRE:Privilege-Escalation", "sudo"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-sudo-session-opened",
			Name:        "sudo Session Opened",
			Description: "A sudo session was opened (privilege escalation)",
			Severity:    SevLow,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "program", Operator: "equals", Value: "sudo"},
				{Field: "message", Operator: "contains", Value: "session opened"},
			},
			Tags:      []string{"T1548.003", "MITRE:Privilege-Escalation", "sudo"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-su-attempt",
			Name:        "su Command Used",
			Description: "User switch (su) command was used",
			Severity:    SevMedium,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "program", Operator: "equals", Value: "su"},
			},
			Tags:      []string{"T1548", "MITRE:Privilege-Escalation"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-auth-failure",
			Name:        "Authentication Failure",
			Description: "A generic authentication failure occurred",
			Severity:    SevMedium,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "authentication failure"},
			},
			Tags:      []string{"T1110", "MITRE:Credential-Access"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},

		// ─── Firewall & Network Rules ─────────────────────────────────────

		{
			ID:          "rule-ufw-block",
			Name:        "Firewall Blocked Connection",
			Description: "UFW/iptables blocked an incoming connection",
			Severity:    SevLow,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "[UFW BLOCK]"},
			},
			Tags:      []string{"T1071", "MITRE:Command-And-Control", "firewall"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-ufw-allow",
			Name:        "Firewall Allowed Connection",
			Description: "UFW/iptables explicitly allowed a connection",
			Severity:    SevInfo,
			Enabled:     false,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "[UFW ALLOW]"},
			},
			Tags:      []string{"firewall"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},

		// ─── System & Service Rules ───────────────────────────────────────

		{
			ID:          "rule-service-failed",
			Name:        "systemd Service Failed",
			Description: "A systemd service entered a failed state",
			Severity:    SevMedium,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "Failed to start"},
			},
			Tags:      []string{"T1489", "MITRE:Impact", "systemd"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-oom-killer",
			Name:        "OOM Killer Invoked",
			Description: "Kernel out-of-memory killer terminated a process",
			Severity:    SevHigh,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "Out of memory"},
			},
			Tags:      []string{"T1499", "MITRE:Impact", "kernel"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-kernel-segfault",
			Name:        "Process Segmentation Fault",
			Description: "A process crashed with a segfault (possible exploit attempt)",
			Severity:    SevMedium,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "segfault"},
			},
			Tags:      []string{"T1203", "MITRE:Execution", "kernel"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},

		// ─── Suspicious Activity Rules ────────────────────────────────────

		{
			ID:          "rule-cron-job-added",
			Name:        "Cron Job Modified",
			Description: "A crontab entry was added or modified (potential persistence)",
			Severity:    SevMedium,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "program", Operator: "equals", Value: "crontab"},
			},
			Tags:      []string{"T1053.003", "MITRE:Persistence", "cron"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-user-added",
			Name:        "New User Account Created",
			Description: "A new user account was added to the system",
			Severity:    SevHigh,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "new user:"},
			},
			Tags:      []string{"T1136", "MITRE:Persistence", "account"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-group-changed",
			Name:        "User Group Membership Changed",
			Description: "A user was added to or removed from a group",
			Severity:    SevMedium,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "program", Operator: "equals", Value: "usermod"},
			},
			Tags:      []string{"T1098", "MITRE:Persistence", "account"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
		{
			ID:          "rule-password-changed",
			Name:        "Password Changed",
			Description: "A user password was changed",
			Severity:    SevLow,
			Enabled:     true,
			EventTypes:  []int32{4},
			Conditions: []Condition{
				{Field: "message", Operator: "contains", Value: "password changed"},
			},
			Tags:      []string{"T1098", "MITRE:Persistence", "account"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},

		// ─── Process / Execution Rules ────────────────────────────────────

		{
			ID:          "rule-suspicious-process",
			Name:        "Suspicious Network Tool Executed",
			Description: "A reconnaissance or network tool (nmap, nc, ncat, masscan) was executed",
			Severity:    SevHigh,
			Enabled:     true,
			EventTypes:  []int32{1, 4}, // PROCESS or LOG
			Conditions: []Condition{
				{Field: "raw_data", Operator: "regex", Value: `(?i)\b(nmap|ncat|masscan|netcat)\b`},
			},
			Tags:      []string{"T1046", "MITRE:Discovery", "recon"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},

		// ─── File Integrity Rules ─────────────────────────────────────────

		{
			ID:          "rule-etc-modified",
			Name:        "Sensitive File Modified in /etc",
			Description: "A file in /etc was modified or deleted",
			Severity:    SevMedium,
			Enabled:     true,
			EventTypes:  []int32{2}, // FILE
			Conditions: []Condition{
				{Field: "file", Operator: "starts_with", Value: "/etc/"},
			},
			Tags:      []string{"T1565", "MITRE:Impact", "FIM"},
			CreatedAt: "2026-01-01T00:00:00Z",
			UpdatedAt: "2026-01-01T00:00:00Z",
		},
	}
}
