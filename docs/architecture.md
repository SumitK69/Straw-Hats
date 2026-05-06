# Architecture Overview

## System Architecture

```mermaid
graph TB
    subgraph Endpoints
        A1["Agent (Linux)"]
        A2["Agent (Windows)"]
        A3["Agent (macOS)"]
    end

    subgraph Server Stack
        S["Sentinel Server (Go)"]
        N["NATS JetStream (embedded)"]
        OS["OpenSearch"]
        AE["Anomaly Engine (Python)"]
    end

    subgraph User Interface
        D["Dashboard (React)"]
        W["sentinel.io (Next.js)"]
    end

    A1 -->|"mTLS gRPC"| S
    A2 -->|"mTLS gRPC"| S
    A3 -->|"mTLS gRPC"| S

    S -->|publish| N
    N -->|consume| S
    S -->|"bulk index"| OS
    S -->|"gRPC score"| AE

    D -->|"REST + WebSocket"| S
    D -->|"query"| OS
    W -->|"API"| S

    S -->|"commands"| A1
    S -->|"commands"| A2
    S -->|"commands"| A3
```

## Data Flow

```mermaid
sequenceDiagram
    participant Agent
    participant Server
    participant NATS
    participant Rules
    participant OpenSearch
    participant Dashboard

    Agent->>Server: EventBatch (gRPC stream, mTLS)
    Server->>Server: Validate cert, decode batch
    Server->>NATS: Publish events
    NATS->>Rules: Consume events
    Rules->>Rules: Evaluate detection rules
    Rules->>OpenSearch: Index events + alerts
    Rules->>Dashboard: Push alerts (WebSocket)
    Dashboard->>Server: REST API queries
    Server->>Agent: Commands (bidirectional gRPC)
```

## Network Topology

| Connection | Protocol | Encryption | Port |
|---|---|---|---|
| Agent → Server (telemetry) | gRPC (HTTP/2) | mTLS 1.3 | 4222 |
| Server → Agent (commands) | gRPC bidirectional | mTLS 1.3 | Same |
| Dashboard → Server (API) | REST + WebSocket | TLS 1.3 | 8443 |
| Server → OpenSearch | HTTPS REST | TLS 1.3 | 9200 |
| Server → Anomaly Engine | gRPC | TLS | 50051 |
| Browser → Dashboard | HTTPS | TLS 1.3 | 443 |

## Component Details

### Sentinel Server (Go)
- Event ingestion via gRPC
- Detection rules engine (YAML-based, Sigma-compatible)
- Embedded Certificate Authority (ECDSA P-256)
- REST + WebSocket API for dashboard
- Embedded NATS JetStream for message queuing

### Sentinel Agent (Go)
- Single static binary, CGO_ENABLED=0
- Target: <30MB RAM, <2% CPU idle
- Modules: process events, FIM, network flows, logs, metrics
- Local event buffering (WAL-style, 500MB default)
- Auto-enrollment with zero manual configuration

### Dashboard (React + TypeScript)
- Vite-based React 18 application
- Drag-and-drop widget builder (react-grid-layout)
- Real-time updates via WebSocket
- Dark theme by default

### Anomaly Engine (Python + FastAPI)
- Isolation Forest model for behavioral anomaly detection
- 7-day baseline learning period
- Anomaly score 0.0 - 1.0 (alert at >= 0.85)
- Weekly model retraining on 30-day rolling window

### OpenSearch
- Primary data store for events, alerts, agent metadata
- Pre-configured index templates and ISM policies
- 90-day event retention, 365-day alert retention
