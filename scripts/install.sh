#!/bin/bash
set -e

# Sentinel Agent One-Liner Installer
# Usage: curl -sL https://sentinel.io/install.sh | sudo bash -s -- --token <TOKEN>

echo "🛡️  Sentinel SIEM/XDR Agent Installer"
echo "--------------------------------------"

# Parse arguments
TOKEN=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [ -z "$TOKEN" ]; then
  echo "Error: --token is required."
  exit 1
fi

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root."
  exit 1
fi

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$ARCH" = "x86_64" ]; then
  ARCH="amd64"
elif [ "$ARCH" = "aarch64" ]; then
  ARCH="arm64"
else
  echo "Unsupported architecture: $ARCH"
  exit 1
fi

if [ "$OS" != "linux" ]; then
  echo "Unsupported OS: $OS. This script supports Linux."
  exit 1
fi

echo "[1/4] Downloading Sentinel Agent for $OS/$ARCH..."
# In a real scenario, this URL would point to the release artifacts
# URL="https://github.com/sentinel-io/sentinel/releases/latest/download/sentinel-agent-${OS}-${ARCH}.tar.gz"
# curl -sL "$URL" | tar -xz -C /usr/local/bin

# Placeholder download for Phase 1 MVP
mkdir -p /opt/sentinel/bin
echo "Simulating download... (Phase 1 MVP)"
# For local testing, we assume the binary is already built or will be copied
# Resolve project root relative to script location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/agent/sentinel-agent" ]; then
    # Stop the service if it's running to prevent "Text file busy" error
    systemctl stop sentinel-agent 2>/dev/null || true
    rm -f /opt/sentinel/bin/sentinel-agent
    cp "$PROJECT_ROOT/agent/sentinel-agent" /opt/sentinel/bin/sentinel-agent
    chmod +x /opt/sentinel/bin/sentinel-agent
elif [ -f "/opt/sentinel/bin/sentinel-agent" ] && [ -s "/opt/sentinel/bin/sentinel-agent" ]; then
    echo "Using existing agent binary at /opt/sentinel/bin/sentinel-agent"
else
    echo "Creating dummy binary for testing..."
    touch /opt/sentinel/bin/sentinel-agent
    chmod +x /opt/sentinel/bin/sentinel-agent
fi


echo "[2/4] Enrolling agent with server..."
/opt/sentinel/bin/sentinel-agent --token "$TOKEN" --install

echo "[3/4] Creating systemd service..."
cat << 'EOF' > /etc/systemd/system/sentinel-agent.service
[Unit]
Description=Sentinel SIEM/XDR Agent
After=network.target

[Service]
ExecStart=/opt/sentinel/bin/sentinel-agent
Restart=always
RestartSec=5
User=root
WorkingDirectory=/opt/sentinel

[Install]
WantedBy=multi-user.target
EOF

echo "[4/4] Starting agent service..."
systemctl daemon-reload
systemctl enable --now sentinel-agent

echo "--------------------------------------"
echo "✅ Installation complete! The agent is now enrolled and running."
