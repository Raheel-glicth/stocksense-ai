"""
XGBoost model for StockSense AI.
Gradient boosting for structured financial data.
"""

import logging
import numpy as np
from typing import Optional, Dict, Any
from xgboost import XGBRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from .base import BaseModel

logger = logging.getLogger(__name__)


class XGBoostModel(BaseModel):
    """XGBoost Regressor for stock prediction."""

    def __init__(
        self,
        n_estimators: int = 300,
        max_depth: int = 6,
        learning_rate: float = 0.05,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        reg_alpha: float = 0.1,
        reg_lambda: float = 1.0,
        random_state: int = 42,
        n_jobs: int = -1,
        early_stopping_rounds: int = 20,
        **kwargs
    ):
        super().__init__("XGBoost", **kwargs)
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.reg_alpha = reg_alpha
        self.reg_lambda = reg_lambda
        self.random_state = random_state
        self.n_jobs = n_jobs
        self.early_stopping_rounds = early_stopping_rounds

    def build_model(self, **kwargs) -> Pipeline:
        """Build the XGBoost pipeline."""
        xgb = XGBRegressor(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            subsample=self.subsample,
            colsample_bytree=self.colsample_bytree,
            reg_alpha=self.reg_alpha,
            reg_lambda=self.reg_lambda,
            random_state=self.random_state,
            n_jobs=self.n_jobs,
            objective="reg:squarederror",
            verbosity=0,
        )

        pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", xgb),
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
        """Train the XGBoost model."""
        self.model = self.build_model()

        # Fit with step parameter format for verbose
        fit_kwargs = {"regressor__verbose": 0}
        
        self.model.fit(X_train, y_train, **fit_kwargs)

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

        logger.info(f"XGBoost trained. Train R²: {self.training_history['train_r2']:.4f}")
        return self.training_history

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions."""
        if not self.is_trained or self.model is None:
            raise ValueError("Model not trained yet")
        return self.model.predict(X)

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        """Get feature importance from XGBoost."""
        if not self.is_trained or self.model is None:
            return None

        regressor = self.model.named_steps["regressor"]
        if hasattr(regressor, "feature_importances_"):
            importance = regressor.feature_importances_
            if self.feature_names:
                return dict(zip(self.feature_names, importance))
            return {f"feature_{i}": float(v) for i, v in enumerate(importance)}
        return None