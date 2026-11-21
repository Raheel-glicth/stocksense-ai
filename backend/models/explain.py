"""
Explainability module for StockSense AI.
Provides SHAP-based explanations for tree-based models.
"""

import logging
import numpy as np
import pandas as pd
from typing import Optional, Dict, Any, List
from pathlib import Path

try:
    import shap
    _HAS_SHAP = True
except ImportError:
    shap = None
    _HAS_SHAP = False

from .base import BaseModel
from .random_forest import RandomForestModel
from .xgboost_model import XGBoostModel

logger = logging.getLogger(__name__)


class ModelExplainer:
    """
    Provides model explanations using SHAP values.
    Supports tree-based models (Random Forest, XGBoost).
    """

    def __init__(self, model: BaseModel, feature_names: List[str]):
        self.model = model
        self.feature_names = feature_names
        self.explainer = None
        self.shap_values = None
        self._initialize_explainer()

    def _initialize_explainer(self) -> None:
        """Initialize SHAP explainer based on model type."""
        if _HAS_SHAP and isinstance(self.model, (RandomForestModel, XGBoostModel)):
            # Get the underlying tree ensemble
            try:
                regressor = self.model.model.named_steps["regressor"]
                self.explainer = shap.TreeExplainer(regressor)
                logger.info(f"Initialized TreeExplainer for {self.model.name}")
            except Exception as e:
                logger.warning(f"Failed to initialize TreeExplainer: {e}")
                self.explainer = None
        else:
            self.explainer = None

    def explain_prediction(
        self,
        X: np.ndarray,
        sample_idx: int = -1,
    ) -> Dict[str, Any]:
        """
        Explain a single prediction.

        Args:
            X: Feature matrix
            sample_idx: Index of sample to explain (default: last)

        Returns:
            Dictionary with SHAP values and explanation
        """
        # Scale features if scaler exists
        if self.model.scaler is not None:
            X_scaled = self.model.scaler.transform(X)
        else:
            X_scaled = X

        # Check for empty dataset
        if len(X_scaled) == 0:
            return {"error": "No data available for explanation"}

        # Handle negative indices properly
        if sample_idx < 0:
            sample_idx = len(X_scaled) + sample_idx
        
        if sample_idx < 0 or sample_idx >= len(X_scaled):
            return {"error": "Sample index out of bounds"}

        if self.explainer is None:
            importances = self.model.get_feature_importance() or {}
            mean_vec = np.mean(X_scaled, axis=0) if len(X_scaled) > 1 else np.zeros(X_scaled.shape[1])
            diff = X_scaled[sample_idx] - mean_vec
            contributions = {}
            for i, name in enumerate(self.feature_names):
                w = importances.get(name, 0.0)
                contributions[name] = float(diff[i] * w) if i < len(diff) else 0.0
            sorted_contributions = sorted(contributions.items(), key=lambda x: abs(x[1]), reverse=True)
            pred = float(self.model.predict(X[sample_idx:sample_idx+1])[0])
            return {
                "expected_value": 0.0,
                "prediction": pred,
                "feature_contributions": dict(sorted_contributions),
                "top_positive": [{"feature": k, "contribution": v} for k, v in sorted_contributions if v > 0][:10],
                "top_negative": [{"feature": k, "contribution": v} for k, v in sorted_contributions if v < 0][:10],
            }
        
        sample = X_scaled[sample_idx:sample_idx + 1]
        shap_values = self.explainer.shap_values(sample)

        # For tree models, shap_values might be a list (for multi-output)
        if isinstance(shap_values, list):
            shap_values = shap_values[0]

        # Expected value (base value)
        expected_value = self.explainer.expected_value
        if isinstance(expected_value, (list, np.ndarray)):
            expected_value = expected_value[0]

        # Feature contributions
        contributions = shap_values[0] if shap_values.ndim > 1 else shap_values

        # Create feature contribution dict
        feature_contributions = {}
        for i, name in enumerate(self.feature_names):
            if i < len(contributions):
                feature_contributions[name] = float(contributions[i])

        # Sort by absolute contribution
        sorted_contributions = sorted(
            feature_contributions.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )

        return {
            "expected_value": float(expected_value),
            "prediction": float(expected_value + np.sum(contributions)),
            "feature_contributions": dict(sorted_contributions),
            "top_positive": [
                {"feature": k, "contribution": v}
                for k, v in sorted_contributions if v > 0
            ][:10],
            "top_negative": [
                {"feature": k, "contribution": v}
                for k, v in sorted_contributions if v < 0
            ][:10],
        }

    def explain_dataset(
        self,
        X: np.ndarray,
        max_samples: int = 500,
    ) -> Dict[str, Any]:
        """
        Explain model behavior on a dataset.

        Args:
            X: Feature matrix
            max_samples: Maximum samples to explain (for performance)

        Returns:
            Dictionary with global SHAP analysis
        """
        if self.explainer is None:
            return {"error": "Explainer not available for this model type"}

        # Limit samples for performance
        if len(X) > max_samples:
            indices = np.random.choice(len(X), max_samples, replace=False)
            X_sample = X[indices]
        else:
            X_sample = X

        # Scale features
        if self.model.scaler is not None:
            X_scaled = self.model.scaler.transform(X_sample)
        else:
            X_scaled = X_sample

        # Calculate SHAP values
        logger.info(f"Calculating SHAP values for {len(X_scaled)} samples...")
        shap_values = self.explainer.shap_values(X_scaled)

        if isinstance(shap_values, list):
            shap_values = shap_values[0]

        self.shap_values = shap_values

        # Mean absolute SHAP values (global feature importance)
        mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
        feature_importance = {
            name: float(mean_abs_shap[i])
            for i, name in enumerate(self.feature_names)
            if i < len(mean_abs_shap)
        }

        # Sort by importance
        sorted_importance = sorted(
            feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )

        # SHAP summary statistics
        summary = {
            "mean_abs_shap": float(np.mean(mean_abs_shap)),
            "max_abs_shap": float(np.max(mean_abs_shap)),
            "feature_importance": dict(sorted_importance),
            "top_features": [k for k, _ in sorted_importance[:20]],
        }

        return summary

    def get_shap_summary_data(
        self,
        X: np.ndarray,
        max_samples: int = 200,
    ) -> Dict[str, Any]:
        """
        Get data for SHAP summary plot.

        Returns:
            Dictionary with SHAP values and feature values for plotting
        """
        if self.explainer is None:
            return {"error": "Explainer not available"}

        # Limit samples
        if len(X) > max_samples:
            indices = np.random.choice(len(X), max_samples, replace=False)
            X_sample = X[indices]
        else:
            X_sample = X

        if self.model.scaler is not None:
            X_scaled = self.model.scaler.transform(X_sample)
        else:
            X_scaled = X_sample

        shap_values = self.explainer.shap_values(X_scaled)
        if isinstance(shap_values, list):
            shap_values = shap_values[0]

        # Prepare data for beeswarm/summary plot
        return {
            "shap_values": shap_values.tolist(),
            "feature_values": X_scaled.tolist(),
            "feature_names": self.feature_names,
        }

    def get_dependence_data(
        self,
        X: np.ndarray,
        feature_idx: int,
        max_samples: int = 500,
    ) -> Dict[str, Any]:
        """
        Get data for SHAP dependence plot for a specific feature.

        Args:
            X: Feature matrix
            feature_idx: Index of feature to plot
            max_samples: Maximum samples

        Returns:
            Dictionary with SHAP values and feature values for dependence plot
        """
        if self.explainer is None:
            return {"error": "Explainer not available"}

        if len(X) > max_samples:
            indices = np.random.choice(len(X), max_samples, replace=False)
            X_sample = X[indices]
        else:
            X_sample = X

        if self.model.scaler is not None:
            X_scaled = self.model.scaler.transform(X_sample)
        else:
            X_scaled = X_sample

        shap_values = self.explainer.shap_values(X_scaled)
        if isinstance(shap_values, list):
            shap_values = shap_values[0]

        feature_name = self.feature_names[feature_idx] if feature_idx < len(self.feature_names) else f"feature_{feature_idx}"

        return {
            "feature_name": feature_name,
            "feature_values": X_scaled[:, feature_idx].tolist(),
            "shap_values": shap_values[:, feature_idx].tolist(),
            "interaction_feature_values": X_scaled[:, np.argmax(np.abs(shap_values).mean(axis=0))].tolist() if shap_values.shape[1] > 1 else [],
        }


def create_explainer(model: BaseModel, feature_names: List[str]) -> ModelExplainer:
    """Factory function to create a ModelExplainer."""
    return ModelExplainer(model, feature_names)