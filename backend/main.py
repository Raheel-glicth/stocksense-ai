"""
StockSense AI - FastAPI Backend
Main application entry point with all API endpoints.
"""

import csv
import io
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List, Optional, Any

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel as PydanticBaseModel, Field

from data.collector import StockDataCollector
from data.features import FeatureEngineer
from models.base import BaseModel
from models.linear_model import LinearRegressionModel
from models.random_forest import RandomForestModel
from models.xgboost_model import XGBoostModel

# Try to import LSTM, but make it optional
try:
    from models.lstm_model import LSTMModel
    _HAS_LSTM = True
except ImportError as e:
    logging.getLogger(__name__).warning(f"LSTM model not available: {e}")
    LSTMModel = None
    _HAS_LSTM = False

from models.trainer import ModelTrainer, create_trainer, ModelConfig
from models.explain import create_explainer
from models.backtest import run_full_backtest, compare_models_backtest

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global instances
collector = StockDataCollector(cache_ttl_hours=24)
feature_engineer = FeatureEngineer()
model_trainer = create_trainer()
trained_models: Dict[str, BaseModel] = {}

# Model storage path
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models", "saved")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting StockSense AI backend...")
    load_saved_models()
    yield
    # Shutdown
    logger.info("Shutting down StockSense AI backend...")


app = FastAPI(
    title="StockSense AI",
    description="Advanced Machine Learning Stock Prediction & Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Pydantic Models ====================

class StockSearchResult(PydanticBaseModel):
    symbol: str
    name: str
    market: str


class PredictionRequest(PydanticBaseModel):
    symbol: str
    model: str = "XGBoost"
    horizon: int = 1
    period: str = "1y"


class TechnicalIndicatorsResponse(PydanticBaseModel):
    symbol: str
    rsi: List[float]
    macd: List[float]
    macd_signal: List[float]
    macd_histogram: List[float]
    bb_upper: List[float]
    bb_middle: List[float]
    bb_lower: List[float]
    bb_position: List[float]
    atr: List[float]
    volatility: List[float]
    dates: List[str]


class PredictionResponse(PydanticBaseModel):
    symbol: str
    model: str
    horizon: int
    predicted_return: float
    predicted_price: float
    current_price: float
    confidence_interval: List[float] = []
    directional_bias: str
    timestamp: str


class BacktestResponse(PydanticBaseModel):
    symbol: str
    model: str
    metrics: Dict[str, float]
    predictions: List[float]
    actuals: List[float]
    dates: List[str]
    cumulative_returns: List[float]
    benchmark_returns: List[float]


class ModelMetrics(PydanticBaseModel):
    model: str
    mae: float
    rmse: float
    r2: float
    mape: float
    directional_accuracy: float


class ModelComparisonResponse(PydanticBaseModel):
    results: Dict[str, ModelMetrics]
    best_model: str
    baseline: ModelMetrics


class RegimeResponse(PydanticBaseModel):
    symbol: str
    regime: str
    confidence: float
    signals: Dict[str, Any]


class ResearchReport(PydanticBaseModel):
    symbol: str
    current_price: float
    price_range: Dict[str, Any]
    trend_analysis: Dict[str, Any]
    momentum_analysis: Dict[str, Any]
    volatility_assessment: Dict[str, Any]
    volume_analysis: Dict[str, Any]
    support_resistance: Dict[str, Any]
    overall_assessment: str
    timestamp: str


class StockComparisonItem(PydanticBaseModel):
    symbol: str
    current_price: float
    daily_change: float
    daily_change_pct: float
    rsi: float
    trend: str


# ==================== Helper Functions ====================

def load_saved_models() -> None:
    """Load pre-trained models from disk."""
    global trained_models
    model_dir = Path(MODEL_DIR)
    if model_dir.exists():
        for model_file in model_dir.glob("*.pkl"):
            try:
                name = model_file.stem
                if name == "LinearRegression":
                    model = LinearRegressionModel()
                elif name == "RandomForest":
                    model = RandomForestModel()
                elif name == "XGBoost":
                    model = XGBoostModel()
                elif name == "LSTM":
                    if _HAS_LSTM and LSTMModel is not None:
                        model = LSTMModel()
                    else:
                        continue
                else:
                    continue

                model.load(str(model_file))
                trained_models[name] = model
                logger.info(f"Loaded model: {name}")
            except Exception as e:
                logger.warning(f"Failed to load {model_file}: {e}")


def get_or_train_model(symbol: str, model_name: str, period: str = "1y") -> BaseModel:
    """Get trained model or train a new one."""
    global trained_models

    cache_key = f"{symbol}_{model_name}"

    if cache_key in trained_models:
        return trained_models[cache_key]

    # Fetch data and train
    logger.info(f"Training {model_name} for {symbol}...")
    df = collector.get_history(symbol, period=period)
    X, y, feature_names = feature_engineer.prepare_features(df, target_horizon=1)

    # Get model config
    model_map = {
        "LinearRegression": LinearRegressionModel,
        "RandomForest": RandomForestModel,
        "XGBoost": XGBoostModel,
    }
    if _HAS_LSTM and LSTMModel is not None:
        model_map["LSTM"] = LSTMModel

    if model_name not in model_map:
        raise ValueError(f"Unknown model: {model_name}")

    model = model_map[model_name]()
    model.feature_names = feature_names
    model.train(X, y)
    trained_models[cache_key] = model

    return model


def get_latest_features(symbol: str, period: str = "1y") -> tuple:
    """Get latest features for prediction."""
    df = collector.get_history(symbol, period=period)
    X, y, feature_names = feature_engineer.prepare_features(df, target_horizon=1)
    latest_features = feature_engineer.get_latest_features(df)
    current_price = df["close"].iloc[-1]
    return latest_features, current_price, feature_names, df


# ==================== API Endpoints ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "models_loaded": list(trained_models.keys()),
    }


@app.get("/api/stocks/search")
async def search_stocks(q: str = Query(..., min_length=1)):
    """Search for stock symbols."""
    results = collector.search_symbols(q)
    return [StockSearchResult(**r) for r in results]


@app.get("/api/stocks/compare", response_model=List[StockComparisonItem])
async def compare_stocks(
    symbols: str = Query(..., description="Comma-separated stock symbols (e.g. AAPL,MSFT,GOOGL)"),
):
    """Compare multiple stocks on key metrics (current price, daily change, RSI, trend)."""
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail="No symbols provided")

    results = []
    for sym in symbol_list:
        try:
            df = collector.get_history(sym, period="3mo")
            if df.empty or len(df) < 2:
                continue

            current_price = float(df["close"].iloc[-1])
            prev_close = float(df["close"].iloc[-2])
            daily_change = float(current_price - prev_close)
            daily_change_pct = float((daily_change / prev_close) * 100) if prev_close != 0 else 0.0

            df = feature_engineer.add_price_features(df)
            df = feature_engineer.add_technical_indicators(df)

            last_row = df.iloc[-1]
            rsi = float(last_row.get("rsi_14", 50.0))
            if pd.isna(rsi):
                rsi = 50.0

            sma_20 = float(last_row.get("sma_20", current_price))
            sma_50 = float(last_row.get("sma_50", current_price))
            if pd.isna(sma_20):
                sma_20 = current_price
            if pd.isna(sma_50):
                sma_50 = current_price

            if sma_20 > sma_50:
                trend = "bullish"
            elif sma_20 < sma_50:
                trend = "bearish"
            else:
                trend = "neutral"

            results.append(StockComparisonItem(
                symbol=sym,
                current_price=round(current_price, 2),
                daily_change=round(daily_change, 2),
                daily_change_pct=round(daily_change_pct, 2),
                rsi=round(rsi, 2),
                trend=trend,
            ))
        except Exception as e:
            logger.warning(f"Failed to fetch data for comparison of {sym}: {e}")

    if not results:
        raise HTTPException(status_code=404, detail=f"No data available for symbols: {symbols}")

    return results


@app.get("/api/stocks/{symbol}/history")
async def get_stock_history(
    symbol: str,
    period: str = Query("1y", pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$"),
    interval: str = Query("1d", pattern="^(1m|2m|5m|15m|30m|60m|90m|1h|1d|5d|1wk|1mo|3mo)$"),
):
    """Get historical stock data."""
    try:
        df = collector.get_history(symbol, period=period, interval=interval)
        return {
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "data": df.to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/stocks/{symbol}/indicators", response_model=TechnicalIndicatorsResponse)
async def get_technical_indicators(
    symbol: str,
    period: str = Query("1y", pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$"),
):
    """Get technical indicators for a stock."""
    try:
        df = collector.get_history(symbol, period=period)
        df = feature_engineer.add_price_features(df)
        df = feature_engineer.add_technical_indicators(df)

        # Get last 100 data points
        recent = df.tail(100)

        return TechnicalIndicatorsResponse(
            symbol=symbol,
            rsi=recent["rsi_14"].fillna(0).tolist(),
            macd=recent["macd"].fillna(0).tolist(),
            macd_signal=recent["macd_signal"].fillna(0).tolist(),
            macd_histogram=recent["macd_histogram"].fillna(0).tolist(),
            bb_upper=recent["bb_upper"].fillna(0).tolist(),
            bb_middle=recent["bb_middle"].fillna(0).tolist(),
            bb_lower=recent["bb_lower"].fillna(0).tolist(),
            bb_position=recent["bb_position"].fillna(0).tolist(),
            atr=recent["atr_14"].fillna(0).tolist(),
            volatility=recent["volatility_20"].fillna(0).tolist(),
            dates=[d.isoformat() if hasattr(d, 'isoformat') else str(d) for d in recent["date"].tolist()],
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/stocks/{symbol}/regime", response_model=RegimeResponse)
async def get_stock_regime(
    symbol: str,
    period: str = Query("1y", pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$"),
):
    """Classify current market regime for a stock."""
    try:
        df = collector.get_history(symbol, period=period)
        regime_data = feature_engineer.classify_regime(df)
        return RegimeResponse(
            symbol=symbol.upper(),
            regime=regime_data["regime"],
            confidence=regime_data["confidence"],
            signals=regime_data["signals"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Regime classification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/research/{symbol}", response_model=ResearchReport)
async def get_research_report(symbol: str):
    """Generate structured AI research report for a stock."""
    try:
        df = collector.get_history(symbol, period="1y")
        df = feature_engineer.add_price_features(df)
        df = feature_engineer.add_technical_indicators(df)

        if df.empty or len(df) < 20:
            raise HTTPException(status_code=400, detail="Insufficient data for research report")

        last_row = df.iloc[-1]
        current_price = float(last_row["close"])

        # 52-week range
        high_52w = float(df["high"].max())
        low_52w = float(df["low"].min())
        change_from_high = float(((current_price - high_52w) / high_52w) * 100) if high_52w > 0 else 0.0
        change_from_low = float(((current_price - low_52w) / low_52w) * 100) if low_52w > 0 else 0.0

        price_range = {
            "current_price": round(current_price, 2),
            "high_52w": round(high_52w, 2),
            "low_52w": round(low_52w, 2),
            "change_from_52w_high_pct": round(change_from_high, 2),
            "change_from_52w_low_pct": round(change_from_low, 2),
        }

        # Trend analysis
        sma_20 = float(last_row.get("sma_20", current_price))
        sma_50 = float(last_row.get("sma_50", current_price))
        if sma_20 > sma_50:
            sma_crossover = "bullish"
            if current_price > sma_20:
                trend_desc = f"Strong upward trend: price ({current_price:.2f}) is trading above both 20-day SMA ({sma_20:.2f}) and 50-day SMA ({sma_50:.2f})."
            else:
                trend_desc = f"Moderate bullish trend with price ({current_price:.2f}) pulling back below 20-day SMA ({sma_20:.2f})."
        elif sma_20 < sma_50:
            sma_crossover = "bearish"
            if current_price < sma_20:
                trend_desc = f"Strong downward trend: price ({current_price:.2f}) is trading below both 20-day SMA ({sma_20:.2f}) and 50-day SMA ({sma_50:.2f})."
            else:
                trend_desc = f"Moderate bearish trend with price ({current_price:.2f}) rebounding above 20-day SMA ({sma_20:.2f})."
        else:
            sma_crossover = "neutral"
            trend_desc = "Neutral/sideways trend with SMAs converging."

        trend_analysis = {
            "sma_20": round(sma_20, 2),
            "sma_50": round(sma_50, 2),
            "sma_crossover": sma_crossover,
            "trend_description": trend_desc,
        }

        # Momentum
        rsi = float(last_row.get("rsi_14", 50.0))
        macd = float(last_row.get("macd", 0.0))
        macd_signal = float(last_row.get("macd_signal", 0.0))
        macd_histogram = float(last_row.get("macd_histogram", 0.0))

        if rsi > 70:
            rsi_cond = "overbought"
        elif rsi < 30:
            rsi_cond = "oversold"
        else:
            rsi_cond = "neutral"

        if macd > macd_signal and macd_histogram > 0:
            macd_interp = "Bullish momentum: MACD line is above the signal line with positive expansion."
        elif macd < macd_signal and macd_histogram < 0:
            macd_interp = "Bearish momentum: MACD line is below the signal line with downward expansion."
        elif macd > macd_signal:
            macd_interp = "Weakening bullish momentum: MACD is above signal but histogram is contracting."
        else:
            macd_interp = "Weakening bearish momentum: MACD is below signal but histogram is narrowing."

        momentum_analysis = {
            "rsi": round(rsi, 2),
            "rsi_condition": rsi_cond,
            "macd": round(macd, 4),
            "macd_signal": round(macd_signal, 4),
            "macd_histogram": round(macd_histogram, 4),
            "macd_interpretation": macd_interp,
        }

        # Volatility
        atr = float(last_row.get("atr_14", 0.0))
        bb_width = float(last_row.get("bb_width", 0.0))
        bb_pos = float(last_row.get("bb_position", 0.5))

        if bb_width > 0.15:
            vol_eval = f"High volatility: Bollinger Band width is elevated ({bb_width:.3f}), reflecting wide price swings."
        elif bb_width < 0.05:
            vol_eval = f"Low volatility / squeeze: Bollinger Band width is compressed ({bb_width:.3f}), signaling a potential breakout."
        else:
            vol_eval = f"Moderate volatility: Bollinger Band width is steady at {bb_width:.3f}."

        volatility_assessment = {
            "atr": round(atr, 2),
            "bollinger_width": round(bb_width, 4),
            "bb_position": round(bb_pos, 4),
            "volatility_assessment": vol_eval,
        }

        # Volume
        cur_vol = float(last_row.get("volume", 0.0))
        vol_sma = float(last_row.get("volume_sma_20", cur_vol))
        vol_ratio = float(cur_vol / vol_sma if vol_sma > 0 else 1.0)

        if vol_ratio > 1.5:
            vol_eval_text = f"High volume surge: Current volume is {vol_ratio:.2f}x the 20-day average, showing strong institutional participation."
        elif vol_ratio < 0.7:
            vol_eval_text = f"Light volume: Current volume is {vol_ratio:.2f}x the 20-day average, indicating consolidation or low market interest."
        else:
            vol_eval_text = f"Average volume: Trading activity is in line with the 20-day moving average ({vol_ratio:.2f}x)."

        volume_analysis = {
            "current_volume": round(cur_vol, 0),
            "avg_volume_20d": round(vol_sma, 0),
            "volume_ratio": round(vol_ratio, 2),
            "volume_assessment": vol_eval_text,
        }

        # Key support & resistance levels (using recent 50 trading days)
        recent_window = df.tail(min(len(df), 50))
        recent_low = float(recent_window["low"].min())
        recent_high = float(recent_window["high"].max())
        support = recent_low
        resistance = recent_high

        support_resistance = {
            "support": round(support, 2),
            "resistance": round(resistance, 2),
            "recent_low": round(recent_low, 2),
            "recent_high": round(recent_high, 2),
        }

        # Overall assessment text
        bias = "bullish" if sma_crossover == "bullish" and rsi > 45 else ("bearish" if sma_crossover == "bearish" and rsi < 55 else "neutral")
        overall = (
            f"{symbol.upper()} is currently trading at {current_price:.2f} with an overall {bias.upper()} technical outlook. "
            f"The asset has traded in a 52-week range of {low_52w:.2f} - {high_52w:.2f}. "
            f"{trend_desc} Momentum is {rsi_cond} with RSI at {rsi:.1f}. "
            f"Key support is identified at {support:.2f} and resistance near {resistance:.2f}."
        )

        return ResearchReport(
            symbol=symbol.upper(),
            current_price=round(current_price, 2),
            price_range=price_range,
            trend_analysis=trend_analysis,
            momentum_analysis=momentum_analysis,
            volatility_assessment=volatility_assessment,
            volume_analysis=volume_analysis,
            support_resistance=support_resistance,
            overall_assessment=overall,
            timestamp=pd.Timestamp.now().isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Research report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export/predictions/{symbol}")
async def export_predictions(
    symbol: str,
    model: str = Query("XGBoost"),
    period: str = Query("1y"),
):
    """Export historical predictions vs actual prices as a CSV stream."""
    try:
        df = collector.get_history(symbol, period=period)
        X, y, feature_names = feature_engineer.prepare_features(df, target_horizon=1)
        trained_model = get_or_train_model(symbol, model, period)

        predicted_returns = trained_model.predict(X)

        df_feat = feature_engineer.add_price_features(df)
        df_feat = feature_engineer.add_technical_indicators(df_feat)
        df_feat = feature_engineer.add_target_variables(df_feat, horizons=[1])
        df_feat = df_feat.dropna()

        actual_prices = df_feat["close"].values
        dates = df_feat["date"].values

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["date", "actual_price", "predicted_return", "predicted_price", "model"])

        for d, actual, pred_ret in zip(dates, actual_prices, predicted_returns):
            pred_price = actual * (1 + pred_ret)
            date_str = d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10]
            writer.writerow([date_str, f"{float(actual):.4f}", f"{float(pred_ret):.6f}", f"{float(pred_price):.4f}", model])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{symbol}_predictions.csv"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export predictions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/predict", response_model=PredictionResponse)
async def predict(
    request: PredictionRequest,
):
    """Generate prediction for a stock."""
    try:
        symbol = request.symbol
        model = request.model
        horizon = request.horizon
        period = request.period

        trained_model = get_or_train_model(symbol, model, period)

        # Get latest features
        latest_features, current_price, feature_names, df = get_latest_features(
            symbol, period
        )

        # Make prediction
        predicted_return = trained_model.predict(latest_features)[0]
        predicted_price = current_price * (1 + predicted_return)

        # Determine directional bias
        if predicted_return > 0.01:
            bias = "bullish"
        elif predicted_return < -0.01:
            bias = "bearish"
        else:
            bias = "neutral"

        # Get uncertainty estimate if available
        confidence_interval = []
        if hasattr(trained_model, 'predict_with_uncertainty'):
            try:
                mean_pred, std_pred = trained_model.predict_with_uncertainty(latest_features)
                confidence_interval = [
                    float(current_price * (1 + mean_pred[0] - 1.96 * std_pred[0])),
                    float(current_price * (1 + mean_pred[0] + 1.96 * std_pred[0])),
                ]
            except:
                pass

        return PredictionResponse(
            symbol=symbol,
            model=model,
            horizon=horizon,
            predicted_return=float(predicted_return),
            predicted_price=float(predicted_price),
            current_price=float(current_price),
            confidence_interval=confidence_interval,
            directional_bias=bias,
            timestamp=pd.Timestamp.now().isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/models/compare", response_model=ModelComparisonResponse)
async def compare_models(
    symbol: str = Query(...),
    period: str = Query("1y"),
    use_walk_forward: bool = Query(False),
):
    """Compare all models on a stock."""
    try:
        df = collector.get_history(symbol, period=period)
        X, y, feature_names = feature_engineer.prepare_features(df, target_horizon=1)

        results = model_trainer.compare_models(
            X, y, feature_names, use_walk_forward=use_walk_forward
        )

        # Format results
        formatted = {}
        for name, result in results.items():
            metrics = result.get("test_metrics", result.get("avg_metrics", {}))
            formatted[name] = ModelMetrics(
                model=name,
                mae=float(metrics.get("mae", 0)),
                rmse=float(metrics.get("rmse", 0)),
                r2=float(metrics.get("r2", 0)),
                mape=float(metrics.get("mape", 0)),
                directional_accuracy=float(metrics.get("directional_accuracy", 0)),
            )

        # Find best model (excluding baseline)
        best_model = "NaiveBaseline"
        best_rmse = float("inf")
        for name, m in formatted.items():
            if name != "NaiveBaseline" and m.rmse < best_rmse:
                best_rmse = m.rmse
                best_model = name

        baseline = formatted.get("NaiveBaseline", ModelMetrics(
            model="NaiveBaseline",
            mae=0, rmse=0, r2=0, mape=0, directional_accuracy=0
        ))

        return ModelComparisonResponse(
            results=formatted,
            best_model=best_model,
            baseline=baseline,
        )
    except Exception as e:
        logger.error(f"Model comparison error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/models/metrics")
async def get_model_metrics(
    symbol: str = Query(...),
    period: str = Query("1y"),
):
    """Get detailed metrics for all models."""
    try:
        df = collector.get_history(symbol, period=period)
        X, y, feature_names = feature_engineer.prepare_features(df, target_horizon=1)

        results = model_trainer.compare_models(X, y, feature_names)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/models/explain/{symbol}")
async def explain_model(
    symbol: str,
    model: str = Query("XGBoost"),
    period: str = Query("1y"),
):
    """Get SHAP explanations for a model's prediction."""
    try:
        trained_model = get_or_train_model(symbol, model, period)

        # Get features for explanation
        df = collector.get_history(symbol, period=period)
        X, y, feature_names = feature_engineer.prepare_features(df, target_horizon=1)

        # Create explainer
        explainer = create_explainer(trained_model, feature_names)

        # Explain latest prediction
        explanation = explainer.explain_prediction(X, sample_idx=-1)

        if "error" in explanation:
            return {"error": explanation["error"]}

        return {
            "model": model,
            "symbol": symbol,
            "expected_value": explanation.get("expected_value", 0),
            "prediction": explanation.get("prediction", 0),
            "feature_contributions": explanation.get("feature_contributions", {}),
            "top_positive": explanation.get("top_positive", []),
            "top_negative": explanation.get("top_negative", []),
        }
    except Exception as e:
        logger.error(f"Explainability error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/backtest/{symbol}", response_model=BacktestResponse)
async def backtest_symbol(
    symbol: str,
    model: str = Query("XGBoost"),
    period: str = Query("2y"),
    horizon: int = Query(1),
):
    """Run backtest for a symbol and model."""
    try:
        trained_model = get_or_train_model(symbol, model, period)

        result = run_full_backtest(
            symbol=symbol,
            model=trained_model,
            feature_engineer=feature_engineer,
            collector=collector,
            period=period,
            target_horizon=horizon,
        )

        return BacktestResponse(
            symbol=symbol,
            model=model,
            metrics=result.metrics,
            predictions=result.predictions.tolist(),
            actuals=result.actuals.tolist(),
            dates=[d.isoformat() if hasattr(d, 'isoformat') else str(d) for d in result.dates],
            cumulative_returns=result.cumulative_returns.tolist(),
            benchmark_returns=result.benchmark_returns.tolist(),
        )
    except Exception as e:
        logger.error(f"Backtest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/company/{symbol}")
async def get_company_info(symbol: str):
    """Get company information."""
    try:
        info = collector.get_company_info(symbol)
        return info
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/price/{symbol}")
async def get_current_price(symbol: str):
    """Get current price information."""
    try:
        price_info = collector.get_current_price(symbol)
        return price_info
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==================== Main ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)