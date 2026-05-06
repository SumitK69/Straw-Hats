<div align="center">

# 🛡️ SENTINEL

### Open-Source SIEM / XDR Platform

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)](https://golang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![OpenSearch](https://img.shields.io/badge/OpenSearch-2.x-005EB8)](https://opensearch.org)

**Enterprise-grade security observability for everyone.**

[Quick Start](#-quick-start) • [Architecture](#-architecture) • [Dashboard](#-dashboard) • [Contributing](#contributing)

</div>

---

## ✨ What is Sentinel?

Sentinel is a fully open-source **SIEM** (Security Information & Event Management) and **XDR** (Extended Detection & Response) platform designed for modern security teams. Deploy in under 5 minutes. Monitor everything.

### Why Sentinel?

| Feature | Wazuh | Sentinel |
|---|---|---|
| **Deployment** | Multi-step, manual | Single command (`docker compose up`) |
| **Agent footprint** | Heavy | <30MB RAM, <2% CPU |
| **Dashboard** | Basic OpenSearch Dashboards | Drag-and-drop widget builder |
| **XDR response** | Limited | Kill process, block IP, isolate host, quarantine |
| **Agent enrollment** | Manual IP/cert config | Zero-config token enrollment |
| **Cloud offering** | No | Usage-based SaaS |

## 🚀 Quick Start

### Server (Docker Compose)
```bash
cd deploy
cp .env.example .env
docker compose up -d
```

### Agent (One-liner)
```bash
curl -sL https://get.sentinel.io | SENTINEL_TOKEN=<token> bash
```

### Dashboard
Open `http://localhost:3000` after server starts.

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Sentinel Stack                     │
├────────────┬────────────┬──────────┬─────────────────┤
│   Server   │ OpenSearch │ Dashboard│ Anomaly Engine  │
│   (Go)     │   (JVM)   │ (React)  │ (Python/ML)     │
│            │           │          │                  │
│ gRPC :4222 │   :9200   │   :3000  │    :50051       │
└─────┬──────┴───────────┴──────────┴─────────────────┘
      │ mTLS
┌─────┴──────────────────────────────────────────────┐
│              Agents (Go, cross-compiled)            │
│         Linux · Windows · macOS · Docker            │
└────────────────────────────────────────────────────┘
```

### Tech Stack
- **Server**: Go 1.22+ with embedded NATS JetStream
- **Agent**: Go (CGO_ENABLED=0, single static binary)
- **Dashboard**: React 18 + TypeScript + Vite
- **Data Store**: OpenSearch 2.x
- **ML Engine**: Python 3.11 + FastAPI + scikit-learn
- **Encryption**: mTLS 1.3 with embedded CA

## 📦 Repository Structure

```
sentinel/
├── server/           # Go server (brain)
├── agent/            # Go agent (lightweight endpoint collector)
├── dashboard/        # React dashboard (drag-and-drop widgets)
├── anomaly-engine/   # Python ML sidecar (Isolation Forest)
├── deploy/           # Docker Compose deployment
├── rules/            # Detection rules (YAML, Sigma-compatible)
├── ioc-feeds/        # Threat intelligence feed configs
├── docs/             # Architecture documentation
└── .github/          # CI/CD pipelines
```

## 🔐 Security Features

- **mTLS everywhere** — agent-server communication is mutually authenticated
- **Embedded CA** — server acts as its own Certificate Authority (ECDSA P-256)
- **Zero-config enrollment** — agents enroll with a single token, no IP/cert setup
- **Active Response** — kill processes, block IPs, isolate hosts, quarantine files
- **Threat Intel** — IOC matching against AlienVault OTX, Abuse.ch, Emerging Threats
- **Anomaly Detection** — ML-based behavioral analysis with Isolation Forest

## 📊 Dashboard

The Sentinel Dashboard provides:
- **Overview** — executive summary with key metrics
- **Alerts** — filterable alert feed with bulk actions
- **Agents** — inventory with status, OS, and drill-down
- **Rules** — detection rule editor (form-based, no YAML required)
- **Threat Intel** — IOC database management
- **Vulnerabilities** — CVE scanner with CVSS scores
- **Custom Dashboards** — drag-and-drop widget builder

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

Apache 2.0 — see [LICENSE](LICENSE).
