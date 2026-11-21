"""
Base model class for StockSense AI.
Defines the interface for all ML models.
"""

import logging
import joblib
import numpy as np
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class BaseModel(ABC):
    """Abstract base class for all prediction models."""

    def __init__(self, name: str, **kwargs):
        self.name = name
        self.params = kwargs
        self.model = None
        self.scaler = None
        self.feature_names: List[str] = []
        self.is_trained = False
        self.training_history: Dict[str, Any] = {}

    @abstractmethod
    def build_model(self, **kwargs) -> Any:
        """Build and return the model instance."""
        pass

    @abstractmethod
    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Train the model."""
        pass

    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions."""
        pass

    def predict_with_uncertainty(self, X: np.ndarray, n_samples: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        """
        Make predictions with uncertainty estimation.
        Default implementation uses simple bootstrap for tree-based models.
        """
        preds = []
        for _ in range(n_samples):
            # Bootstrap sample
            idx = np.random.choice(len(X), len(X), replace=True)
            X_boot = X[idx]
            preds.append(self.predict(X_boot))

        preds = np.array(preds)
        mean_pred = preds.mean(axis=0)
        std_pred = preds.std(axis=0)
        return mean_pred, std_pred

    def evaluate(
        self,
        X_test: np.ndarray,
        y_test: np.ndarray,
    ) -> Dict[str, float]:
        """Evaluate model on test data."""
        y_pred = self.predict(X_test)

        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)

        # MAPE (handle division by zero)
        mask = np.abs(y_test) > 1e-8
        mape = np.mean(np.abs((y_test[mask] - y_pred[mask]) / y_test[mask])) * 100 if mask.any() else np.inf

        # Directional accuracy
        dir_acc = np.mean((y_test > 0) == (y_pred > 0)) * 100

        return {
            "mae": float(mae),
            "rmse": float(rmse),
            "r2": float(r2),
            "mape": float(mape),
            "directional_accuracy": float(dir_acc),
        }

    def save(self, path: str) -> None:
        """Save model to disk."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        save_dict = {
            "name": self.name,
            "params": self.params,
            "model": self.model,
            "scaler": self.scaler,
            "feature_names": self.feature_names,
            "is_trained": self.is_trained,
            "training_history": self.training_history,
        }
        joblib.dump(save_dict, path)
        logger.info(f"Model saved to {path}")

    def load(self, path: str) -> None:
        """Load model from disk."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")

        save_dict = joblib.load(path)
        self.name = save_dict.get("name", self.name)
        self.params = save_dict.get("params", self.params)
        self.model = save_dict.get("model")
        self.scaler = save_dict.get("scaler")
        self.feature_names = save_dict.get("feature_names", [])
        self.is_trained = save_dict.get("is_trained", False)
        self.training_history = save_dict.get("training_history", {})
        logger.info(f"Model loaded from {path}")

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        """Get feature importance if available."""
        return None