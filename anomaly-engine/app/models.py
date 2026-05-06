"""
Anomaly detection model wrapper using scikit-learn Isolation Forest.
"""

import numpy as np
from sklearn.ensemble import IsolationForest
from datetime import datetime


class AnomalyModel:
    """Wraps an Isolation Forest model for anomaly scoring."""

    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        self.model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=100,
            max_samples="auto",
        )
        self.is_trained = False
        self.trained_at: datetime | None = None
        self.feature_names: list[str] = []

    def train(self, features: np.ndarray, feature_names: list[str]) -> None:
        """Train the model on a feature matrix.

        Args:
            features: (n_samples, n_features) array
            feature_names: list of feature column names
        """
        self.model.fit(features)
        self.is_trained = True
        self.trained_at = datetime.utcnow()
        self.feature_names = feature_names

    def score(self, features: np.ndarray) -> float:
        """Score a single event. Returns 0.0 (normal) to 1.0 (anomalous).

        Isolation Forest returns scores where -1 = anomaly, 1 = normal.
        We normalize to 0.0 - 1.0 range.
        """
        if not self.is_trained:
            return 0.0

        raw_score = self.model.decision_function(features.reshape(1, -1))[0]
        # Normalize: decision_function returns values centered around 0
        # More negative = more anomalous
        normalized = max(0.0, min(1.0, 0.5 - raw_score))
        return float(normalized)

    def is_anomaly(self, features: np.ndarray, threshold: float = 0.85) -> bool:
        """Check if an event is anomalous based on threshold."""
        return self.score(features) >= threshold
