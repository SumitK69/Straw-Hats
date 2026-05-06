# Contributing to Sentinel

Thank you for your interest in contributing to Sentinel! This guide will help you get started.

## Development Setup

### Prerequisites
- **Go 1.22+** — [Install Go](https://golang.org/dl/)
- **Node.js 20+** — [Install Node.js](https://nodejs.org/)
- **Python 3.11+** — [Install Python](https://python.org/)
- **Docker + Docker Compose v2** — [Install Docker](https://docs.docker.com/get-docker/)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/sentinel-io/sentinel.git
cd sentinel

# Build everything
make build

# Or start the full stack with Docker
make docker-up

# Run all tests
make test
```

### Component-Specific Development

#### Server (Go)
```bash
cd server
go test ./...           # Run tests
go run ./cmd/sentinel-server  # Run in dev mode
```

#### Agent (Go)
```bash
cd agent
go test ./...
go run ./cmd/sentinel-agent --version
```

#### Dashboard (React)
```bash
cd dashboard
npm install
npm run dev    # Start dev server on localhost:5173
```

#### Anomaly Engine (Python)
```bash
cd anomaly-engine
pip install -r requirements.txt
uvicorn app.main:app --reload --port 50051
```

## Contributing Areas

### Detection Rules
The easiest way to contribute! Add YAML rules in `/rules/examples/`:
1. Follow the schema in `/rules/schema.yaml`
2. Include MITRE ATT&CK tags
3. Add a clear description of what the rule detects
4. Test against sample event data

### Agent Modules
Add new telemetry collectors in `/agent/internal/collector/`:
1. Implement the `Collector` interface
2. Support Linux, Windows, and macOS where applicable
3. Keep resource usage minimal

### Dashboard Widgets
Add new widget types in `/dashboard/src/components/widgets/`:
1. Each widget is a React component
2. Must be compatible with react-grid-layout
3. Include responsive styling

## Code Style

- **Go**: Follow standard Go formatting (`gofmt`, `go vet`)
- **TypeScript**: ESLint + Prettier
- **Python**: Ruff for linting, Black for formatting

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Write tests for new functionality
4. Ensure `make test` passes
5. Submit a PR with a clear description

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
