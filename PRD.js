const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
    PageNumber, LevelFormat, TabStopType, TabStopPosition, PageBreak
} = require('docx');
const fs = require('fs');

const BRAND = "0A2540";
const ACCENT = "0E7AFE";
const LIGHT = "E8F1FF";
const GRAY = "F5F7FA";
const WHITE = "FFFFFF";
const TEXT = "1A1A2E";

const border = { style: BorderStyle.SINGLE, size: 1, color: "D0D7E2" };
const borders = { top: border, bottom: border, left: border, right: border };

function h1(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 6 } },
        children: [new TextRun({ text, bold: true, size: 36, color: BRAND, font: "Arial" })]
    });
}

function h2(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
        children: [new TextRun({ text, bold: true, size: 28, color: BRAND, font: "Arial" })]
    });
}

function h3(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text, bold: true, size: 24, color: "2C5F8A", font: "Arial" })]
    });
}

function para(text, opts = {}) {
    return new Paragraph({
        spacing: { before: 60, after: 100 },
        children: [new TextRun({ text, size: 22, font: "Arial", color: TEXT, ...opts })]
    });
}

function bullet(text, level = 0) {
    return new Paragraph({
        numbering: { reference: "bullets", level },
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, size: 22, font: "Arial", color: TEXT })]
    });
}

function numbered(text, level = 0) {
    return new Paragraph({
        numbering: { reference: "numbers", level },
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, size: 22, font: "Arial", color: TEXT })]
    });
}

function note(label, text) {
    return new Paragraph({
        spacing: { before: 80, after: 80 },
        shading: { fill: LIGHT, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 16, color: ACCENT, space: 6 } },
        indent: { left: 240 },
        children: [
            new TextRun({ text: label + " ", bold: true, size: 21, font: "Arial", color: ACCENT }),
            new TextRun({ text, size: 21, font: "Arial", color: TEXT })
        ]
    });
}

function spacer(lines = 1) {
    return new Paragraph({ spacing: { before: 0, after: lines * 120 }, children: [new TextRun("")] });
}

function pageBreak() {
    return new Paragraph({ children: [new PageBreak()] });
}

function makeTable(headers, rows, colWidths) {
    const total = colWidths.reduce((a, b) => a + b, 0);
    return new Table({
        width: { size: total, type: WidthType.DXA },
        columnWidths: colWidths,
        rows: [
            new TableRow({
                tableHeader: true,
                children: headers.map((h, i) => new TableCell({
                    borders,
                    width: { size: colWidths[i], type: WidthType.DXA },
                    shading: { fill: BRAND, type: ShadingType.CLEAR },
                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 21, color: WHITE, font: "Arial" })] })]
                }))
            }),
            ...rows.map((row, ri) => new TableRow({
                children: row.map((cell, i) => new TableCell({
                    borders,
                    width: { size: colWidths[i], type: WidthType.DXA },
                    shading: { fill: ri % 2 === 0 ? WHITE : GRAY, type: ShadingType.CLEAR },
                    margins: { top: 80, bottom: 80, left: 140, right: 140 },
                    children: [new Paragraph({ children: [new TextRun({ text: cell, size: 21, font: "Arial", color: TEXT })] })]
                }))
            }))
        ]
    });
}

const doc = new Document({
    numbering: {
        config: [
            {
                reference: "bullets",
                levels: [{
                    level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 600, hanging: 300 } } }
                }, {
                    level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 1000, hanging: 300 } } }
                }]
            },
            {
                reference: "numbers",
                levels: [{
                    level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 600, hanging: 300 } } }
                }]
            }
        ]
    },
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            {
                id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 36, bold: true, font: "Arial", color: BRAND },
                paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 }
            },
            {
                id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 28, bold: true, font: "Arial", color: BRAND },
                paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 }
            },
            {
                id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 24, bold: true, font: "Arial", color: "2C5F8A" },
                paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 }
            },
        ]
    },
    sections: [{
        properties: {
            page: {
                size: { width: 12240, height: 15840 },
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
            }
        },
        children: [

            // ─── COVER ───────────────────────────────────────────────────
            spacer(4),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 200 },
                children: [new TextRun({ text: "SENTINEL", bold: true, size: 72, color: BRAND, font: "Arial" })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 160 },
                children: [new TextRun({ text: "Open-Source SIEM / XDR Platform", size: 30, color: "2C5F8A", font: "Arial" })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 4 } },
                spacing: { before: 0, after: 400 },
                children: [new TextRun({ text: "", size: 24 })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 80 },
                children: [new TextRun({ text: "Product Requirements Document", bold: true, size: 28, color: BRAND, font: "Arial" })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "Version 1.0  |  Confidential  |  2025", size: 22, color: "888888", font: "Arial" })]
            }),
            spacer(2),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Classification: Internal / Founding Team", size: 20, color: "888888", font: "Arial", italics: true })]
            }),

            pageBreak(),

            // ─── TECH STACK DECISION SUMMARY ─────────────────────────────
            h1("1. Tech Stack Decision Summary & Rationale"),
            para("Before the full requirements, this section captures the stack decisions made during discovery, along with the honest trade-offs accepted for each choice."),
            spacer(),

            h2("1.1 Server (Brain) — Go"),
            makeTable(
                ["Dimension", "Detail"],
                [
                    ["Language", "Go 1.22+"],
                    ["Pros", "Compiled binary, extremely low memory footprint, excellent concurrency via goroutines, easy cross-compilation, large open-source community"],
                    ["Cons", "Less mature ML ecosystem (offload ML to Python sidecar if needed); generics are newer and less idiomatic than Java"],
                    ["Decision rationale", "Best fit for a high-throughput event-processing server that needs to run efficiently on commodity hardware on-prem"],
                    ["Risk mitigation", "Use Python sidecar service (FastAPI) for any ML-based anomaly detection workloads; communicate via gRPC"],
                ],
                [2800, 6560]
            ),
            spacer(),

            h2("1.2 Agent — Go (Cross-Compiled)"),
            makeTable(
                ["Dimension", "Detail"],
                [
                    ["Language", "Go 1.22+"],
                    ["Target OS", "Linux (amd64, arm64), Windows (amd64), macOS (amd64, arm64)"],
                    ["Pros", "Single codebase, GOOS/GOARCH cross-compilation built-in, single static binary with no runtime deps, tiny footprint"],
                    ["Cons", "CGO must be disabled for true cross-compile (limits some syscall-level access); Windows kernel hooks require additional WDK wrappers"],
                    ["Decision rationale", "Cross-compilation ease was the stated top priority; Go delivers this out of the box better than any other language"],
                    ["Risk mitigation", "For deep Windows kernel telemetry, bundle a lightweight ETW (Event Tracing for Windows) helper via go-etw library"],
                ],
                [2800, 6560]
            ),
            spacer(),

            h2("1.3 Index / Data Store — OpenSearch"),
            makeTable(
                ["Dimension", "Detail"],
                [
                    ["Engine", "OpenSearch 2.x (Apache 2.0 licensed)"],
                    ["Pros", "Truly open source (Apache 2.0), AWS-backed so well-maintained, rich security analytics plugin ecosystem, full-text + aggregation queries, ISM policies for data retention automation"],
                    ["Cons", "Heavy JVM process — requires minimum 4GB RAM dedicated; slower for pure columnar analytics vs. ClickHouse; more ops overhead than Loki"],
                    ["Decision rationale", "Best fit for security log search (full-text, field queries, dashboards); ClickHouse would be faster for analytics but lacks the security plugin ecosystem"],
                    ["Risk mitigation", "Set JVM heap to 50% of available RAM; use ISM rollover + snapshot policies to manage disk; provide Docker Compose with pre-tuned JVM flags"],
                    ["Alternative considered", "ClickHouse — faster for time-series aggregations but lacks document search and Wazuh-style rule matching; revisit at >10K agents"],
                ],
                [2800, 6560]
            ),
            spacer(),

            h2("1.4 Dashboard — React"),
            makeTable(
                ["Dimension", "Detail"],
                [
                    ["Framework", "React 18 + TypeScript + Vite"],
                    ["UI library", "shadcn/ui + Tailwind CSS (fully customizable, no vendor lock-in)"],
                    ["Widget engine", "react-grid-layout (drag-and-drop, resizable panels)"],
                    ["Charts", "Recharts + Apache ECharts (for geo maps, heatmaps)"],
                    ["Pros", "Largest hiring pool, massive ecosystem, excellent TypeScript support, OpenSearch Dashboards (also React) for reference"],
                    ["Cons", "More boilerplate than SvelteKit; bundle size needs careful tree-shaking"],
                    ["Decision rationale", "Largest community = fastest open-source contributor onboarding, which matters for an open-source project"],
                ],
                [2800, 6560]
            ),
            spacer(),

            h2("1.5 Encryption — mTLS"),
            makeTable(
                ["Dimension", "Detail"],
                [
                    ["Protocol", "mTLS 1.3 (mutual TLS — both agent and server verify certificates)"],
                    ["CA model", "Each server deployment is its own CA; agent certs issued at enrollment time"],
                    ["Pros", "Industry standard, both sides authenticated, prevents rogue agents or rogue servers, well-supported in Go (crypto/tls)"],
                    ["Cons", "Certificate management complexity; need auto-rotation logic to avoid cert expiry incidents"],
                    ["Risk mitigation", "Auto-rotate certs 30 days before expiry; server dashboard alerts on expiring agent certs; include cert lifecycle in the automated setup"],
                ],
                [2800, 6560]
            ),
            spacer(),

            h2("1.6 Deployment — Docker Compose + Apache 2.0"),
            makeTable(
                ["Dimension", "Detail"],
                [
                    ["On-prem deployment", "Docker Compose v2 (single command spin-up of server + OpenSearch + dashboard)"],
                    ["License", "Apache 2.0 — fully permissive, anyone can fork commercially"],
                    ["License trade-off", "Others CAN build proprietary products on top without contributing back; accepted to maximize adoption"],
                    ["Cloud pricing", "Usage-based: per GB of events ingested per month (tiered rates)"],
                    ["Agent install methods", "All: curl one-liner, package manager (apt/yum/brew/winget), dashboard download"],
                ],
                [2800, 6560]
            ),

            pageBreak(),

            // ─── EXECUTIVE SUMMARY ───────────────────────────────────────
            h1("2. Executive Summary"),
            para("Sentinel is a fully open-source SIEM (Security Information & Event Management) and XDR (Extended Detection & Response) platform designed to outperform Wazuh in ease of deployment, agent footprint, dashboard usability, and XDR capability depth."),
            spacer(),
            para("The project has two delivery modes:"),
            bullet("Self-hosted (on-prem): Users deploy the full stack on their own infrastructure using Docker Compose. Completely free under Apache 2.0."),
            bullet("Cloud-managed (SaaS): Anthropic hosts the platform. Users pay usage-based pricing (per GB ingested) for managed infrastructure, automatic updates, and SLA-backed uptime."),
            spacer(),
            para("The mission is to make enterprise-grade security observability accessible to any organization — from a 5-person startup to a 500-person security team — without requiring a dedicated DevOps team to operate it."),

            spacer(),
            h2("2.1 Problem Statement"),
            para("Wazuh is the de facto open-source SIEM but it suffers from:"),
            bullet("Complex, multi-step manual installation with many failure points"),
            bullet("Heavy agent resource consumption"),
            bullet("Inflexible dashboard (OpenSearch Dashboards with limited drag-and-drop)"),
            bullet("Weak XDR capabilities — detection is strong, response is underdeveloped"),
            bullet("Poor onboarding UX — users must manually configure IP addresses, certificates, and indices"),
            bullet("No native cloud offering with transparent pricing for smaller teams"),

            spacer(),
            h2("2.2 Vision"),
            para("Sentinel will be the platform where any security engineer can run curl install.sentinel.io | bash on their server, and within 10 minutes have a fully operational, encrypted, agent-reporting SIEM — with a drag-and-drop dashboard already populated with live data."),

            pageBreak(),

            // ─── GOALS AND NON-GOALS ─────────────────────────────────────
            h1("3. Goals & Non-Goals"),
            h2("3.1 V1 Goals"),
            numbered("Zero-friction server deployment via Docker Compose — single command, fully automated"),
            numbered("Lightweight Go agent installable via curl, apt, yum, brew, or winget — auto-registers with server"),
            numbered("mTLS-encrypted agent-server communication with automated certificate lifecycle"),
            numbered("OpenSearch-backed indexing with pre-configured index templates, ISM retention policies"),
            numbered("React dashboard with drag-and-drop widget builder and pre-built security views"),
            numbered("XDR: Vulnerability Detection, Threat Intelligence (IOC), Behavioral Anomaly Detection, Network Traffic Analysis, Active Response"),
            numbered("User account system: register/login on sentinel.io, create ecosystems, generate agent enrollment tokens"),
            numbered("Lightweight marketing/documentation website with copy-paste install instructions"),
            numbered("Cloud SaaS mode with usage-based billing (per GB ingested)"),
            spacer(),
            h2("3.2 Non-Goals for V1"),
            bullet("SOAR (Security Orchestration, Automation, and Response) playbook engine — V2"),
            bullet("Kubernetes Helm chart deployment — V2"),
            bullet("Mobile app — V2"),
            bullet("Multi-tenancy within a single on-prem server — V2"),
            bullet("Deep SIEM correlation rules engine (like Sigma) — V2 (basic rules in V1)"),

            pageBreak(),

            // ─── SYSTEM ARCHITECTURE ─────────────────────────────────────
            h1("4. System Architecture"),
            h2("4.1 High-Level Component Map"),
            makeTable(
                ["Component", "Technology", "Role"],
                [
                    ["Sentinel Server", "Go 1.22+", "Core brain: receives agent events, runs detection rules, triggers responses, exposes REST + WebSocket API"],
                    ["Anomaly Engine", "Python 3.11 + FastAPI + scikit-learn", "ML sidecar for behavioral anomaly detection; communicates with server via gRPC"],
                    ["OpenSearch", "OpenSearch 2.x (JVM)", "Primary data store for events, alerts, and agent metadata; full-text + aggregation queries"],
                    ["Sentinel Dashboard", "React 18 + TypeScript + Vite", "Browser-based UI: drag-and-drop dashboards, alert management, agent management, rule editor"],
                    ["Sentinel Agent", "Go 1.22+ (CGO disabled)", "Deployed on monitored endpoints; collects telemetry, streams to server via mTLS"],
                    ["sentinel.io Website", "Next.js (static export)", "Public marketing site with install docs, user registration, ecosystem management, token generation"],
                    ["Cert Authority (internal)", "Go crypto/x509", "Embedded in server; issues and rotates mTLS certificates for agents"],
                    ["Message Queue (internal)", "NATS JetStream", "Durable queue between agent ingest and OpenSearch indexing; handles bursts, prevents data loss"],
                ],
                [2400, 2400, 4560]
            ),
            spacer(),

            h2("4.2 Data Flow"),
            numbered("Agent collects telemetry (file events, process events, network flows, OS metrics)"),
            numbered("Agent batches and compresses events, sends over mTLS to Server ingest endpoint (gRPC stream)"),
            numbered("Server validates agent certificate, decodes event batch, publishes to NATS JetStream"),
            numbered("Server rule engine consumes from NATS: matches detection rules, generates alerts"),
            numbered("Behavioral anomaly events routed to Python ML sidecar via gRPC; anomaly scores returned"),
            numbered("All events + alerts written to OpenSearch via bulk indexing"),
            numbered("Dashboard polls Server REST API for alerts; subscribes to Server WebSocket for real-time updates"),
            numbered("Active Response: Server sends response commands back to agent over persistent gRPC stream"),
            spacer(),

            note("Architecture Note:", "NATS JetStream is embedded (single binary, no separate deployment) for V1. This keeps Docker Compose simple while providing durable message delivery. If scale exceeds 5,000 events/sec, replace with Kafka in V2."),

            spacer(),
            h2("4.3 Network Topology"),
            makeTable(
                ["Connection", "Protocol", "Encryption", "Port"],
                [
                    ["Agent → Server (telemetry)", "gRPC (HTTP/2)", "mTLS 1.3", "4222 (configurable)"],
                    ["Server → Agent (commands)", "gRPC bidirectional stream", "mTLS 1.3", "Same connection"],
                    ["Dashboard → Server (API)", "REST + WebSocket", "TLS 1.3 (HTTPS)", "8443"],
                    ["Server → OpenSearch", "HTTPS REST", "TLS 1.3", "9200"],
                    ["Server → Anomaly Engine", "gRPC", "TLS (localhost)", "50051"],
                    ["Browser → Dashboard", "HTTPS", "TLS 1.3", "443"],
                ],
                [2600, 2000, 2000, 2760]
            ),

            pageBreak(),

            // ─── SERVER (BRAIN) ──────────────────────────────────────────
            h1("5. Sentinel Server — Detailed Requirements"),
            h2("5.1 Core Responsibilities"),
            bullet("Agent connection management: accept, authenticate, and maintain persistent gRPC connections from agents"),
            bullet("Event ingestion: receive, validate, decompress, and deserialize event batches from agents"),
            bullet("Detection rules engine: evaluate incoming events against a library of detection rules (YAML-based, Sigma-compatible subset)"),
            bullet("Alert management: generate, deduplicate, correlate, and prioritize alerts"),
            bullet("Active response: send response commands (kill process, block IP, isolate host, run script) back to specific agents"),
            bullet("REST API: expose endpoints consumed by the dashboard and external integrations"),
            bullet("WebSocket API: push real-time alert and agent status updates to connected dashboard sessions"),
            bullet("Certificate Authority: issue, store, rotate mTLS certs for agents on enrollment"),
            bullet("Threat intelligence: consume IOC feeds (IP, domain, file hash) and match against events"),
            bullet("Orchestration: coordinate with Anomaly Engine sidecar for behavioral scoring"),
            spacer(),

            h2("5.2 Agent Registration & Enrollment"),
            para("The enrollment flow must require ZERO manual IP input from the user:"),
            numbered("User logs into sentinel.io, navigates to their ecosystem, clicks 'Add Agent'"),
            numbered("Platform generates a single-use enrollment token (JWT, 24h expiry) bound to the user's server endpoint"),
            numbered("User copies the one-liner: curl -sL https://get.sentinel.io | SENTINEL_TOKEN=<token> bash"),
            numbered("Installer script: detects OS/arch, downloads correct agent binary, runs agent with token"),
            numbered("Agent sends enrollment request to server endpoint (embedded in token) with token + system fingerprint"),
            numbered("Server validates token, generates agent-specific mTLS certificate signed by its internal CA, returns cert + server CA cert"),
            numbered("Agent stores certs, establishes permanent mTLS gRPC connection, begins telemetry stream"),
            numbered("Dashboard shows agent as 'Active' within 30 seconds of enrollment"),
            spacer(),
            note("UX Requirement:", "The user must never be asked to type an IP address, server hostname, port number, or certificate path during agent enrollment. All of this is embedded in the enrollment token."),
            spacer(),

            h2("5.3 Detection Rules Engine"),
            bullet("Rules defined in YAML (Sigma-compatible subset for community interoperability)"),
            bullet("Rule fields: id, name, severity (critical/high/medium/low/info), description, condition, tags (MITRE ATT&CK), response_action"),
            bullet("Rule evaluation: per-event AND sliding-window correlation (e.g., 5 failed logins in 60 seconds)"),
            bullet("Default rule library: 200+ rules covering MITRE ATT&CK T1-T1600 range for Linux, Windows, macOS"),
            bullet("User-editable rules via dashboard rule editor (no YAML knowledge required — form-based)"),
            bullet("Hot-reload: rule changes apply without server restart"),
            spacer(),

            h2("5.4 Active Response Actions"),
            makeTable(
                ["Action", "Linux", "Windows", "macOS"],
                [
                    ["Kill Process", "SIGKILL via PID", "TerminateProcess()", "kill -9"],
                    ["Block IP (outbound)", "iptables DROP", "Windows Firewall rule", "pf rule"],
                    ["Block IP (inbound)", "iptables INPUT DROP", "Windows Firewall rule", "pf rule"],
                    ["Isolate Host (network)", "iptables default DROP (allow only server)", "Firewall isolate policy", "pf isolate"],
                    ["Run Custom Script", "bash script execution", "PowerShell execution", "bash/zsh execution"],
                    ["Quarantine File", "Move to /var/sentinel/quarantine", "Move to C:\\Sentinel\\Quarantine", "Move to /var/sentinel/quarantine"],
                ],
                [2800, 2100, 2100, 2360]
            ),

            pageBreak(),

            // ─── AGENT ───────────────────────────────────────────────────
            h1("6. Sentinel Agent — Detailed Requirements"),
            h2("6.1 Design Principles"),
            bullet("Single static binary — no runtime dependencies, no interpreters"),
            bullet("Target: <30MB RAM, <2% CPU on idle, <5% CPU during active collection"),
            bullet("CGO disabled (GOFLAGS=-CGO_ENABLED=0) for true cross-compilation"),
            bullet("Supports graceful degradation — if server unreachable, buffers events locally (up to configurable disk limit) and replays on reconnect"),
            spacer(),

            h2("6.2 Telemetry Modules"),
            makeTable(
                ["Module", "Linux", "Windows", "macOS", "Default"],
                [
                    ["Process Events", "auditd / eBPF", "ETW (go-etw)", "OpenBSM / ES", "ON"],
                    ["File Integrity (FIM)", "inotify", "ReadDirectoryChangesW", "FSEvents", "ON"],
                    ["Network Flows", "conntrack / eBPF", "WFP / ETW", "pflog / ES", "ON"],
                    ["Log Collection", "syslog, journald, file tail", "Windows Event Log", "syslog, unified log", "ON"],
                    ["OS Metrics", "procfs", "WMI / PDH", "sysctl / procfs", "ON"],
                    ["Vulnerability Scan", "dpkg/rpm/apk DB + CVE feed", "WMI installed software + CVE", "brew/port + CVE", "OFF (scheduled)"],
                    ["Container Events", "Docker / containerd API", "Docker Desktop API", "Docker Desktop API", "OFF"],
                ],
                [2200, 1800, 1800, 1600, 960]
            ),
            spacer(),

            h2("6.3 Installation Methods"),
            h3("Method 1 — One-liner (recommended)"),
            new Paragraph({
                spacing: { before: 60, after: 100 },
                shading: { fill: "1A1A2E", type: ShadingType.CLEAR },
                children: [new TextRun({ text: "curl -sL https://get.sentinel.io | SENTINEL_TOKEN=<token> bash", font: "Courier New", size: 20, color: "00D4AA" })]
            }),
            spacer(),
            h3("Method 2 — Package Manager"),
            bullet("Debian/Ubuntu: apt install sentinel-agent (via custom APT repo at pkg.sentinel.io)"),
            bullet("RHEL/CentOS/Fedora: yum install sentinel-agent (via custom YUM repo)"),
            bullet("macOS: brew install sentinel/tap/sentinel-agent"),
            bullet("Windows: winget install Sentinel.Agent"),
            spacer(),
            h3("Method 3 — Manual Binary Download"),
            bullet("User downloads pre-built binary from dashboard or GitHub Releases"),
            bullet("Runs: sentinel-agent --token=<token> --install (registers as system service)"),
            spacer(),
            note("Automation Requirement:", "All three methods must result in the agent running as a system service (systemd on Linux, Windows Service, launchd on macOS) with auto-start on boot, without any additional user configuration."),

            spacer(),
            h2("6.4 Local Buffering & Resilience"),
            bullet("If server is unreachable: buffer events to local disk (default 500MB, configurable)"),
            bullet("Buffer format: compressed, append-only log segments (similar to WAL)"),
            bullet("On reconnect: replay buffered events in order, then switch to live streaming"),
            bullet("If disk buffer full: drop oldest events first, emit a warning alert on reconnect"),

            pageBreak(),

            // ─── XDR FEATURES ────────────────────────────────────────────
            h1("7. XDR Feature Requirements"),
            h2("7.1 Vulnerability Detection"),
            bullet("Agent runs scheduled scan (default: daily at 2am local time) of installed packages"),
            bullet("Compares against NVD (NIST) CVE database + vendor advisories"),
            bullet("CVE database synced by server from NVD JSON feeds; agents do not hit NVD directly"),
            bullet("Dashboard shows: CVE ID, CVSS score, affected package, fix version, affected agents"),
            bullet("Alerts generated for CVSS >= 7.0 (High) automatically; threshold configurable"),
            bullet("Export vulnerability report as PDF or CSV from dashboard"),
            spacer(),

            h2("7.2 Threat Intelligence (IOC Matching)"),
            bullet("Server maintains IOC database: IP addresses, domains, file hashes (MD5/SHA256), URLs"),
            bullet("Default feeds (auto-synced daily): AlienVault OTX, Abuse.ch, Emerging Threats"),
            bullet("User can upload custom IOC lists (CSV/STIX format) via dashboard"),
            bullet("Agent streams DNS queries, outbound connections, and file hashes to server"),
            bullet("Server matches in-flight events against IOC database (Bloom filter + exact match)"),
            bullet("IOC match generates Critical alert immediately; active response can auto-block"),
            spacer(),

            h2("7.3 Behavioral Analysis & Anomaly Detection"),
            bullet("Python ML sidecar (FastAPI + scikit-learn) receives event feature vectors from server"),
            bullet("Models: Isolation Forest (anomaly detection), statistical baselines per agent per time-window"),
            bullet("Baseline learning period: 7 days after agent enrollment before anomaly alerts fire"),
            bullet("Anomaly score (0.0 - 1.0) attached to every event; alerts fire at score >= 0.85 (configurable)"),
            bullet("Dashboard shows anomaly timeline per agent: what deviated, by how much, when"),
            bullet("Model retrained weekly on rolling 30-day window; server hot-swaps model without restart"),
            spacer(),

            h2("7.4 Network Traffic Analysis"),
            bullet("Agent captures network flow metadata (5-tuple: src IP, dst IP, src port, dst port, protocol)"),
            bullet("Agent does NOT capture packet payloads — metadata only (privacy-safe by design)"),
            bullet("Server detects: port scans, lateral movement patterns, beaconing (regular outbound intervals), large data exfiltration (volume anomaly)"),
            bullet("Network topology map in dashboard: visualizes agent-to-agent and agent-to-external connections"),
            bullet("Alert on first-seen external IP per agent (with IOC enrichment)"),
            spacer(),

            h2("7.5 Active Response Engine"),
            bullet("Response actions can be triggered: automatically by rule, manually from dashboard, or via REST API"),
            bullet("Response audit log: every action recorded with who triggered it, when, and outcome"),
            bullet("Approval workflow (optional): require a second user to approve Active Response actions"),
            bullet("Response timeout: if agent does not confirm action within 30 seconds, alert is raised"),
            bullet("Rollback support: un-isolate host, unblock IP, un-quarantine file — all reversible from dashboard"),

            pageBreak(),

            // ─── DASHBOARD ───────────────────────────────────────────────
            h1("8. Dashboard — Detailed Requirements"),
            h2("8.1 Core Views"),
            makeTable(
                ["View", "Description"],
                [
                    ["Overview", "Executive summary: total agents, active alerts by severity, top threats, events/sec graph"],
                    ["Alerts", "Alert feed with filters (severity, agent, rule, time range); bulk acknowledge/close; alert detail drawer"],
                    ["Agents", "Agent inventory: OS, version, last seen, status, tags; click-through to agent detail page"],
                    ["Agent Detail", "Per-agent: events timeline, active alerts, installed packages, network connections, FIM changes, anomaly score graph"],
                    ["Threat Intelligence", "IOC database management; feed sync status; custom IOC upload; IOC match history"],
                    ["Vulnerabilities", "CVE list with CVSS scores; filter by agent/severity/package; export report"],
                    ["Network Map", "Interactive topology map of agent connections; color-coded by alert status"],
                    ["Rules", "Detection rule library; enable/disable; create/edit rules with form-based editor; import Sigma YAML"],
                    ["Active Response", "Response action history; manual trigger; approval queue (if enabled)"],
                    ["My Dashboards", "Drag-and-drop widget builder: create, save, share custom dashboard layouts"],
                    ["Settings", "Server config, index retention, notification channels, user management, API keys"],
                ],
                [2600, 6760]
            ),
            spacer(),

            h2("8.2 Drag-and-Drop Widget Builder"),
            bullet("Powered by react-grid-layout: widgets can be dragged, resized, and dropped in a freeform grid"),
            bullet("Widget library: bar chart, line chart, pie chart, stat card, alert feed, agent list, geo map, heatmap, data table, text/markdown"),
            bullet("Each widget is configured with: data source (OpenSearch query or server API), time range, filters, visualization type"),
            bullet("Dashboards saved per-user and optionally shared across the team"),
            bullet("Dashboard JSON export/import for sharing between Sentinel installations"),
            bullet("Pre-built dashboard templates: SOC Overview, Executive Report, Endpoint Security, Network Security, Compliance"),
            spacer(),

            h2("8.3 Real-Time Updates"),
            bullet("WebSocket connection to server for: new alerts, agent status changes, active response outcomes"),
            bullet("Alert badge in navigation updates in real-time without page refresh"),
            bullet("Agent 'last seen' timestamp updates live"),
            bullet("Events/sec counter on Overview updates every 5 seconds"),
            spacer(),

            h2("8.4 Notification Channels"),
            bullet("Email (SMTP configuration)"),
            bullet("Slack (webhook)"),
            bullet("PagerDuty (API key)"),
            bullet("Webhook (generic HTTP POST — for custom integrations)"),
            bullet("Notification rules: filter by severity, agent group, rule tag before sending"),

            pageBreak(),

            // ─── WEBSITE & ONBOARDING ────────────────────────────────────
            h1("9. sentinel.io Website & User Onboarding"),
            h2("9.1 Website Purpose"),
            para("The sentinel.io website serves two distinct functions: (1) a lightweight marketing and documentation site for the open-source project, and (2) the account portal for users who want to use the cloud-managed service or manage their self-hosted ecosystem tokens."),
            spacer(),

            h2("9.2 Website Pages"),
            makeTable(
                ["Page", "Content"],
                [
                    ["/ (Home)", "Hero section, value prop vs. Wazuh, quick-start code snippet, GitHub stars, pricing CTA"],
                    ["/docs/server", "Server installation guide with copy-paste Docker Compose command"],
                    ["/docs/agent", "Agent installation guide for all OS; auto-detects visitor OS for the right snippet"],
                    ["/docs/dashboard", "Dashboard setup; screenshots; first-login walkthrough"],
                    ["/docs/api", "REST API reference (auto-generated from OpenAPI spec)"],
                    ["/pricing", "Free (self-hosted) vs. Cloud tiers; GB/month calculator"],
                    ["/register", "Account registration (email + password, or GitHub OAuth)"],
                    ["/login", "Login page"],
                    ["/app/ecosystems", "User's ecosystems: create new, view existing, manage agents"],
                    ["/app/ecosystems/:id", "Ecosystem detail: server status, agent count, enrollment token generator, billing usage"],
                ],
                [2400, 6960]
            ),
            spacer(),

            h2("9.3 Ecosystem & Token Management"),
            numbered("User registers on sentinel.io"),
            numbered("User creates an 'Ecosystem' (named deployment, e.g. 'Production Infra')"),
            numbered("Platform provisions ecosystem record, assigns unique server endpoint (cloud) or stores user's server URL (self-hosted)"),
            numbered("User clicks 'Generate Enrollment Token' — single-use token created, valid 24 hours"),
            numbered("User copies the one-liner install command (token embedded)"),
            numbered("Token auto-expires after first use or 24 hours, whichever comes first"),
            numbered("User can see all enrolled agents, their status, and revoke individual agents"),
            spacer(),

            h2("9.4 Website Tech Stack"),
            bullet("Framework: Next.js 14 (App Router) with static export for docs pages"),
            bullet("Styling: Tailwind CSS — clean, minimal, fast-loading"),
            bullet("Auth: NextAuth.js (email/password + GitHub OAuth)"),
            bullet("No heavy dependencies — target <150KB JS bundle for the marketing pages"),
            bullet("Docs: MDX files (Markdown + React components) — community can contribute via GitHub PR"),
            bullet("Hosted: Vercel (free tier sufficient for V1 traffic)"),

            pageBreak(),

            // ─── OPENEARCH CONFIGURATION ─────────────────────────────────
            h1("10. OpenSearch Configuration Requirements"),
            h2("10.1 Index Design"),
            makeTable(
                ["Index Pattern", "Data", "Retention Default"],
                [
                    ["sentinel-events-YYYY.MM.DD", "Raw agent telemetry events", "90 days"],
                    ["sentinel-alerts-YYYY.MM.DD", "Generated alerts with enrichment", "365 days"],
                    ["sentinel-agents", "Agent metadata and status (no time-series)", "Permanent"],
                    ["sentinel-ioc", "IOC database (IP, domain, hash)", "Permanent (versioned)"],
                    ["sentinel-vuln-YYYY.MM", "Vulnerability scan results", "12 months"],
                    ["sentinel-audit", "Active response audit log", "365 days"],
                ],
                [3200, 3600, 2560]
            ),
            spacer(),

            h2("10.2 Automated Configuration"),
            bullet("Server applies all index templates automatically on first start via OpenSearch API"),
            bullet("ISM (Index State Management) policies auto-applied for rollover and deletion"),
            bullet("No manual OpenSearch configuration required from the user"),
            bullet("Index templates include: field mappings, shard count (1 primary for V1 small scale), refresh interval (5s for performance)"),
            bullet("Dashboard connects to OpenSearch via server proxy API — users never need to configure OpenSearch credentials in the dashboard"),

            pageBreak(),

            // ─── SECURITY & COMPLIANCE ───────────────────────────────────
            h1("11. Security Requirements"),
            h2("11.1 mTLS Certificate Lifecycle"),
            bullet("Server runs an embedded Certificate Authority (CA) using Go crypto/x509"),
            bullet("Agent certs: 1-year validity; server auto-renews 30 days before expiry"),
            bullet("CA cert: 10-year validity; stored encrypted on server disk"),
            bullet("Cert renewal: transparent to user — agent receives new cert via existing gRPC connection"),
            bullet("Dashboard shows cert expiry status per agent; alerts 7 days before expiry"),
            spacer(),

            h2("11.2 Secrets Management"),
            bullet("All secrets (CA private key, OpenSearch password, JWT signing key) stored encrypted at rest using AES-256-GCM"),
            bullet("Encryption key derived from a machine-specific secret on first boot (stored in Docker volume)"),
            bullet("No secrets in environment variables (Docker Compose uses Docker secrets or encrypted config file)"),
            bullet("API keys for dashboard access: scoped (read-only vs. admin), revocable, with last-used timestamp"),
            spacer(),

            h2("11.3 Dashboard Authentication"),
            bullet("JWT-based session (access token: 1h, refresh token: 7d)"),
            bullet("MFA support: TOTP (Google Authenticator, Authy) — optional in V1, enforced option in settings"),
            bullet("Role-based access control (RBAC): Admin, Analyst, Read-Only"),
            bullet("Brute-force protection: account lockout after 10 failed login attempts"),

            pageBreak(),

            // ─── DEPLOYMENT ──────────────────────────────────────────────
            h1("12. Deployment & Installation"),
            h2("12.1 On-Prem Server — Docker Compose"),
            para("The entire Sentinel server stack (server, OpenSearch, anomaly engine, dashboard) is deployed via a single Docker Compose file. The user runs one command:"),
            new Paragraph({
                spacing: { before: 60, after: 100 },
                shading: { fill: "1A1A2E", type: ShadingType.CLEAR },
                children: [new TextRun({ text: "curl -sL https://install.sentinel.io/server | bash", font: "Courier New", size: 20, color: "00D4AA" })]
            }),
            spacer(),
            para("This script:"),
            numbered("Checks Docker + Docker Compose are installed (installs if missing with user permission)"),
            numbered("Downloads docker-compose.yml + config templates to /opt/sentinel/"),
            numbered("Generates strong random passwords for OpenSearch and JWT signing"),
            numbered("Generates the server's internal CA keypair"),
            numbered("Writes .env file with all generated values"),
            numbered("Runs docker compose up -d"),
            numbered("Waits for health checks to pass on all services"),
            numbered("Prints dashboard URL and initial admin credentials"),
            spacer(),
            note("UX Requirement:", "The user is NOT asked for any input during installation. All values are auto-generated. Estimated time from running the command to a working dashboard: under 5 minutes on a 4GB RAM machine with a fast internet connection."),
            spacer(),

            h2("12.2 Minimum System Requirements (On-Prem Server)"),
            makeTable(
                ["Component", "Minimum", "Recommended"],
                [
                    ["CPU", "2 vCPUs", "4 vCPUs"],
                    ["RAM", "4 GB", "8 GB"],
                    ["Disk", "40 GB SSD", "100 GB SSD"],
                    ["OS", "Any Linux with Docker 24+", "Ubuntu 22.04 LTS"],
                    ["Network", "Agents must reach port 4222; users reach port 443", "Dedicated server NIC"],
                ],
                [3200, 2800, 3360]
            ),
            spacer(),

            h2("12.3 Cloud SaaS Deployment"),
            bullet("Sentinel operates a multi-region cloud deployment (AWS initially: us-east-1, eu-west-1, ap-south-1)"),
            bullet("User selects region at ecosystem creation time"),
            bullet("Agents connect to regional server endpoint — latency optimized"),
            bullet("OpenSearch cluster managed by Sentinel team (AWS OpenSearch Service)"),
            bullet("Automated backups, patching, and scaling — no user action required"),

            pageBreak(),

            // ─── PRICING ─────────────────────────────────────────────────
            h1("13. Cloud Pricing Model"),
            h2("13.1 Pricing Philosophy"),
            para("Usage-based pricing (per GB of events ingested per month) aligns cost with actual usage. Small teams pay almost nothing; large teams pay proportionally. This model also makes Sentinel competitive against Datadog Security, which charges per host."),
            spacer(),

            h2("13.2 Pricing Tiers"),
            makeTable(
                ["Tier", "Price", "Includes", "Target"],
                [
                    ["Free (Self-Hosted)", "$0 forever", "Full platform, open source, community support", "Developers, small teams, POC"],
                    ["Cloud Starter", "$0 / first 10 GB/mo\nthen $0.40/GB", "1 year retention, email support, 5 users", "Small teams <50 agents"],
                    ["Cloud Growth", "$0.30/GB after first 50 GB/mo", "1 year retention, Slack support, 25 users, SSO", "Mid-size teams 50-500 agents"],
                    ["Cloud Enterprise", "Custom (negotiate)", "Custom retention, SLA 99.9%, dedicated support, SAML, RBAC", "500+ agents, compliance needs"],
                ],
                [2000, 2200, 3200, 1960]
            ),
            spacer(),
            note("Profitability Note:", "At $0.40/GB with AWS OpenSearch Service costing ~$0.10/GB (storage) and ~$0.05/GB (compute/ingest), gross margin is ~60% on Starter. Growth tier compresses to ~50% margin at volume but brings larger ACV. Enterprise contracts should target $0.20/GB minimum with volume commitments."),
            spacer(),

            h2("13.3 Usage Metering"),
            bullet("Server counts compressed bytes received from agents per ecosystem per month"),
            bullet("Metering happens at the server ingest layer — before decompression (agent pays for what it sends, not what OpenSearch stores)"),
            bullet("Dashboard shows real-time GB usage vs. plan limit with projection for the month"),
            bullet("Alert at 80% and 100% of plan limit; auto-upgrade prompt (not auto-charge)"),

            pageBreak(),

            // ─── PHASED ROADMAP ──────────────────────────────────────────
            h1("14. Phased Delivery Roadmap"),
            makeTable(
                ["Phase", "Duration", "Deliverables"],
                [
                    ["Phase 0 — Foundation", "Weeks 1-4", "Repo setup, Go module structure, Docker Compose skeleton, CI/CD pipeline (GitHub Actions), OpenSearch bootstrap, mTLS CA implementation"],
                    ["Phase 1 — Agent MVP", "Weeks 5-10", "Go agent: process events, FIM, log collection, mTLS enrollment flow, one-liner install script, apt/yum packages"],
                    ["Phase 2 — Server MVP", "Weeks 11-16", "Server: event ingest, NATS queue, detection rules engine (basic), alert generation, REST API, OpenSearch indexing"],
                    ["Phase 3 — Dashboard MVP", "Weeks 17-22", "React dashboard: Overview, Alerts, Agents, basic widget builder, real-time WebSocket, user auth"],
                    ["Phase 4 — XDR V1", "Weeks 23-30", "Vulnerability detection, IOC matching, anomaly engine (Python sidecar), network traffic analysis, active response"],
                    ["Phase 5 — Website & Cloud", "Weeks 31-36", "sentinel.io website, user registration, ecosystem management, token system, Stripe billing, cloud SaaS deployment"],
                    ["Phase 6 — Polish & OSS Launch", "Weeks 37-40", "Docs, community CONTRIBUTING guide, GitHub launch, HackerNews / ProductHunt, macOS + Windows agent hardening"],
                ],
                [2200, 1600, 5560]
            ),

            pageBreak(),

            // ─── SUCCESS METRICS ─────────────────────────────────────────
            h1("15. Success Metrics"),
            makeTable(
                ["Metric", "V1 Target", "Measurement"],
                [
                    ["Server installation time", "< 5 minutes", "From curl command to working dashboard"],
                    ["Agent enrollment time", "< 2 minutes", "From one-liner to agent appearing in dashboard"],
                    ["Agent CPU usage (idle)", "< 2%", "Measured on 2-vCPU machine"],
                    ["Agent RAM usage", "< 30 MB", "Measured on Linux/Windows/macOS"],
                    ["Event ingest latency", "< 5 seconds", "Agent event → visible in dashboard"],
                    ["Alert detection latency", "< 10 seconds", "IOC match or rule match → alert in dashboard"],
                    ["Dashboard load time", "< 2 seconds", "First Contentful Paint on Overview page"],
                    ["GitHub stars (3 months post-launch)", "1,000+", "GitHub API"],
                    ["Cloud paying customers (6 months)", "50+", "Stripe dashboard"],
                    ["Agent enrollment success rate", ">= 99%", "Enrollment attempts vs. successes"],
                ],
                [3200, 2000, 4160]
            ),

            pageBreak(),

            // ─── OPEN SOURCE STRATEGY ────────────────────────────────────
            h1("16. Open Source Strategy"),
            h2("16.1 License"),
            para("Apache 2.0. This maximizes adoption and community contribution. The accepted trade-off: competitors can fork and build proprietary products. The moat is the cloud service, not the code — move fast, build a better hosted product."),
            spacer(),
            h2("16.2 Repository Structure"),
            bullet("github.com/sentinel-io/sentinel — monorepo"),
            bullet("/ server — Go server"),
            bullet("/ agent — Go agent"),
            bullet("/ dashboard — React app"),
            bullet("/ anomaly-engine — Python ML sidecar"),
            bullet("/ deploy — Docker Compose files, Helm charts (V2)"),
            bullet("/ docs — MDX documentation (synced to sentinel.io/docs)"),
            bullet("/ rules — Default detection rule library (YAML)"),
            bullet("/ ioc-feeds — Default IOC feed configurations"),
            spacer(),
            h2("16.3 Community"),
            bullet("CONTRIBUTING.md with clear guide for adding detection rules, agent modules, and dashboard widgets"),
            bullet("GitHub Issues for bug tracking; Discussions for feature requests"),
            bullet("Discord server for community support"),
            bullet("Maintainer response SLA on issues: 48 hours for bugs, 1 week for features"),

            pageBreak(),

            // ─── APPENDIX ────────────────────────────────────────────────
            h1("Appendix A — Glossary"),
            makeTable(
                ["Term", "Definition"],
                [
                    ["Agent", "Lightweight Go binary deployed on a monitored endpoint (server, laptop, VM, container host)"],
                    ["Server (Brain)", "Central Go service that receives agent data, runs detection, and serves the API"],
                    ["Ecosystem", "A named deployment instance: one server + N agents + one OpenSearch cluster"],
                    ["mTLS", "Mutual TLS — both the client (agent) and server present and verify certificates"],
                    ["IOC", "Indicator of Compromise — a known-bad IP, domain, file hash, or URL"],
                    ["FIM", "File Integrity Monitoring — detecting unauthorized changes to files"],
                    ["XDR", "Extended Detection and Response — correlates data across endpoints, network, and cloud"],
                    ["ISM", "Index State Management — OpenSearch lifecycle policies for rollover and deletion"],
                    ["Active Response", "Automated or manual security actions sent from server to agent (block IP, kill process, etc.)"],
                    ["NATS JetStream", "Embedded durable message queue used between agent ingest and OpenSearch indexing"],
                ],
                [2400, 6960]
            ),
            spacer(),

            h1("Appendix B — Risk Register"),
            makeTable(
                ["Risk", "Likelihood", "Impact", "Mitigation"],
                [
                    ["OpenSearch RAM pressure on small servers", "High", "Medium", "Pre-tuned JVM flags in Docker Compose; warn if <4GB detected"],
                    ["mTLS cert expiry causing agent disconnection", "Medium", "High", "Auto-renewal 30 days before; dashboard alerts 7 days before"],
                    ["Go agent ETW issues on Windows", "Medium", "Medium", "Use go-etw library; fallback to WMI for process events"],
                    ["Apache 2.0 fork by competitor", "Low", "Low", "Accepted trade-off; cloud service is the moat"],
                    ["ML anomaly engine false positive storm", "Medium", "Medium", "7-day baseline learning period; anomaly threshold configurable; snooze per-agent"],
                    ["Cloud cost overrun on free tier abuse", "Medium", "High", "Rate limit: max 5 GB/mo free on cloud; self-hosted unlimited"],
                ],
                [2600, 1400, 1400, 3960]
            ),
        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync('/StrawHatPRD.docx', buf);
    console.log('Done');
});