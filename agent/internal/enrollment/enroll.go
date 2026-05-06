// Package enrollment handles the agent enrollment flow with the server.
package enrollment

import (
	"fmt"
	"os"
	"runtime"

	"github.com/google/uuid"
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

	// TODO: Collect OS version, kernel version, memory from OS-specific APIs
	// Linux: /etc/os-release, uname, /proc/meminfo
	// Windows: WMI
	// macOS: sw_vers, sysctl
	fp.OSVersion = "unknown"
	fp.Kernel = "unknown"

	// Machine ID
	fp.MachineID = getMachineID()

	return fp, nil
}

// Enroll performs the agent enrollment with the server.
func Enroll(serverAddr, token string) error {
	fp, err := CollectFingerprint()
	if err != nil {
		return fmt.Errorf("collect fingerprint: %w", err)
	}
	_ = fp

	// TODO Phase 1:
	// 1. Parse JWT token to extract server endpoint
	// 2. Establish temporary TLS connection (trust server cert for enrollment only)
	// 3. Send EnrollmentRequest with token + fingerprint
	// 4. Receive EnrollmentResponse with certs
	// 5. Store certs to disk
	// 6. Write agent config with server address and cert paths
	// 7. Return agent ID

	return fmt.Errorf("enrollment not yet implemented (Phase 1)")
}

func getMachineID() string {
	// Try Linux machine-id
	if data, err := os.ReadFile("/etc/machine-id"); err == nil {
		return string(data[:len(data)-1]) // trim newline
	}
	// Try macOS hardware UUID
	if data, err := os.ReadFile("/var/lib/dbus/machine-id"); err == nil {
		return string(data[:len(data)-1])
	}
	// Fallback: generate a UUID
	return uuid.New().String()
}
