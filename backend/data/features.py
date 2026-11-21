"""
Feature engineering module for StockSense AI.
Calculates technical indicators and price features without look-ahead bias.
"""

import logging
from typing import Optional, List, Dict, Any
import warnings

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Suppress pandas-ta warnings
warnings.filterwarnings("ignore", category=FutureWarning)


class FeatureEngineer:
    """
    Feature engineering pipeline for stock prediction.
    All features are calculated using only information available at the prediction timestamp
    to prevent look-ahead bias.
    """

    def __init__(self):
        self.feature_columns: List[str] = []

    def add_price_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add price-based features."""
        df = df.copy()

        # Daily returns
        df["returns"] = df["close"].pct_change()
        df["log_returns"] = np.log(df["close"] / df["close"].shift(1))

        # High-Low percentage
        df["hl_pct"] = (df["high"] - df["low"]) / df["close"]

        # Open-Close percentage
        df["oc_pct"] = (df["close"] - df["open"]) / df["open"]

        # Rolling returns (5, 10, 20 days)
        for window in [5, 10, 20]:
            df[f"rolling_return_{window}"] = df["close"].pct_change(window)

        # Price relative to rolling max/min
        for window in [10, 20, 50]:
            df[f"price_to_max_{window}"] = df["close"] / df["high"].rolling(window).max()
            df[f"price_to_min_{window}"] = df["close"] / df["low"].rolling(window).min()

        return df

    def add_technical_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add technical indicators using pandas-ta or manual calculations."""
        df = df.copy()

        # Simple Moving Averages
        for window in [10, 20, 50]:
            df[f"sma_{window}"] = df["close"].rolling(window).mean()
            df[f"sma_{window}_ratio"] = df["close"] / df[f"sma_{window}"]

        # Exponential Moving Averages
        for window in [12, 26]:
            df[f"ema_{window}"] = df["close"].ewm(span=window, adjust=False).mean()
            df[f"ema_{window}_ratio"] = df["close"] / df[f"ema_{window}"]

        # RSI (Relative Strength Index)
        df["rsi_14"] = self._calculate_rsi(df["close"], 14)

        # MACD
        df = self._calculate_macd(df)

        # Bollinger Bands
        df = self._calculate_bollinger_bands(df)

        # ATR (Average True Range)
        df["atr_14"] = self._calculate_atr(df, 14)

        # Rolling Volatility
        for window in [10, 20, 50]:
            df[f"volatility_{window}"] = df["returns"].rolling(window).std() * np.sqrt(252)

        # Volume indicators
        df["volume_sma_20"] = df["volume"].rolling(20).mean()
        df["volume_ratio"] = df["volume"] / df["volume_sma_20"]

        # OBV (On Balance Volume)
        df["obv"] = self._calculate_obv(df)

        # Price momentum
        for window in [5, 10, 20]:
            df[f"momentum_{window}"] = df["close"] / df["close"].shift(window) - 1

        return df

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate RSI."""
        delta = prices.diff()
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)

        avg_gain = gain.rolling(period).mean()
        avg_loss = loss.rolling(period).mean()

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    def _calculate_macd(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate MACD."""
        ema_12 = df["close"].ewm(span=12, adjust=False).mean()
        ema_26 = df["close"].ewm(span=26, adjust=False).mean()

        df["macd"] = ema_12 - ema_26
        df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
        df["macd_histogram"] = df["macd"] - df["macd_signal"]
        return df

    def _calculate_bollinger_bands(self, df: pd.DataFrame, period: int = 20, std_dev: int = 2) -> pd.DataFrame:
        """Calculate Bollinger Bands."""
        sma = df["close"].rolling(period).mean()
        std = df["close"].rolling(period).std()

        df["bb_upper"] = sma + (std * std_dev)
        df["bb_middle"] = sma
        df["bb_lower"] = sma - (std * std_dev)
        df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / df["bb_middle"]
        df["bb_position"] = (df["close"] - df["bb_lower"]) / (df["bb_upper"] - df["bb_lower"])
        return df

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average True Range."""
        high_low = df["high"] - df["low"]
        high_close = np.abs(df["high"] - df["close"].shift())
        low_close = np.abs(df["low"] - df["close"].shift())

        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr = true_range.rolling(period).mean()
        return atr

    def _calculate_obv(self, df: pd.DataFrame) -> pd.Series:
        """Calculate On Balance Volume."""
        obv = np.where(df["close"] > df["close"].shift(1), df["volume"],
                       np.where(df["close"] < df["close"].shift(1), -df["volume"], 0))
        return pd.Series(obv, index=df.index).cumsum()

    def add_target_variables(self, df: pd.DataFrame, horizons: List[int] = [1, 5]) -> pd.DataFrame:
        """
        Add target variables for prediction.

        Args:
            df: Input DataFrame
            horizons: List of forward-looking periods (in trading days)

        Returns:
            DataFrame with target columns added
        """
        df = df.copy()

        for horizon in horizons:
            # Next N-day return
            df[f"target_return_{horizon}d"] = df["close"].shift(-horizon) / df["close"] - 1

            # Next N-day price
            df[f"target_price_{horizon}d"] = df["close"].shift(-horizon)

            # Direction (1 if up, 0 if down)
            df[f"target_direction_{horizon}d"] = (df[f"target_return_{horizon}d"] > 0).astype(int)

        return df

    def prepare_features(
        self,
        df: pd.DataFrame,
        target_horizon: int = 1,
        drop_na: bool = True,
    ) -> tuple:
        """
        Prepare features and target for model training.

        Args:
            df: Raw OHLCV DataFrame
            target_horizon: Prediction horizon in days
            drop_na: Whether to drop rows with NaN values

        Returns:
            Tuple of (X, y, feature_names)
        """
        df = df.copy()

        # Add all features
        df = self.add_price_features(df)
        df = self.add_technical_indicators(df)
        df = self.add_target_variables(df, horizons=[target_horizon])

        # Define feature columns (exclude target and date columns)
        exclude_cols = ["date", "open", "high", "low", "close", "adj_close", "volume"]
        target_cols = [c for c in df.columns if c.startswith("target_")]
        exclude_cols.extend(target_cols)

        feature_cols = [c for c in df.columns if c not in exclude_cols]

        # Drop rows with NaN
        if drop_na:
            df = df.dropna()

        if df.empty:
            raise ValueError("No data remaining after dropping NaN values")

        X = df[feature_cols].values
        y = df[f"target_return_{target_horizon}d"].values

        self.feature_columns = feature_cols

        return X, y, feature_cols

    def get_latest_features(self, df: pd.DataFrame) -> np.ndarray:
        """
        Get features for the latest row (for prediction).

        Args:
            df: Raw OHLCV DataFrame

        Returns:
            Feature array for the latest row
        """
        df = df.copy()
        df = self.add_price_features(df)
        df = self.add_technical_indicators(df)

        # Get the last row with all features
        feature_cols = self.feature_columns
        if not feature_cols:
            raise ValueError("Feature columns not set. Call prepare_features first.")

        latest = df[feature_cols].iloc[[-1]]

        if latest.isna().any().any():
            # Try to forward fill
            latest = latest.ffill()

        return latest.values

    def classify_regime(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Classify market regime based on technical indicators.

        Conditions:
        - 20-day SMA vs 50-day SMA crossover (bullish/bearish)
        - 20-day rolling volatility percentile (high_volatility if > 75th percentile)
        - RSI zones (overbought > 70, oversold < 30)

        Returns:
            dict with regime ("bullish"/"bearish"/"sideways"/"high_volatility"), confidence, signals dict
        """
        df = df.copy()
        if "sma_20" not in df.columns or "sma_50" not in df.columns or "rsi_14" not in df.columns or "volatility_20" not in df.columns:
            df = self.add_price_features(df)
            df = self.add_technical_indicators(df)

        # Find latest valid values
        valid_df = df.dropna(subset=["sma_20", "sma_50", "rsi_14", "volatility_20"])
        if valid_df.empty:
            valid_df = df.dropna(subset=["close"])
            if valid_df.empty:
                raise ValueError("DataFrame has insufficient data for regime classification")

        last_row = valid_df.iloc[-1]
        sma_20 = float(last_row.get("sma_20", last_row["close"]))
        sma_50 = float(last_row.get("sma_50", last_row["close"]))
        current_rsi = float(last_row.get("rsi_14", 50.0))
        current_vol = float(last_row.get("volatility_20", 0.0))

        # 20-day rolling volatility percentile
        vol_series = df["volatility_20"].dropna()
        if len(vol_series) > 0:
            vol_75th = float(vol_series.quantile(0.75))
            vol_percentile = float((vol_series <= current_vol).mean() * 100)
            is_high_vol = current_vol > vol_75th
        else:
            vol_75th = 0.0
            vol_percentile = 50.0
            is_high_vol = False

        # RSI zones (overbought > 70, oversold < 30)
        if current_rsi > 70:
            rsi_zone = "overbought"
        elif current_rsi < 30:
            rsi_zone = "oversold"
        else:
            rsi_zone = "neutral"

        # 20-day SMA vs 50-day SMA crossover (bullish/bearish)
        sma_diff_pct = (sma_20 - sma_50) / sma_50 if sma_50 > 0 else 0.0
        if sma_20 > sma_50:
            sma_signal = "bullish"
        elif sma_20 < sma_50:
            sma_signal = "bearish"
        else:
            sma_signal = "sideways"

        # Determine regime: "bullish", "bearish", "sideways", "high_volatility"
        if is_high_vol:
            regime = "high_volatility"
            confidence = min(0.95, max(0.60, round(vol_percentile / 100.0, 2)))
        elif abs(sma_diff_pct) < 0.005 and 45.0 <= current_rsi <= 55.0:
            regime = "sideways"
            confidence = round(1.0 - abs(current_rsi - 50.0) / 50.0, 2)
        elif sma_20 > sma_50:
            regime = "bullish"
            conf = 0.70
            if current_rsi > 50:
                conf += 0.15
            if current_rsi > 70:
                conf -= 0.10
            confidence = round(min(0.95, max(0.50, conf)), 2)
        else:
            regime = "bearish"
            conf = 0.70
            if current_rsi < 50:
                conf += 0.15
            if current_rsi < 30:
                conf -= 0.10
            confidence = round(min(0.95, max(0.50, conf)), 2)

        signals = {
            "sma_20": float(round(sma_20, 2)),
            "sma_50": float(round(sma_50, 2)),
            "sma_crossover": sma_signal,
            "sma_diff_pct": float(round(sma_diff_pct * 100, 2)),
            "rsi": float(round(current_rsi, 2)),
            "rsi_zone": rsi_zone,
            "volatility": float(round(current_vol, 4)),
            "volatility_75th": float(round(vol_75th, 4)),
            "volatility_percentile": float(round(vol_percentile, 2)),
            "is_high_volatility": bool(is_high_vol),
        }

        return {
            "regime": regime,
            "confidence": float(confidence),
            "signals": signals,
        }