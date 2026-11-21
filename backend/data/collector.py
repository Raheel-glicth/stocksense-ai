"""
Stock data collection module using yfinance.
Handles data retrieval, caching, validation, and cleaning.
"""

import os
import logging
import hashlib
import json
import pickle
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from pathlib import Path

import yfinance as yf
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

import tempfile

CACHE_DIR = Path(tempfile.gettempdir()) / "stocksense_cache"
try:
    CACHE_DIR.mkdir(exist_ok=True, parents=True)
except Exception:
    pass


class StockDataCollector:
    """
    Collects and caches historical stock data from Yahoo Finance.
    """

    SUPPORTED_MARKETS = {
        "US": "",
        "INDIA": ".NS",
    }

    def __init__(self, cache_ttl_hours: int = 24):
        self.cache_ttl_hours = cache_ttl_hours
        self._cache = {}

    def _get_cache_key(self, symbol: str, period: str, interval: str) -> str:
        """Generate a unique cache key for the request."""
        key_string = f"{symbol}_{period}_{interval}"
        return hashlib.md5(key_string.encode()).hexdigest()

    def _get_cache_path(self, cache_key: str) -> Path:
        """Get the file path for a cache key."""
        return CACHE_DIR / f"{cache_key}.pkl"

    def _is_cache_valid(self, cache_path: Path) -> bool:
        """Check if cache file exists and is within TTL."""
        if not cache_path.exists():
            return False

        mtime = datetime.fromtimestamp(cache_path.stat().st_mtime)
        age = datetime.now() - mtime
        return age < timedelta(hours=self.cache_ttl_hours)

    def _load_from_cache(self, cache_key: str) -> Optional[pd.DataFrame]:
        """Load data from cache if valid."""
        cache_path = self._get_cache_path(cache_key)
        if self._is_cache_valid(cache_path):
            try:
                with open(cache_path, "rb") as f:
                    data = pickle.load(f)
                logger.info(f"Loaded {cache_key} from cache")
                return data
            except Exception as e:
                logger.warning(f"Failed to load cache {cache_key}: {e}")
        return None

    def _save_to_cache(self, cache_key: str, data: pd.DataFrame) -> None:
        """Save data to cache."""
        cache_path = self._get_cache_path(cache_key)
        try:
            with open(cache_path, "wb") as f:
                pickle.dump(data, f)
            logger.info(f"Saved {cache_key} to cache")
        except Exception as e:
            logger.warning(f"Failed to save cache {cache_key}: {e}")

    def normalize_symbol(self, symbol: str) -> str:
        """Normalize stock symbol for Yahoo Finance."""
        symbol = symbol.upper().strip()
        if not any(symbol.endswith(suffix) for suffix in [".NS", ".BO", ".L", ".TO"]):
            # Default to US market if no suffix
            pass
        return symbol

    def search_symbols(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for stock symbols matching the query.
        Note: yfinance doesn't have a direct search API, so we use a curated list
        and fuzzy matching for common stocks.
        """
        # Common Indian stocks
        indian_stocks = {
            "RELIANCE": "RELIANCE.NS",
            "TCS": "TCS.NS",
            "INFY": "INFY.NS",
            "HDFCBANK": "HDFCBANK.NS",
            "ICICIBANK": "ICICIBANK.NS",
            "HINDUNILVR": "HINDUNILVR.NS",
            "ITC": "ITC.NS",
            "SBIN": "SBIN.NS",
            "BHARTIARTL": "BHARTIARTL.NS",
            "KOTAKBANK": "KOTAKBANK.NS",
            "LT": "LT.NS",
            "ASIANPAINT": "ASIANPAINT.NS",
            "MARUTI": "MARUTI.NS",
            "SUNPHARMA": "SUNPHARMA.NS",
            "TITAN": "TITAN.NS",
            "WIPRO": "WIPRO.NS",
            "ULTRACEMCO": "ULTRACEMCO.NS",
            "NESTLEIND": "NESTLEIND.NS",
            "POWERGRID": "POWERGRID.NS",
            "BAJFINANCE": "BAJFINANCE.NS",
        }

        # Common US stocks
        us_stocks = {
            "AAPL": "AAPL",
            "MSFT": "MSFT",
            "GOOGL": "GOOGL",
            "GOOG": "GOOG",
            "AMZN": "AMZN",
            "TSLA": "TSLA",
            "NVDA": "NVDA",
            "META": "META",
            "NFLX": "NFLX",
            "JPM": "JPM",
            "V": "V",
            "JNJ": "JNJ",
            "WMT": "WMT",
            "PG": "PG",
            "MA": "MA",
            "UNH": "UNH",
            "HD": "HD",
            "BAC": "BAC",
            "DIS": "DIS",
            "ADBE": "ADBE",
        }

        all_stocks = {**indian_stocks, **us_stocks}
        query_upper = query.upper()

        results = []
        for name, symbol in all_stocks.items():
            if query_upper in name or query_upper in symbol:
                results.append({
                    "symbol": symbol,
                    "name": name,
                    "market": "INDIA" if symbol.endswith(".NS") else "US",
                })

        # If exact match found, prioritize it
        if query_upper in all_stocks:
            exact = [r for r in results if r["symbol"] == all_stocks[query_upper]]
            others = [r for r in results if r["symbol"] != all_stocks[query_upper]]
            results = exact + others

        return results[:20]  # Limit results

    def get_history(
        self,
        symbol: str,
        period: str = "1y",
        interval: str = "1d",
        use_cache: bool = True,
    ) -> pd.DataFrame:
        """
        Get historical stock data.

        Args:
            symbol: Stock symbol (e.g., "AAPL", "RELIANCE.NS")
            period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
            use_cache: Whether to use cached data

        Returns:
            DataFrame with OHLCV data
        """
        symbol = self.normalize_symbol(symbol)
        cache_key = self._get_cache_key(symbol, period, interval)

        # Try cache first
        if use_cache:
            cached_data = self._load_from_cache(cache_key)
            if cached_data is not None:
                return cached_data

        try:
            logger.info(f"Fetching data for {symbol} (period={period}, interval={interval})")
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval, auto_adjust=False)

            if df.empty:
                raise ValueError(f"No data found for symbol {symbol}")

            # Standardize column names
            df = df.rename(columns={
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Adj Close": "adj_close",
                "Volume": "volume",
            })

            # Ensure we have all required columns
            required_cols = ["open", "high", "low", "close", "volume"]
            for col in required_cols:
                if col not in df.columns:
                    if col == "volume" and "Volume" in df.columns:
                        df["volume"] = df["Volume"]
                    else:
                        raise ValueError(f"Missing required column: {col}")

            # Add adj_close if not present
            if "adj_close" not in df.columns:
                df["adj_close"] = df["close"]

            # Reset index to have date as column
            df = df.reset_index()
            df = df.rename(columns={"Date": "date", "Datetime": "date"})

            # Ensure date is datetime
            df["date"] = pd.to_datetime(df["date"])

            # Sort by date
            df = df.sort_values("date").reset_index(drop=True)

            # Remove duplicates
            df = df.drop_duplicates(subset=["date"]).reset_index(drop=True)

            # Forward fill missing values (for market holidays)
            df = df.ffill()

            # Validate data
            self._validate_data(df, symbol)

            # Cache the result
            if use_cache:
                self._save_to_cache(cache_key, df)

            logger.info(f"Successfully fetched {len(df)} rows for {symbol}")
            return df

        except Exception as e:
            logger.error(f"Error fetching data for {symbol}: {e}")
            raise

    def _validate_data(self, df: pd.DataFrame, symbol: str) -> None:
        """Validate the fetched data."""
        if df.empty:
            raise ValueError(f"Empty dataframe for {symbol}")

        # Check for required columns
        required = ["date", "open", "high", "low", "close", "volume"]
        missing = [col for col in required if col not in df.columns]
        if missing:
            raise ValueError(f"Missing columns for {symbol}: {missing}")

        # Check for NaN values in critical columns
        critical_cols = ["open", "high", "low", "close"]
        for col in critical_cols:
            if df[col].isna().any():
                logger.warning(f"Found NaN values in {col} for {symbol}")

        # Basic sanity checks
        if (df["high"] < df["low"]).any():
            logger.warning(f"High < Low detected for {symbol}")

        if (df["close"] <= 0).any() or (df["volume"] < 0).any():
            logger.warning(f"Invalid price/volume values for {symbol}")

    def get_current_price(self, symbol: str) -> Dict[str, Any]:
        """Get current/latest price information."""
        symbol = self.normalize_symbol(symbol)
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            hist = ticker.history(period="1d", interval="1m")

            current_price = info.get("currentPrice") or info.get("regularMarketPrice")
            if current_price is None and not hist.empty:
                current_price = hist["Close"].iloc[-1]

            return {
                "symbol": symbol,
                "current_price": current_price,
                "currency": info.get("currency", "USD"),
                "market_state": info.get("marketState", "UNKNOWN"),
                "timestamp": datetime.now().isoformat(),
                "day_high": info.get("dayHigh"),
                "day_low": info.get("dayLow"),
                "volume": info.get("volume"),
                "market_cap": info.get("marketCap"),
            }
        except Exception as e:
            logger.error(f"Error getting current price for {symbol}: {e}")
            raise

    def get_company_info(self, symbol: str) -> Dict[str, Any]:
        """Get company information."""
        symbol = self.normalize_symbol(symbol)
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            return {
                "symbol": symbol,
                "name": info.get("longName", info.get("shortName", symbol)),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "country": info.get("country"),
                "currency": info.get("currency"),
                "market_cap": info.get("marketCap"),
                "enterprise_value": info.get("enterpriseValue"),
                "pe_ratio": info.get("trailingPE"),
                "forward_pe": info.get("forwardPE"),
                "dividend_yield": info.get("dividendYield"),
                "beta": info.get("beta"),
                "description": info.get("longBusinessSummary"),
                "website": info.get("website"),
                "employees": info.get("fullTimeEmployees"),
            }
        except Exception as e:
            logger.error(f"Error getting company info for {symbol}: {e}")
            raise