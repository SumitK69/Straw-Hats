"""
Sentinel Anomaly Engine — FastAPI + scikit-learn ML sidecar.

This service receives event feature vectors from the Sentinel Server
via gRPC, scores them using Isolation Forest anomaly detection, and
returns anomaly scores (0.0 - 1.0).

Design decisions (from PRD Section 7.3):
- Models: Isolation Forest for anomaly detection
- Baseline learning period: 7 days after agent enrollment
- Anomaly alerts fire at score >= 0.85 (configurable)
- Model retrained weekly on rolling 30-day window
"""

from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(
    title="Sentinel Anomaly Engine",
    description="ML sidecar for behavioral anomaly detection",
    version="0.1.0",
)


class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
    last_trained: datetime | None = None


class EventFeatures(BaseModel):
    agent_id: str
    event_type: str
    features: dict[str, float]
    timestamp: datetime


class AnomalyScore(BaseModel):
    agent_id: str
    score: float  # 0.0 (normal) to 1.0 (anomalous)
    is_anomaly: bool
    details: str


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        model_loaded=False,
        last_trained=None,
    )


@app.post("/score", response_model=AnomalyScore)
async def score_event(event: EventFeatures):
    """Score an event for anomaly detection.

    In Phase 4, this will use a trained Isolation Forest model.
    For now, returns a placeholder score.
    """
    # TODO Phase 4: Load trained model and score event features
    return AnomalyScore(
        agent_id=event.agent_id,
        score=0.0,
        is_anomaly=False,
        details="Model not yet trained — baseline learning period",
    )


@app.post("/train")
async def train_model():
    """Trigger model retraining on recent data.

    In Phase 4, this will:
    1. Fetch 30 days of event features from OpenSearch
    2. Train Isolation Forest model
    3. Hot-swap the active model
    """
    return {"status": "not_implemented", "message": "Model training — Phase 4"}
