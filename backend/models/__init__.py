"""
Machine Learning models module for StockSense AI.
Contains baseline and advanced models for stock prediction.
"""

from .base import BaseModel
from .linear_model import LinearRegressionModel
from .random_forest import RandomForestModel
from .xgboost_model import XGBoostModel
from .trainer import ModelTrainer

# Try to import LSTM, but make it optional
try:
    from .lstm_model import LSTMModel
    _HAS_LSTM = True
except ImportError as e:
    import logging
    logging.getLogger(__name__).warning(f"LSTM model not available: {e}")
    LSTMModel = None
    _HAS_LSTM = False

__all__ = [
    "BaseModel",
    "LinearRegressionModel",
    "RandomForestModel",
    "XGBoostModel",
    "ModelTrainer",
]

if _HAS_LSTM:
    __all__.append("LSTMModel")