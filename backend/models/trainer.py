"""
Model training and evaluation module for StockSense AI.
Implements walk-forward validation, model comparison, and backtesting.
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Any, Tuple, Callable
from dataclasses import dataclass
from pathlib import Path
import joblib

from .base import BaseModel
from .linear_model import LinearRegressionModel
from .random_forest import RandomForestModel
from .xgboost_model import XGBoostModel

# Try to import LSTM, but make it optional
try:
    from .lstm_model import LSTMModel
    _HAS_LSTM = True
except ImportError as e:
    logging.getLogger(__name__).warning(f"LSTM model not available: {e}")
    LSTMModel = None
    _HAS_LSTM = False

logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    """Configuration for a model."""
    name: str
    model_class: type
    params: Dict[str, Any]


# Default model configurations
DEFAULT_MODELS = [
    ModelConfig("LinearRegression", LinearRegressionModel, {"regularization": "ridge", "alpha": 1.0}),
    ModelConfig("RandomForest", RandomForestModel, {"n_estimators": 200, "max_depth": 15}),
    ModelConfig("XGBoost", XGBoostModel, {"n_estimators": 300, "max_depth": 6, "learning_rate": 0.05}),
]

if _HAS_LSTM and LSTMModel is not None:
    DEFAULT_MODELS.append(
        ModelConfig("LSTM", LSTMModel, {"sequence_length": 60, "lstm_units": (64, 32), "epochs": 50})
    )


class ModelTrainer:
    """
    Handles model training, walk-forward validation, and comparison.
    """

    def __init__(
        self,
        models: Optional[List[ModelConfig]] = None,
        test_size: float = 0.2,
        val_size: float = 0.1,
        n_splits: int = 5,
    ):
        self.models = models or DEFAULT_MODELS
        self.test_size = test_size
        self.val_size = val_size
        self.n_splits = n_splits
        self.trained_models: Dict[str, BaseModel] = {}
        self.results: Dict[str, Dict] = {}

    def walk_forward_split(
        self,
        X: np.ndarray,
        y: np.ndarray,
        n_splits: Optional[int] = None,
    ) -> List[Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]]:
        """
        Generate walk-forward splits for time series cross-validation.

        Returns:
            List of (X_train, y_train, X_test, y_test) tuples
        """
        n_splits = n_splits or self.n_splits
        n_samples = len(X)

        # Calculate split sizes
        test_size = int(n_samples * self.test_size)
        train_size = n_samples - test_size

        splits = []
        step = test_size // n_splits

        for i in range(n_splits):
            train_end = train_size + i * step
            test_start = train_end
            test_end = min(test_start + step, n_samples)

            if test_start >= test_end:
                break

            X_train = X[:train_end]
            y_train = y[:train_end]
            X_test = X[test_start:test_end]
            y_test = y[test_start:test_end]

            splits.append((X_train, y_train, X_test, y_test))

        return splits

    def train_model(
        self,
        model_config: ModelConfig,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
    ) -> BaseModel:
        """Train a single model."""
        model = model_config.model_class(**model_config.params)
        model.feature_names = getattr(self, 'feature_names', [])

        logger.info(f"Training {model_config.name}...")
        model.train(X_train, y_train, X_val, y_val)

        return model

    def train_all_models(
        self,
        X: np.ndarray,
        y: np.ndarray,
        feature_names: Optional[List[str]] = None,
    ) -> Dict[str, BaseModel]:
        """Train all configured models."""
        self.feature_names = feature_names or [f"feature_{i}" for i in range(X.shape[1])]

        # Split data
        n_samples = len(X)
        test_size = int(n_samples * self.test_size)
        val_size = int(n_samples * self.val_size)
        train_size = n_samples - test_size - val_size

        X_train = X[:train_size]
        y_train = y[:train_size]
        X_val = X[train_size:train_size + val_size]
        y_val = y[train_size:train_size + val_size]
        X_test = X[train_size + val_size:]
        y_test = y[train_size + val_size:]

        logger.info(f"Data split: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")

        trained = {}
        for model_config in self.models:
            try:
                model = self.train_model(model_config, X_train, y_train, X_val, y_val)
                model.feature_names = self.feature_names
                trained[model_config.name] = model
                self.trained_models[model_config.name] = model
            except Exception as e:
                logger.error(f"Failed to train {model_config.name}: {e}")

        # Evaluate on test set
        self.results = {}
        for name, model in trained.items():
            try:
                metrics = model.evaluate(X_test, y_test)
                self.results[name] = {
                    "test_metrics": metrics,
                    "train_history": model.training_history,
                }
                logger.info(f"{name} Test Metrics: {metrics}")
            except Exception as e:
                logger.error(f"Failed to evaluate {name}: {e}")

        return trained

    def walk_forward_validation(
        self,
        model_config: ModelConfig,
        X: np.ndarray,
        y: np.ndarray,
        feature_names: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Perform walk-forward validation for a single model."""
        splits = self.walk_forward_split(X, y)
        all_metrics = []
        all_predictions = []
        all_actuals = []

        for fold, (X_train, y_train, X_test, y_test) in enumerate(splits):
            logger.info(f"Walk-forward fold {fold + 1}/{len(splits)}")

            try:
                model = self.train_model(model_config, X_train, y_train)

                # Predict on test
                y_pred = model.predict(X_test)

                # Evaluate
                from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

                mae = mean_absolute_error(y_test, y_pred)
                rmse = np.sqrt(mean_squared_error(y_test, y_pred))
                r2 = r2_score(y_test, y_pred)

                mask = np.abs(y_test) > 1e-8
                mape = np.mean(np.abs((y_test[mask] - y_pred[mask]) / y_test[mask])) * 100 if mask.any() else np.inf

                dir_acc = np.mean((y_test > 0) == (y_pred > 0)) * 100

                all_metrics.append({
                    "fold": fold,
                    "mae": float(mae),
                    "rmse": float(rmse),
                    "r2": float(r2),
                    "mape": float(mape),
                    "directional_accuracy": float(dir_acc),
                })
                all_predictions.extend(y_pred)
                all_actuals.extend(y_test)

            except Exception as e:
                logger.error(f"Fold {fold} failed: {e}")

        # Aggregate metrics
        if all_metrics:
            avg_metrics = {k: np.mean([m[k] for m in all_metrics]) for k in all_metrics[0].keys() if k != "fold"}
            std_metrics = {f"{k}_std": np.std([m[k] for m in all_metrics]) for k in all_metrics[0].keys() if k != "fold"}
        else:
            avg_metrics = {}
            std_metrics = {}

        return {
            "fold_metrics": all_metrics,
            "avg_metrics": avg_metrics,
            "std_metrics": std_metrics,
            "predictions": all_predictions,
            "actuals": all_actuals,
        }

    def compare_models(
        self,
        X: np.ndarray,
        y: np.ndarray,
        feature_names: Optional[List[str]] = None,
        use_walk_forward: bool = False,
    ) -> Dict[str, Any]:
        """Compare all models."""
        self.feature_names = feature_names or [f"feature_{i}" for i in range(X.shape[1])]

        if use_walk_forward:
            # Walk-forward comparison
            results = {}
            for model_config in self.models:
                logger.info(f"Walk-forward validation for {model_config.name}")
                results[model_config.name] = self.walk_forward_validation(model_config, X, y, feature_names)
        else:
            # Simple train/val/test split
            self.train_all_models(X, y, feature_names)
            results = {name: self.results[name] for name in self.trained_models.keys()}

        # Add naive baseline
        baseline_results = self._naive_baseline(X, y)
        results["NaiveBaseline"] = baseline_results

        return results

    def _naive_baseline(self, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        """Naive baseline: predict next close equals latest close (i.e., return = 0)."""
        n_samples = len(X)
        test_size = int(n_samples * self.test_size)
        y_test = y[-test_size:]

        # Naive prediction: zero return
        y_pred = np.zeros_like(y_test)

        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)

        mask = np.abs(y_test) > 1e-8
        mape = np.mean(np.abs((y_test[mask] - y_pred[mask]) / y_test[mask])) * 100 if mask.any() else np.inf
        dir_acc = np.mean((y_test > 0) == (y_pred > 0)) * 100

        return {
            "test_metrics": {
                "mae": float(mae),
                "rmse": float(rmse),
                "r2": float(r2),
                "mape": float(mape),
                "directional_accuracy": float(dir_acc),
            },
            "note": "Naive baseline predicting zero return (next close = current close)",
        }

    def save_models(self, save_dir: str) -> None:
        """Save all trained models."""
        save_path = Path(save_dir)
        save_path.mkdir(parents=True, exist_ok=True)

        for name, model in self.trained_models.items():
            model_path = save_path / f"{name}.pkl"
            model.save(model_path)

        # Save comparison results
        import json
        results_path = save_path / "comparison_results.json"
        with open(results_path, "w") as f:
            # Convert numpy types to native Python types
            def convert(obj):
                if isinstance(obj, (np.integer, np.floating)):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                if isinstance(obj, dict):
                    return {k: convert(v) for k, v in obj.items()}
                if isinstance(obj, list):
                    return [convert(v) for v in obj]
                return obj

            json.dump(convert(self.results), f, indent=2)

        logger.info(f"Models and results saved to {save_path}")

    def load_models(self, save_dir: str) -> None:
        """Load all trained models."""
        save_path = Path(save_dir)
        if not save_path.exists():
            raise FileNotFoundError(f"Model directory not found: {save_path}")

        for model_config in self.models:
            model_path = save_path / f"{model_config.name}.pkl"
            if model_path.exists():
                model = model_config.model_class()
                model.load(model_path)
                self.trained_models[model_config.name] = model
                logger.info(f"Loaded {model_config.name} from {model_path}")

    def get_best_model(self, metric: str = "rmse") -> Tuple[str, BaseModel]:
        """Get the best model based on a metric."""
        if not self.results:
            raise ValueError("No results available. Run compare_models first.")

        best_name = None
        best_value = float("inf") if metric in ["mae", "rmse", "mape"] else float("-inf")

        for name, result in self.results.items():
            if name == "NaiveBaseline":
                continue
            metrics = result.get("test_metrics", result.get("avg_metrics", {}))
            value = metrics.get(metric)
            if value is not None:
                if metric in ["mae", "rmse", "mape"]:
                    if value < best_value:
                        best_value = value
                        best_name = name
                else:  # r2, directional_accuracy
                    if value > best_value:
                        best_value = value
                        best_name = name

        if best_name and best_name in self.trained_models:
            return best_name, self.trained_models[best_name]

        raise ValueError(f"Could not determine best model for metric {metric}")


def create_trainer(
    models: Optional[List[str]] = None,
    **kwargs
) -> ModelTrainer:
    """Factory function to create a ModelTrainer with selected models."""
    model_map = {
        "LinearRegression": ModelConfig("LinearRegression", LinearRegressionModel, {"regularization": "ridge"}),
        "RandomForest": ModelConfig("RandomForest", RandomForestModel, {}),
        "XGBoost": ModelConfig("XGBoost", XGBoostModel, {}),
    }

    if _HAS_LSTM and LSTMModel is not None:
        model_map["LSTM"] = ModelConfig("LSTM", LSTMModel, {})

    selected = models or list(model_map.keys())
    model_configs = [model_map[name] for name in selected if name in model_map]

    return ModelTrainer(models=model_configs, **kwargs)