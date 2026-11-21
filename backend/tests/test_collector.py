"""
Unit tests for StockSense AI data collector.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
import pandas as pd
import numpy as np
from data.collector import StockDataCollector


class TestStockDataCollector:
    """Test cases for StockDataCollector."""

    @pytest.fixture
    def collector(self):
        """Create collector instance for testing."""
        return StockDataCollector(cache_ttl_hours=1)

    def test_normalize_symbol_us(self, collector):
        """Test US symbol normalization."""
        assert collector.normalize_symbol("AAPL") == "AAPL"
        assert collector.normalize_symbol("aapl") == "AAPL"
        assert collector.normalize_symbol("  MSFT  ") == "MSFT"

    def test_normalize_symbol_indian(self, collector):
        """Test Indian symbol normalization."""
        assert collector.normalize_symbol("RELIANCE.NS") == "RELIANCE.NS"
        assert collector.normalize_symbol("TCS.BO") == "TCS.BO"

    def test_search_symbols(self, collector):
        """Test symbol search functionality."""
        results = collector.search_symbols("AAPL")
        assert len(results) > 0
        assert any(r["symbol"] == "AAPL" for r in results)

        results = collector.search_symbols("RELIANCE")
        assert len(results) > 0
        assert any(r["symbol"] == "RELIANCE.NS" for r in results)

    def test_search_returns_list_of_dicts(self, collector):
        """Test search returns proper structure."""
        results = collector.search_symbols("AAPL")
        assert isinstance(results, list)
        assert all(isinstance(r, dict) for r in results)
        assert all("symbol" in r and "name" in r and "market" in r for r in results)


class TestFeatureEngineer:
    """Test cases for feature engineering."""

    @pytest.fixture
    def sample_data(self):
        """Create sample OHLCV data for testing."""
        dates = pd.date_range(start="2023-01-01", periods=100, freq="D")
        np.random.seed(42)
        close = 100 + np.cumsum(np.random.randn(100) * 0.5)
        return pd.DataFrame({
            "date": dates,
            "open": close * (1 + np.random.randn(100) * 0.001),
            "high": close * (1 + np.abs(np.random.randn(100)) * 0.01),
            "low": close * (1 - np.abs(np.random.randn(100)) * 0.01),
            "close": close,
            "volume": np.random.randint(1000000, 10000000, 100)
        })

    def test_price_features(self, sample_data):
        """Test price feature creation."""
        from data.features import FeatureEngineer
        fe = FeatureEngineer()
        df = fe.add_price_features(sample_data.copy())

        assert "returns" in df.columns
        assert "log_returns" in df.columns
        assert "hl_pct" in df.columns
        assert "oc_pct" in df.columns

    def test_technical_indicators(self, sample_data):
        """Test technical indicator creation."""
        from data.features import FeatureEngineer
        fe = FeatureEngineer()
        df = fe.add_price_features(sample_data.copy())
        df = fe.add_technical_indicators(df)

        # Check key indicators exist
        assert "sma_10" in df.columns
        assert "sma_20" in df.columns
        assert "rsi_14" in df.columns
        assert "macd" in df.columns
        assert "bb_upper" in df.columns
        assert "atr_14" in df.columns

    def test_prepare_features(self, sample_data):
        """Test feature/target preparation."""
        from data.features import FeatureEngineer
        fe = FeatureEngineer()

        X, y, feature_names = fe.prepare_features(sample_data, target_horizon=1)

        assert len(X) == len(y)
        assert len(feature_names) > 20
        assert X.shape[1] == len(feature_names)
        assert not np.isnan(X).any()
        assert not np.isnan(y).any()


class TestModels:
    """Test ML model training and prediction."""

    @pytest.fixture
    def sample_features(self):
        """Create sample features for testing."""
        np.random.seed(42)
        X = np.random.randn(200, 30)
        y = np.random.randn(200) * 0.01
        feature_names = [f"feature_{i}" for i in range(30)]
        return X, y, feature_names

    def test_linear_regression(self, sample_features):
        """Test Linear Regression training."""
        from models.linear_model import LinearRegressionModel
        X, y, feature_names = sample_features

        model = LinearRegressionModel(regularization="ridge", alpha=1.0)
        model.feature_names = feature_names

        X_train, X_test = X[:150], X[150:]
        y_train, y_test = y[:150], y[150:]

        model.train(X_train, y_train)
        assert model.is_trained

        preds = model.predict(X_test)
        assert len(preds) == len(y_test)

    def test_random_forest(self, sample_features):
        """Test Random Forest training."""
        from models.random_forest import RandomForestModel
        X, y, feature_names = sample_features

        model = RandomForestModel(n_estimators=50, max_depth=5)
        model.feature_names = feature_names

        X_train, X_test = X[:150], X[150:]
        y_train, y_test = y[:150], y[150:]

        model.train(X_train, y_train)
        assert model.is_trained

        preds = model.predict(X_test)
        assert len(preds) == len(y_test)

        importance = model.get_feature_importance()
        assert importance is not None
        assert len(importance) > 0

    def test_xgboost(self, sample_features):
        """Test XGBoost training."""
        from models.xgboost_model import XGBoostModel
        X, y, feature_names = sample_features

        model = XGBoostModel(n_estimators=50, max_depth=3)
        model.feature_names = feature_names

        X_train, X_test = X[:150], X[150:]
        y_train, y_test = y[:150], y[150:]

        model.train(X_train, y_train)
        assert model.is_trained

        preds = model.predict(X_test)
        assert len(preds) == len(y_test)

    def test_model_evaluation(self, sample_features):
        """Test model evaluation metrics."""
        from models.linear_model import LinearRegressionModel
        X, y, feature_names = sample_features

        model = LinearRegressionModel()
        model.feature_names = feature_names

        X_train, X_test = X[:150], X[150:]
        y_train, y_test = y[:150], y[150:]

        model.train(X_train, y_train)
        metrics = model.evaluate(X_test, y_test)

        assert "mae" in metrics
        assert "rmse" in metrics
        assert "r2" in metrics
        assert "mape" in metrics
        assert "directional_accuracy" in metrics


class TestTrainer:
    """Test model trainer and comparison."""

    def test_trainer_creation(self):
        """Test trainer instantiation."""
        from models.trainer import create_trainer
        trainer = create_trainer(models=["LinearRegression", "RandomForest"])
        assert len(trainer.models) == 2

    def test_model_comparison(self):
        """Test model comparison functionality."""
        from models.trainer import create_trainer
        import numpy as np

        np.random.seed(42)
        X = np.random.randn(200, 20)
        y = np.random.randn(200) * 0.01
        feature_names = [f"f_{i}" for i in range(20)]

        trainer = create_trainer(models=["LinearRegression", "RandomForest"])
        results = trainer.compare_models(X, y, feature_names)

        assert "LinearRegression" in results
        assert "RandomForest" in results
        assert "NaiveBaseline" in results


if __name__ == "__main__":
    pytest.main([__file__, "-v"])