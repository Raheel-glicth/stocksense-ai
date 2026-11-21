"""
Backtesting module for StockSense AI.
Implements walk-forward backtesting with proper evaluation.
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from pathlib import Path

from .trainer import ModelTrainer
from .base import BaseModel

# Use absolute imports to avoid relative import issues
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from data.features import FeatureEngineer
from data.collector import StockDataCollector

logger = logging.getLogger(__name__)


@dataclass
class BacktestResult:
    """Results from a backtest run."""
    symbol: str
    model_name: str
    predictions: np.ndarray
    actuals: np.ndarray
    dates: np.ndarray
    metrics: Dict[str, float]
    trade_signals: np.ndarray
    returns: np.ndarray
    cumulative_returns: np.ndarray
    benchmark_returns: np.ndarray


class Backtester:
    """
    Walk-forward backtesting for stock prediction models.
    """

    def __init__(
        self,
        model: BaseModel,
        feature_engineer: FeatureEngineer,
        train_window: int = 252,  # ~1 year of trading days
        test_window: int = 20,    # ~1 month
        step: int = 20,           # Step size
    ):
        self.model = model
        self.feature_engineer = feature_engineer
        self.train_window = train_window
        self.test_window = test_window
        self.step = step

    def run_backtest(
        self,
        df: pd.DataFrame,
        target_horizon: int = 1,
    ) -> BacktestResult:
        """
        Run walk-forward backtest.

        Args:
            df: Historical OHLCV DataFrame
            target_horizon: Prediction horizon in days

        Returns:
            BacktestResult with predictions and metrics
        """
        # Prepare features and targets
        X, y, feature_names = self.feature_engineer.prepare_features(
            df, target_horizon=target_horizon, drop_na=True
        )

        self.model.feature_names = feature_names

        n_samples = len(X)
        predictions = []
        actuals = []
        dates = []

        # Walk-forward loop
        for i in range(self.train_window, n_samples - self.test_window, self.step):
            train_start = max(0, i - self.train_window)
            train_end = i
            test_end = min(i + self.test_window, n_samples)

            X_train = X[train_start:train_end]
            y_train = y[train_start:train_end]
            X_test = X[i:test_end]
            y_test = y[i:test_end]

            if len(X_train) < 50 or len(X_test) == 0:
                continue

            try:
                # Train model
                self.model.train(X_train, y_train)

                # Predict
                y_pred = self.model.predict(X_test)

                predictions.extend(y_pred)
                actuals.extend(y_test)
                dates.extend(df["date"].iloc[i:test_end].values)

            except Exception as e:
                logger.warning(f"Backtest step {i} failed: {e}")
                continue

        predictions = np.array(predictions)
        actuals = np.array(actuals)
        dates = np.array(dates)

        if len(predictions) == 0:
            raise ValueError("No predictions generated during backtest")

        # Generate trade signals
        trade_signals = self._generate_signals(predictions, actuals)

        # Calculate returns
        returns = self._calculate_returns(actuals, trade_signals)
        cumulative_returns = np.cumprod(1 + returns) - 1

        # Calculate metrics
        metrics = self._calculate_metrics(
            actuals, predictions, returns=returns, trade_signals=trade_signals
        )

        # Benchmark (buy and hold)
        benchmark_returns = actuals  # Actual market returns
        benchmark_cumulative = np.cumprod(1 + benchmark_returns) - 1

        return BacktestResult(
            symbol="",  # Will be set by caller
            model_name=self.model.name,
            predictions=predictions,
            actuals=actuals,
            dates=dates,
            metrics=metrics,
            trade_signals=trade_signals,
            returns=returns,
            cumulative_returns=cumulative_returns,
            benchmark_returns=benchmark_cumulative,
        )

    def _calculate_metrics(
        self,
        actuals: np.ndarray,
        predictions: np.ndarray,
        returns: Optional[np.ndarray] = None,
        trade_signals: Optional[np.ndarray] = None,
    ) -> Dict[str, float]:
        """Calculate backtest metrics."""
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

        mae = mean_absolute_error(actuals, predictions)
        rmse = np.sqrt(mean_squared_error(actuals, predictions))
        r2 = r2_score(actuals, predictions)

        mask = np.abs(actuals) > 1e-8
        mape = np.mean(np.abs((actuals[mask] - predictions[mask]) / actuals[mask])) * 100 if mask.any() else np.inf

        dir_acc = np.mean((actuals > 0) == (predictions > 0)) * 100

        # Additional metrics
        correlation = np.corrcoef(actuals, predictions)[0, 1] if len(actuals) > 1 else 0

        # Compute strategy returns if not provided
        if returns is None:
            if trade_signals is None:
                trade_signals = self._generate_signals(predictions, actuals)
            returns = self._calculate_returns(actuals, trade_signals)

        # 1. Sharpe Ratio (annualized, 252 trading days, risk-free rate = 0)
        ret_std = np.std(returns)
        if len(returns) > 1 and ret_std > 1e-8:
            sharpe_ratio = float((np.mean(returns) / ret_std) * np.sqrt(252))
        else:
            sharpe_ratio = 0.0

        # 2. Maximum Drawdown (maximum peak-to-trough decline)
        cum_ret = np.cumprod(1 + returns)
        peak = np.maximum.accumulate(cum_ret)
        drawdowns = (cum_ret - peak) / peak
        max_drawdown = float(abs(np.min(drawdowns))) if len(drawdowns) > 0 else 0.0

        # 3. Win Rate (percentage of trades with positive return)
        if trade_signals is not None and np.any(trade_signals != 0):
            shifted_signals = np.roll(trade_signals, 1)
            shifted_signals[0] = 0
            active_returns = returns[shifted_signals != 0]
        else:
            active_returns = returns[returns != 0]

        if len(active_returns) > 0:
            win_rate = float(np.mean(active_returns > 0) * 100)
        else:
            win_rate = 0.0

        # 4. Profit Factor (gross profit / gross loss)
        gross_profit = float(np.sum(returns[returns > 0]))
        gross_loss = float(abs(np.sum(returns[returns < 0])))
        if gross_loss > 1e-8:
            profit_factor = float(gross_profit / gross_loss)
        elif gross_profit > 0:
            profit_factor = float(gross_profit)
        else:
            profit_factor = 0.0

        # 5. Total Return (cumulative return over the period)
        total_return = float(cum_ret[-1] - 1.0) if len(cum_ret) > 0 else 0.0

        return {
            "mae": float(mae),
            "rmse": float(rmse),
            "r2": float(r2),
            "mape": float(mape),
            "directional_accuracy": float(dir_acc),
            "correlation": float(correlation),
            "n_predictions": len(predictions),
            "sharpe_ratio": float(sharpe_ratio),
            "max_drawdown": float(max_drawdown),
            "win_rate": float(win_rate),
            "profit_factor": float(profit_factor),
            "total_return": float(total_return),
        }

    def _generate_signals(
        self,
        predictions: np.ndarray,
        actuals: np.ndarray,
    ) -> np.ndarray:
        """
        Generate trading signals based on predictions.
        1 = long, -1 = short, 0 = flat
        """
        # Simple threshold-based signals
        threshold = np.std(predictions) * 0.5
        signals = np.where(predictions > threshold, 1,
                  np.where(predictions < -threshold, -1, 0))
        return signals

    def _calculate_returns(
        self,
        actuals: np.ndarray,
        signals: np.ndarray,
    ) -> np.ndarray:
        """
        Calculate strategy returns.
        Note: This is a simplified calculation that doesn't account for
        transaction costs, slippage, or execution assumptions.
        """
        # Strategy returns = signal * actual return
        # Shift signals by 1 to avoid look-ahead (signal at t based on info at t-1)
        shifted_signals = np.roll(signals, 1)
        shifted_signals[0] = 0  # No position on first day

        returns = shifted_signals * actuals
        return returns


def run_full_backtest(
    symbol: str,
    model: BaseModel,
    feature_engineer: FeatureEngineer,
    collector: StockDataCollector,
    period: str = "2y",
    target_horizon: int = 1,
    train_window: int = 252,
    test_window: int = 20,
    step: int = 20,
) -> BacktestResult:
    """
    Run a complete backtest for a symbol.

    Args:
        symbol: Stock symbol
        model: Trained or untrained model
        feature_engineer: FeatureEngineer instance
        collector: StockDataCollector instance
        period: Data period to fetch
        target_horizon: Prediction horizon
        train_window: Training window size
        test_window: Test window size
        step: Step size for walk-forward

    Returns:
        BacktestResult
    """
    # Fetch data
    logger.info(f"Fetching data for {symbol}...")
    df = collector.get_history(symbol, period=period)

    # Run backtest
    backtester = Backtester(
        model=model,
        feature_engineer=feature_engineer,
        train_window=train_window,
        test_window=test_window,
        step=step,
    )

    result = backtester.run_backtest(df, target_horizon)
    result.symbol = symbol

    logger.info(f"Backtest completed for {symbol}. Metrics: {result.metrics}")
    return result


def compare_models_backtest(
    symbol: str,
    models: Dict[str, BaseModel],
    feature_engineer: FeatureEngineer,
    collector: StockDataCollector,
    period: str = "2y",
    target_horizon: int = 1,
) -> Dict[str, BacktestResult]:
    """
    Run backtest for multiple models and compare.

    Returns:
        Dictionary of model_name -> BacktestResult
    """
    results = {}

    for name, model in models.items():
        logger.info(f"Running backtest for {name}...")
        try:
            result = run_full_backtest(
                symbol=symbol,
                model=model,
                feature_engineer=feature_engineer,
                collector=collector,
                period=period,
                target_horizon=target_horizon,
            )
            results[name] = result
        except Exception as e:
            logger.error(f"Backtest failed for {name}: {e}")
            results[name] = {"error": str(e)}

    return results