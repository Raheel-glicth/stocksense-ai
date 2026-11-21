"""
Random Forest model for StockSense AI.
Captures nonlinear relationships between technical indicators and stock prices.
"""

import logging
import numpy as np
from typing import Optional, Dict, Any, List
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from .base import BaseModel

logger = logging.getLogger(__name__)


class RandomForestModel(BaseModel):
    """Random Forest Regressor for stock prediction."""

    def __init__(
        self,
        n_estimators: int = 200,
        max_depth: Optional[int] = 15,
        min_samples_split: int = 5,
        min_samples_leaf: int = 2,
        max_features: str = "sqrt",
        random_state: int = 42,
        n_jobs: int = -1,
        **kwargs
    ):
        super().__init__("RandomForest", **kwargs)
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.min_samples_leaf = min_samples_leaf
        self.max_features = max_features
        self.random_state = random_state
        self.n_jobs = n_jobs

    def build_model(self, **kwargs) -> Pipeline:
        """Build the Random Forest pipeline."""
        rf = RandomForestRegressor(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            min_samples_split=self.min_samples_split,
            min_samples_leaf=self.min_samples_leaf,
            max_features=self.max_features,
            random_state=self.random_state,
            n_jobs=self.n_jobs,
        )

        pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", rf),
        ])

        self.scaler = pipeline.named_steps["scaler"]
        return pipeline

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Train the Random Forest model."""
        self.model = self.build_model()
        self.model.fit(X_train, y_train)
        self.is_trained = True

        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

        train_pred = self.predict(X_train)
        self.training_history = {
            "train_mae": float(mean_absolute_error(y_train, train_pred)),
            "train_rmse": float(np.sqrt(mean_squared_error(y_train, train_pred))),
            "train_r2": float(r2_score(y_train, train_pred)),
        }

        if X_val is not None and y_val is not None:
            val_pred = self.predict(X_val)
            self.training_history.update({
                "val_mae": float(mean_absolute_error(y_val, val_pred)),
                "val_rmse": float(np.sqrt(mean_squared_error(y_val, val_pred))),
                "val_r2": float(r2_score(y_val, val_pred)),
            })

        logger.info(f"Random Forest trained. Train R²: {self.training_history['train_r2']:.4f}")
        return self.training_history

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions."""
        if not self.is_trained or self.model is None:
            raise ValueError("Model not trained yet")
        return self.model.predict(X)

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        """Get feature importance from Random Forest."""
        if not self.is_trained or self.model is None:
            return None

        regressor = self.model.named_steps["regressor"]
        if hasattr(regressor, "feature_importances_"):
            importance = regressor.feature_importances_
            if self.feature_names:
                return dict(zip(self.feature_names, importance))
            return {f"feature_{i}": float(v) for i, v in enumerate(importance)}
        return None

    def predict_with_uncertainty(
        self,
        X: np.ndarray,
        n_samples: int = 100
    ) -> tuple:
        """
        Make predictions with uncertainty using tree ensemble variance.
        """
        if not self.is_trained or self.model is None:
            raise ValueError("Model not trained yet")

        regressor = self.model.named_steps["regressor"]
        X_scaled = self.scaler.transform(X)

        # Get predictions from all trees
        tree_preds = np.array([tree.predict(X_scaled) for tree in regressor.estimators_])

        mean_pred = tree_preds.mean(axis=0)
        std_pred = tree_preds.std(axis=0)

        return mean_pred, std_pred