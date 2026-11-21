"""
Comprehensive unit and endpoint tests for StockSense AI backend fixes and new features.
"""

import io
import csv
import numpy as np
import pandas as pd
import pytest
from pydantic import BaseModel as PydanticBaseModel
from fastapi.testclient import TestClient

from main import (
    app,
    PredictionRequest,
    PredictionResponse,
    TechnicalIndicatorsResponse,
    BacktestResponse,
    ModelComparisonResponse,
    RegimeResponse,
    ResearchReport,
    StockComparisonItem,
    load_saved_models,
    get_or_train_model,
)
from data.features import FeatureEngineer
from models.backtest import Backtester
from models.xgboost_model import XGBoostModel
from models.linear_model import LinearRegressionModel


@pytest.fixture
def sample_ohlcv():
    """Generate 100 days of synthetic OHLCV data."""
    dates = pd.date_range(start="2023-01-01", periods=100, freq="D")
    np.random.seed(42)
    close = 100 + np.cumsum(np.random.randn(100) * 0.5)
    return pd.DataFrame({
        "date": dates,
        "open": close * 0.99,
        "high": close * 1.02,
        "low": close * 0.98,
        "close": close,
        "volume": np.random.randint(1000000, 5000000, 100),
    })


# =====================================================================
# 1. PredictionRequest inheritance
# =====================================================================
def test_prediction_request_is_pydantic_model():
    assert issubclass(PredictionRequest, PydanticBaseModel)
    req = PredictionRequest(symbol="AAPL")
    assert req.symbol == "AAPL"
    assert req.model == "XGBoost"
    assert req.horizon == 1
    assert req.period == "1y"
    # Verify dict conversion works via pydantic
    d = req.model_dump()
    assert d["symbol"] == "AAPL"


# =====================================================================
# 2. TechnicalIndicatorsResponse
# =====================================================================
def test_technical_indicators_response():
    resp = TechnicalIndicatorsResponse(
        symbol="AAPL",
        rsi=[50.0, 55.0],
        macd=[0.1, 0.2],
        macd_signal=[0.05, 0.15],
        macd_histogram=[0.05, 0.05],
        bb_upper=[110.0, 112.0],
        bb_middle=[100.0, 101.0],
        bb_lower=[90.0, 90.0],
        bb_position=[0.5, 0.6],
        atr=[1.5, 1.4],
        volatility=[0.2, 0.22],
        dates=["2023-01-01", "2023-01-02"],
    )
    assert resp.symbol == "AAPL"
    assert len(resp.rsi) == 2
    assert len(resp.dates) == 2


# =====================================================================
# 3. XGBoostModel without double-scaling when X_val is provided
# =====================================================================
def test_xgboost_train_with_val():
    np.random.seed(42)
    X_train = np.random.randn(100, 10)
    y_train = np.random.randn(100) * 0.02
    X_val = np.random.randn(20, 10)
    y_val = np.random.randn(20) * 0.02

    model = XGBoostModel(n_estimators=10, max_depth=3)
    history = model.train(X_train, y_train, X_val=X_val, y_val=y_val)

    assert model.is_trained
    assert "train_mae" in history
    assert "val_mae" in history
    preds = model.predict(X_val)
    assert len(preds) == len(y_val)


# =====================================================================
# 4. Guard LSTM in load_saved_models and get_or_train_model
# =====================================================================
def test_lstm_guarded():
    # Calling load_saved_models should not crash even if LSTM is unavailable
    load_saved_models()

    import main
    if not main._HAS_LSTM:
        with pytest.raises(ValueError, match="Unknown model: LSTM"):
            get_or_train_model("AAPL", "LSTM")


# =====================================================================
# 5. Market Regime Classification in FeatureEngineer
# =====================================================================
def test_classify_regime_structure(sample_ohlcv):
    fe = FeatureEngineer()
    regime_info = fe.classify_regime(sample_ohlcv)

    assert "regime" in regime_info
    assert regime_info["regime"] in ["bullish", "bearish", "sideways", "high_volatility"]
    assert "confidence" in regime_info
    assert 0.0 <= regime_info["confidence"] <= 1.0
    assert "signals" in regime_info
    signals = regime_info["signals"]
    assert "sma_20" in signals
    assert "sma_50" in signals
    assert "sma_crossover" in signals
    assert "rsi" in signals
    assert "rsi_zone" in signals
    assert "volatility" in signals
    assert "volatility_percentile" in signals
    assert "is_high_volatility" in signals


def test_classify_regime_bullish_bearish():
    fe = FeatureEngineer()
    dates = pd.date_range(start="2023-01-01", periods=100, freq="D")

    # Strongly upward trending data -> bullish
    close_up = 50.0 + np.linspace(1, 50, 100)
    df_up = pd.DataFrame({
        "date": dates,
        "open": close_up,
        "high": close_up + 1,
        "low": close_up - 1,
        "close": close_up,
        "volume": [1000000] * 100,
    })
    res_up = fe.classify_regime(df_up)
    assert res_up["signals"]["sma_crossover"] == "bullish"

    # Strongly downward trending data -> bearish
    close_down = 100.0 - np.linspace(1, 50, 100)
    df_down = pd.DataFrame({
        "date": dates,
        "open": close_down,
        "high": close_down + 1,
        "low": close_down - 1,
        "close": close_down,
        "volume": [1000000] * 100,
    })
    res_down = fe.classify_regime(df_down)
    assert res_down["signals"]["sma_crossover"] == "bearish"


# =====================================================================
# 6. Enhanced Backtest Metrics
# =====================================================================
def test_calculate_metrics_enhanced():
    fe = FeatureEngineer()
    model = LinearRegressionModel()
    backtester = Backtester(model=model, feature_engineer=fe)

    actuals = np.array([0.01, -0.005, 0.02, -0.01, 0.015, -0.002, 0.008])
    predictions = np.array([0.012, -0.004, 0.018, -0.008, 0.014, -0.001, 0.009])

    metrics = backtester._calculate_metrics(actuals, predictions)

    # Base metrics
    assert "mae" in metrics
    assert "rmse" in metrics
    assert "r2" in metrics
    assert "directional_accuracy" in metrics

    # Enhanced metrics
    assert "sharpe_ratio" in metrics
    assert "max_drawdown" in metrics
    assert "win_rate" in metrics
    assert "profit_factor" in metrics
    assert "total_return" in metrics

    assert isinstance(metrics["sharpe_ratio"], float)
    assert isinstance(metrics["max_drawdown"], float)
    assert isinstance(metrics["win_rate"], float)
    assert isinstance(metrics["profit_factor"], float)
    assert isinstance(metrics["total_return"], float)
    assert metrics["max_drawdown"] >= 0.0


# =====================================================================
# 7. FastAPI Endpoints via TestClient
# =====================================================================
client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_stocks_compare_endpoint(monkeypatch, sample_ohlcv):
    import main
    monkeypatch.setattr(main.collector, "get_history", lambda symbol, period="3mo", interval="1d": sample_ohlcv)

    response = client.get("/api/stocks/compare?symbols=AAPL,MSFT")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    for item in data:
        assert "symbol" in item
        assert "current_price" in item
        assert "daily_change" in item
        assert "daily_change_pct" in item
        assert "rsi" in item
        assert "trend" in item


def test_stock_regime_endpoint(monkeypatch, sample_ohlcv):
    import main
    monkeypatch.setattr(main.collector, "get_history", lambda symbol, period="1y", interval="1d": sample_ohlcv)

    response = client.get("/api/stocks/AAPL/regime")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert "regime" in data
    assert "confidence" in data
    assert "signals" in data


def test_research_summary_endpoint(monkeypatch, sample_ohlcv):
    import main
    monkeypatch.setattr(main.collector, "get_history", lambda symbol, period="1y", interval="1d": sample_ohlcv)

    response = client.get("/api/research/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert "current_price" in data
    assert "price_range" in data
    assert "trend_analysis" in data
    assert "momentum_analysis" in data
    assert "volatility_assessment" in data
    assert "volume_analysis" in data
    assert "support_resistance" in data
    assert "overall_assessment" in data


def test_csv_export_endpoint(monkeypatch, sample_ohlcv):
    import main
    monkeypatch.setattr(main.collector, "get_history", lambda symbol, period="1y", interval="1d": sample_ohlcv)

    response = client.get("/api/export/predictions/AAPL?model=LinearRegression")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    lines = response.text.strip().split("\r\n") if "\r\n" in response.text else response.text.strip().split("\n")
    header = lines[0].split(",")
    assert header == ["date", "actual_price", "predicted_return", "predicted_price", "model"]
    assert len(lines) > 1


def test_predict_endpoint(monkeypatch, sample_ohlcv):
    import main
    monkeypatch.setattr(main.collector, "get_history", lambda symbol, period="1y", interval="1d": sample_ohlcv)

    payload = {"symbol": "AAPL", "model": "LinearRegression", "horizon": 1, "period": "1y"}
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert data["model"] == "LinearRegression"
    assert "predicted_return" in data
    assert "predicted_price" in data
    assert "current_price" in data
    assert "directional_bias" in data
