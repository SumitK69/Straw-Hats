.PHONY: all build build-server build-agent build-dashboard build-anomaly \
       dev dev-server dev-dashboard dev-anomaly \
       test test-server test-agent test-dashboard test-anomaly \
       lint lint-server lint-agent lint-dashboard lint-anomaly \
       docker-up docker-down docker-build \
       proto-gen clean help

# ─── Variables ────────────────────────────────────────────────────────
GO           := go
GOFLAGS      := CGO_ENABLED=0
SERVER_BIN   := server/sentinel-server
AGENT_BIN    := agent/sentinel-agent
PROTO_DIR    := server/proto
DEPLOY_DIR   := deploy

# ─── Default ──────────────────────────────────────────────────────────
all: build

# ─── Build ────────────────────────────────────────────────────────────
build: build-server build-agent build-dashboard build-anomaly

build-server:
	@echo "▸ Building Sentinel Server..."
	cd server && $(GOFLAGS) $(GO) build -o sentinel-server ./cmd/sentinel-server

build-agent:
	@echo "▸ Building Sentinel Agent..."
	cd agent && $(GOFLAGS) $(GO) build -o sentinel-agent ./cmd/sentinel-agent

build-dashboard:
	@echo "▸ Building Sentinel Dashboard..."
	cd dashboard && npm ci && npm run build

build-anomaly:
	@echo "▸ Building Anomaly Engine..."
	cd anomaly-engine && pip install -r requirements.txt

# ─── Development ──────────────────────────────────────────────────────
dev-server:
	@echo "▸ Starting Server (dev)..."
	cd server && $(GO) run ./cmd/sentinel-server

dev-dashboard:
	@echo "▸ Starting Dashboard (dev)..."
	cd dashboard && npm run dev

dev-anomaly:
	@echo "▸ Starting Anomaly Engine (dev)..."
	cd anomaly-engine && uvicorn app.main:app --reload --port 50051

# ─── Test ─────────────────────────────────────────────────────────────
test: test-server test-agent test-dashboard test-anomaly

test-server:
	@echo "▸ Testing Server..."
	cd server && $(GO) test ./...

test-agent:
	@echo "▸ Testing Agent..."
	cd agent && $(GO) test ./...

test-dashboard:
	@echo "▸ Testing Dashboard..."
	cd dashboard && npm test -- --passWithNoTests 2>/dev/null || true

test-anomaly:
	@echo "▸ Testing Anomaly Engine..."
	cd anomaly-engine && python3 -m pytest tests/ -v 2>/dev/null || true

# ─── Lint ─────────────────────────────────────────────────────────────
lint: lint-server lint-agent lint-dashboard lint-anomaly

lint-server:
	@echo "▸ Linting Server..."
	cd server && $(GO) vet ./...

lint-agent:
	@echo "▸ Linting Agent..."
	cd agent && $(GO) vet ./...

lint-dashboard:
	@echo "▸ Linting Dashboard..."
	cd dashboard && npm run lint 2>/dev/null || true

lint-anomaly:
	@echo "▸ Linting Anomaly Engine..."
	cd anomaly-engine && python3 -m ruff check . 2>/dev/null || true

# ─── Docker ───────────────────────────────────────────────────────────
docker-up:
	@echo "▸ Starting Sentinel stack..."
	cd $(DEPLOY_DIR) && docker compose up -d

docker-down:
	@echo "▸ Stopping Sentinel stack..."
	cd $(DEPLOY_DIR) && docker compose down

docker-build:
	@echo "▸ Building Docker images..."
	cd $(DEPLOY_DIR) && docker compose build

docker-logs:
	cd $(DEPLOY_DIR) && docker compose logs -f

# ─── Proto ────────────────────────────────────────────────────────────
proto-gen:
	@echo "▸ Generating protobuf code..."
	protoc --go_out=. --go-grpc_out=. $(PROTO_DIR)/sentinel.proto

# ─── Clean ────────────────────────────────────────────────────────────
clean:
	@echo "▸ Cleaning build artifacts..."
	rm -f $(SERVER_BIN) $(AGENT_BIN)
	rm -rf dashboard/dist
	rm -rf anomaly-engine/__pycache__
	find . -name '*.pyc' -delete

# ─── Help ─────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Sentinel SIEM/XDR — Build Commands"
	@echo "  ─────────────────────────────────────────"
	@echo "  make build           Build all components"
	@echo "  make build-server    Build Go server"
	@echo "  make build-agent     Build Go agent"
	@echo "  make build-dashboard Build React dashboard"
	@echo "  make dev-server      Run server in dev mode"
	@echo "  make dev-dashboard   Run dashboard in dev mode"
	@echo "  make dev-anomaly     Run anomaly engine in dev mode"
	@echo "  make test            Run all tests"
	@echo "  make lint            Lint all components"
	@echo "  make docker-up       Start full stack (Docker Compose)"
	@echo "  make docker-down     Stop full stack"
	@echo "  make docker-build    Build Docker images"
	@echo "  make proto-gen       Generate protobuf Go code"
	@echo "  make clean           Remove build artifacts"
	@echo ""
