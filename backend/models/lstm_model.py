"""
LSTM Neural Network model for StockSense AI.
Learns temporal patterns from historical price sequences.
"""

import logging
import numpy as np
import os
from typing import Optional, Dict, Any, Tuple
from pathlib import Path

import tensorflow as tf
from tensorflow.keras import layers, models, optimizers, callbacks
from tensorflow.keras.models import Sequential
from sklearn.preprocessing import StandardScaler

from .base import BaseModel

logger = logging.getLogger(__name__)

# Suppress TensorFlow warnings
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
tf.get_logger().setLevel("ERROR")


class LSTMModel(BaseModel):
    """LSTM Neural Network for stock prediction."""

    def __init__(
        self,
        sequence_length: int = 60,
        lstm_units: Tuple[int, ...] = (64, 32),
        dropout_rate: float = 0.2,
        dense_units: int = 32,
        learning_rate: float = 0.001,
        batch_size: int = 32,
        epochs: int = 50,
        patience: int = 10,
        random_state: int = 42,
        **kwargs
    ):
        super().__init__("LSTM", **kwargs)
        self.sequence_length = sequence_length
        self.lstm_units = lstm_units
        self.dropout_rate = dropout_rate
        self.dense_units = dense_units
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.epochs = epochs
        self.patience = patience
        self.random_state = random_state

        # Set random seeds for reproducibility
        np.random.seed(random_state)
        tf.random.set_seed(random_state)

    def _create_sequences(
        self,
        X: np.ndarray,
        y: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Create sequences for LSTM input."""
        X_seq, y_seq = [], []
        for i in range(self.sequence_length, len(X)):
            X_seq.append(X[i - self.sequence_length:i])
            y_seq.append(y[i])
        return np.array(X_seq), np.array(y_seq)

    def build_model(self, input_shape: Tuple[int, int], **kwargs) -> Sequential:
        """Build the LSTM model architecture."""
        model = Sequential()

        # First LSTM layer
        model.add(layers.LSTM(
            self.lstm_units[0],
            return_sequences=len(self.lstm_units) > 1,
            input_shape=input_shape,
            dropout=self.dropout_rate,
            recurrent_dropout=self.dropout_rate,
        ))

        # Additional LSTM layers
        for i, units in enumerate(self.lstm_units[1:]):
            model.add(layers.LSTM(
                units,
                return_sequences=i < len(self.lstm_units) - 2,
                dropout=self.dropout_rate,
                recurrent_dropout=self.dropout_rate,
            ))

        # Dense layers
        model.add(layers.Dense(self.dense_units, activation="relu"))
        model.add(layers.Dropout(self.dropout_rate))
        model.add(layers.Dense(1))  # Output layer for regression

        model.compile(
            optimizer=optimizers.Adam(learning_rate=self.learning_rate),
            loss="mse",
            metrics=["mae"],
        )

        return model

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Train the LSTM model."""
        # Scale features
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)

        if X_val is not None:
            X_val_scaled = self.scaler.transform(X_val)
        else:
            # Split training data for validation
            split_idx = int(len(X_train_scaled) * 0.8)
            X_val_scaled = X_train_scaled[split_idx:]
            y_val = y_train[split_idx:]
            X_train_scaled = X_train_scaled[:split_idx]
            y_train = y_train[:split_idx]

        # Create sequences
        X_train_seq, y_train_seq = self._create_sequences(X_train_scaled, y_train)
        X_val_seq, y_val_seq = self._create_sequences(X_val_scaled, y_val)

        if len(X_train_seq) == 0 or len(X_val_seq) == 0:
            raise ValueError("Not enough data to create sequences. Need at least sequence_length + 1 samples.")

        # Build model
        self.model = self.build_model(input_shape=(X_train_seq.shape[1], X_train_seq.shape[2]))

        # Callbacks
        early_stopping = callbacks.EarlyStopping(
            monitor="val_loss",
            patience=self.patience,
            restore_best_weights=True,
            verbose=0,
        )

        reduce_lr = callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=self.patience // 2,
            min_lr=1e-6,
            verbose=0,
        )

        # Train
        history = self.model.fit(
            X_train_seq, y_train_seq,
            validation_data=(X_val_seq, y_val_seq),
            epochs=self.epochs,
            batch_size=self.batch_size,
            callbacks=[early_stopping, reduce_lr],
            verbose=0,
        )

        self.is_trained = True

        # Store training history
        self.training_history = {
            "train_loss": float(history.history["loss"][-1]),
            "train_mae": float(history.history["mae"][-1]),
            "val_loss": float(history.history["val_loss"][-1]),
            "val_mae": float(history.history["val_mae"][-1]),
            "epochs_trained": len(history.history["loss"]),
        }

        logger.info(
            f"LSTM trained. Train Loss: {self.training_history['train_loss']:.6f}, "
            f"Val Loss: {self.training_history['val_loss']:.6f}, "
            f"Epochs: {self.training_history['epochs_trained']}"
        )
        return self.training_history

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions."""
        if not self.is_trained or self.model is None:
            raise ValueError("Model not trained yet")

        X_scaled = self.scaler.transform(X)

        # Create sequences (need at least sequence_length samples)
        if len(X_scaled) < self.sequence_length:
            raise ValueError(f"Need at least {self.sequence_length} samples for prediction")

        X_seq, _ = self._create_sequences(X_scaled, np.zeros(len(X_scaled)))
        predictions = self.model.predict(X_seq, verbose=0).flatten()

        # Pad predictions to match input length
        # First sequence_length predictions are not available
        padded_predictions = np.full(len(X), np.nan)
        padded_predictions[self.sequence_length:] = predictions

        return padded_predictions

    def predict_latest(self, X: np.ndarray) -> float:
        """Predict for the latest single sample."""
        if not self.is_trained or self.model is None:
            raise ValueError("Model not trained yet")

        X_scaled = self.scaler.transform(X)

        if len(X_scaled) < self.sequence_length:
            raise ValueError(f"Need at least {self.sequence_length} samples for prediction")

        # Take the last sequence_length samples
        X_seq = X_scaled[-self.sequence_length:].reshape(1, self.sequence_length, -1)
        prediction = self.model.predict(X_seq, verbose=0).flatten()[0]

        return float(prediction)

    def save(self, path: str) -> None:
        """Save LSTM model to disk."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        # Save Keras model separately
        model_path = path.with_suffix(".keras")
        self.model.save(model_path)

        # Save scaler and metadata using joblib
        import joblib
        save_dict = {
            "name": self.name,
            "params": self.params,
            "scaler": self.scaler,
            "feature_names": self.feature_names,
            "is_trained": self.is_trained,
            "training_history": self.training_history,
            "sequence_length": self.sequence_length,
            "lstm_units": self.lstm_units,
            "dropout_rate": self.dropout_rate,
            "dense_units": self.dense_units,
            "learning_rate": self.learning_rate,
            "model_path": str(model_path),
        }
        joblib.dump(save_dict, path)
        logger.info(f"LSTM model saved to {path}")

    def load(self, path: str) -> None:
        """Load LSTM model from disk."""
        import joblib
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")

        save_dict = joblib.load(path)
        self.name = save_dict.get("name", self.name)
        self.params = save_dict.get("params", self.params)
        self.scaler = save_dict.get("scaler")
        self.feature_names = save_dict.get("feature_names", [])
        self.is_trained = save_dict.get("is_trained", False)
        self.training_history = save_dict.get("training_history", {})
        self.sequence_length = save_dict.get("sequence_length", self.sequence_length)
        self.lstm_units = save_dict.get("lstm_units", self.lstm_units)
        self.dropout_rate = save_dict.get("dropout_rate", self.dropout_rate)
        self.dense_units = save_dict.get("dense_units", self.dense_units)
        self.learning_rate = save_dict.get("learning_rate", self.learning_rate)

        model_path = Path(save_dict.get("model_path", path.with_suffix(".keras")))
        if model_path.exists():
            self.model = models.load_model(model_path)
        else:
            raise FileNotFoundError(f"Keras model file not found: {model_path}")

        logger.info(f"LSTM model loaded from {path}")

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        """LSTM doesn't have direct feature importance - use SHAP instead."""
        return None