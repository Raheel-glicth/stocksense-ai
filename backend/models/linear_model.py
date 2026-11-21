"""
Linear Regression model for StockSense AI.
Serves as baseline model.
"""

import logging
import numpy as np
from typing import Optional, Dict, Any
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from .base import BaseModel

logger = logging.getLogger(__name__)


class LinearRegressionModel(BaseModel):
    """Linear Regression model with optional regularization."""

    def __init__(
        self,
        regularization: str = "ridge",  # "none", "ridge", "lasso", "elasticnet"
        alpha: float = 1.0,
        l1_ratio: float = 0.5,
        **kwargs
    ):
        super().__init__("LinearRegression", **kwargs)
        self.regularization = regularization
        self.alpha = alpha
        self.l1_ratio = l1_ratio

    def build_model(self, **kwargs) -> Pipeline:
        """Build the linear regression pipeline."""
        if self.regularization == "ridge":
            model = Ridge(alpha=self.alpha, random_state=42)
        elif self.regularization == "lasso":
            model = Lasso(alpha=self.alpha, random_state=42, max_iter=10000)
        elif self.regularization == "elasticnet":
            model = ElasticNet(
                alpha=self.alpha,
                l1_ratio=self.l1_ratio,
                random_state=42,
                max_iter=10000
            )
        else:
            model = LinearRegression()

        pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", model),
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
        """Train the linear regression model."""
        self.model = self.build_model()
        self.model.fit(X_train, y_train)
        self.is_trained = True

        # Training metrics
        train_pred = self.predict(X_train)
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

        self.training_history = {
            "train_mae": float(mean_absolute_error(y_train, train_pred)),
            "train_rmse": float(np.sqrt(mean_squared_error(y_train, train_pred))),
            "train_r2": float(r2_score(y_train, train_pred)),
        }

        # Validation metrics
        if X_val is not None and y_val is not None:
            val_pred = self.predict(X_val)
            self.training_history.update({
                "val_mae": float(mean_absolute_error(y_val, val_pred)),
                "val_rmse": float(np.sqrt(mean_squared_error(y_val, val_pred))),
                "val_r2": float(r2_score(y_val, val_pred)),
            })

        logger.info(f"Linear Regression trained. Train R²: {self.training_history['train_r2']:.4f}")
        return self.training_history

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions."""
        if not self.is_trained or self.model is None:
            raise ValueError("Model not trained yet")
        return self.model.predict(X)

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        """Get feature coefficients as importance."""
        if not self.is_trained or self.model is None:
            return None

        regressor = self.model.named_steps["regressor"]
        if hasattr(regressor, "coef_"):
            importance = np.abs(regressor.coef_)
            if self.feature_names:
                return dict(zip(self.feature_names, importance))
            return {f"feature_{i}": float(v) for i, v in enumerate(importance)}
        return None