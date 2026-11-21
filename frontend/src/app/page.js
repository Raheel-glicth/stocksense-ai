"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import StockSearch from "@/components/StockSearch";
import PriceChart from "@/components/PriceChart";
import MetricCard from "@/components/MetricCard";
import Badge from "@/components/Badge";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import {
  getCurrentPrice,
  getCompanyInfo,
  getStockHistory,
  getRegime,
  getIndicators,
  predict,
} from "@/lib/api";

export default function OverviewPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [priceData, setPriceData] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [regimeData, setRegimeData] = useState(null);
  const [indicatorsData, setIndicatorsData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);

  const fetchStockOverview = useCallback(async (sym) => {
    setLoading(true);
    setError(null);

    try {
      // Parallel fetch of foundational data
      const [priceRes, compRes, histRes, regimeRes, indRes] = await Promise.all([
        getCurrentPrice(sym),
        getCompanyInfo(sym),
        getStockHistory(sym, "6mo", "1d"),
        getRegime(sym, "6mo"),
        getIndicators(sym, "6mo"),
      ]);

      if (priceRes.error && histRes.error) {
        setError(priceRes.error || histRes.error || "Failed to fetch stock data");
        setLoading(false);
        return;
      }

      setPriceData(priceRes.data);
      setCompanyData(compRes.data);
      setHistoryData(histRes.data?.data || []);
      setRegimeData(regimeRes.data);
      setIndicatorsData(indRes.data);
      setLoading(false);

      // Fetch prediction asynchronously so base page renders fast
      setPredictionLoading(true);
      predict(sym, "XGBoost", 1, "1y")
        .then((predRes) => {
          if (predRes.data) {
            setPredictionData(predRes.data);
          }
        })
        .finally(() => {
          setPredictionLoading(false);
        });
    } catch (err) {
      setError(err.message || "An unexpected error occurred while loading overview");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockOverview(symbol);
  }, [symbol, fetchStockOverview]);

  // Derived metrics from history
  const { dailyChange, dailyChangePct, currentPriceVal } = (() => {
    let cur = priceData?.current_price;
    if (cur === undefined && historyData.length > 0) {
      cur = historyData[historyData.length - 1].close;
    }
    let change = 0;
    let pct = 0;
    if (historyData.length >= 2) {
      const prev = historyData[historyData.length - 2].close;
      const latest = historyData[historyData.length - 1].close;
      change = latest - prev;
      pct = prev > 0 ? (change / prev) * 100 : 0;
    }
    return {
      dailyChange: Number(change.toFixed(2)),
      dailyChangePct: Number(pct.toFixed(2)),
      currentPriceVal: cur !== undefined ? Number(cur).toFixed(2) : "—",
    };
  })();

  // Latest indicators values
  const latestRsi = indicatorsData?.rsi?.length
    ? Number(indicatorsData.rsi[indicatorsData.rsi.length - 1]).toFixed(1)
    : "—";
  const latestMacdSignal = indicatorsData?.macd_signal?.length
    ? Number(indicatorsData.macd_signal[indicatorsData.macd_signal.length - 1]).toFixed(3)
    : "—";
  const latestVol = indicatorsData?.volatility?.length
    ? `${(Number(indicatorsData.volatility[indicatorsData.volatility.length - 1]) * 100).toFixed(1)}%`
    : "—";

  return (
    <div className="space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#f1f5f9]">
              {companyData?.name || symbol}
            </h1>
            <span className="text-base font-mono px-2 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-semibold border border-[#1e293b]">
              {symbol}
            </span>
            {regimeData?.regime && (
              <Badge variant={regimeData.regime} size="md">
                {regimeData.regime}
              </Badge>
            )}
          </div>
          <p className="text-xs text-[#94a3b8] mt-1 font-mono">
            {companyData?.sector ? `${companyData.sector} • ${companyData.industry || ""}` : "Stock Overview & Intelligence"}
          </p>
        </div>

        <div className="w-full md:w-96">
          <StockSearch
            currentSymbol={symbol}
            onSelectStock={(s) => setSymbol(s)}
            showQuickPicks={false}
          />
        </div>
      </div>

      {/* Quick Stock Selector Pills */}
      <StockSearch
        currentSymbol={symbol}
        onSelectStock={(s) => setSymbol(s)}
        className="!space-y-0"
      />

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-16">
          <LoadingSpinner size="lg" label={`Loading quantitative telemetry for ${symbol}...`} />
        </div>
      ) : error ? (
        <ErrorMessage
          title={`Unable to load ${symbol}`}
          message={error}
          onRetry={() => fetchStockOverview(symbol)}
        />
      ) : (
        <>
          {/* Key Metric Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Current Price"
              value={`$${currentPriceVal}`}
              change={dailyChange}
              changePct={dailyChangePct}
              icon="💵"
              subtitle={priceData?.currency || "USD"}
            />

            <MetricCard
              label="Daily Volume"
              value={
                priceData?.volume
                  ? Number(priceData.volume).toLocaleString()
                  : historyData.length
                  ? Number(historyData[historyData.length - 1].volume).toLocaleString()
                  : "—"
              }
              subtitle="Shares Traded"
              icon="📊"
            />

            <MetricCard
              label="Day Range"
              value={
                priceData?.day_low && priceData?.day_high
                  ? `$${Number(priceData.day_low).toFixed(2)} - $${Number(priceData.day_high).toFixed(2)}`
                  : "—"
              }
              subtitle="24h Spread"
              icon="↕"
            />

            <MetricCard
              label="Market Cap"
              value={
                companyData?.market_cap
                  ? `$${(Number(companyData.market_cap) / 1e9).toFixed(2)}B`
                  : "—"
              }
              subtitle={companyData?.country || "Equity"}
              icon="🏢"
            />
          </div>

          {/* Chart & AI Prediction Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Price Chart (2 cols) */}
            <div className="lg:col-span-2 bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider flex items-center gap-2">
                    <span>Price Trend</span>
                    <span className="text-[11px] text-[#94a3b8] font-normal">(Last 6 Months)</span>
                  </h3>
                </div>
                <Link
                  href="/explorer"
                  className="text-xs font-mono text-[#10b981] hover:underline flex items-center gap-1"
                >
                  Interactive Explorer →
                </Link>
              </div>

              <div className="w-full">
                <PriceChart data={historyData} height={300} />
              </div>

              <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between text-xs font-mono text-[#94a3b8]">
                <span>Period: 6 Months • Daily Candles</span>
                <span className="text-[#10b981]">{historyData.length} Data Points Analyzed</span>
              </div>
            </div>

            {/* AI Prediction Summary (1 col) */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-[#1e293b] pb-2">
                  <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider flex items-center gap-2">
                    <span>🔮 AI Prediction</span>
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                    XGBoost
                  </span>
                </div>

                {predictionLoading ? (
                  <div className="py-12">
                    <LoadingSpinner size="md" label="Computing ML inference..." />
                  </div>
                ) : predictionData ? (
                  <div className="space-y-4">
                    <div className="bg-[#0a0f1a] border border-[#1e293b] p-3.5 rounded-lg">
                      <div className="text-[11px] font-mono text-[#94a3b8] uppercase">
                        1-Day Target Forecast
                      </div>
                      <div className="text-2xl font-bold font-mono text-[#f1f5f9] mt-1">
                        ${Number(predictionData.predicted_price).toFixed(2)}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            predictionData.predicted_return >= 0
                              ? "text-[#10b981]"
                              : "text-[#ef4444]"
                          }`}
                        >
                          {predictionData.predicted_return >= 0 ? "▲ +" : "▼ "}
                          {(predictionData.predicted_return * 100).toFixed(2)}% Return
                        </span>
                        <Badge variant={predictionData.directional_bias} size="sm">
                          {predictionData.directional_bias}
                        </Badge>
                      </div>
                    </div>

                    {predictionData.confidence_interval?.length === 2 && (
                      <div className="bg-[#0a0f1a]/60 border border-[#1e293b] p-3 rounded-lg text-xs font-mono">
                        <div className="text-[#94a3b8] text-[10px] uppercase mb-1">
                          95% Confidence Interval
                        </div>
                        <div className="text-[#f1f5f9]">
                          ${Number(predictionData.confidence_interval[0]).toFixed(2)} - $
                          {Number(predictionData.confidence_interval[1]).toFixed(2)}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 text-xs font-mono text-[#94a3b8]">
                      <div className="flex justify-between">
                        <span>Horizon:</span>
                        <span className="text-[#f1f5f9]">{predictionData.horizon} Trading Day</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Algorithm:</span>
                        <span className="text-[#f1f5f9]">{predictionData.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className="text-[#10b981]">Model Trained & Active</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs font-mono text-[#94a3b8]">
                    No prediction generated yet.
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[#1e293b]">
                <Link
                  href="/predictions"
                  className="w-full block text-center py-2 rounded bg-[#1e293b] hover:bg-[#10b981] hover:text-black text-xs font-mono font-medium text-[#f1f5f9] transition-colors"
                >
                  Open Prediction Lab →
                </Link>
              </div>
            </div>
          </div>

          {/* Quantitative Indicators Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label="RSI (14-Day)"
              value={latestRsi}
              subtitle={
                Number(latestRsi) > 70
                  ? "Overbought Zone (>70)"
                  : Number(latestRsi) < 30
                  ? "Oversold Zone (<30)"
                  : "Neutral Zone (30-70)"
              }
              trend={Number(latestRsi) > 50 ? "up" : "down"}
              icon="📈"
              tooltip="Relative Strength Index measures momentum. Values > 70 indicate overbought; < 30 oversold."
            />

            <MetricCard
              label="MACD Signal"
              value={latestMacdSignal}
              subtitle="Exponential Moving Average Trend"
              icon="⚡"
              tooltip="Moving Average Convergence Divergence signals momentum and trend direction."
            />

            <MetricCard
              label="Historical Volatility"
              value={latestVol}
              subtitle="20-Day Rolling Annualized"
              icon="🌊"
              tooltip="Standard deviation of price returns over 20 sessions."
            />
          </div>

          {/* Company Summary & Fast Navigation Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#111827] border border-[#1e293b] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider mb-3">
                About {companyData?.name || symbol}
              </h3>
              <p className="text-xs text-[#94a3b8] leading-relaxed line-clamp-4 font-sans">
                {companyData?.description ||
                  `${symbol} is a publicly traded entity on global financial exchanges. View explorer or run backtests to analyze historical price action.`}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#1e293b] text-xs font-mono">
                <div>
                  <div className="text-[10px] text-[#94a3b8] uppercase">P/E Ratio</div>
                  <div className="text-[#f1f5f9] font-semibold mt-0.5">
                    {companyData?.pe_ratio ? Number(companyData.pe_ratio).toFixed(2) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#94a3b8] uppercase">Beta</div>
                  <div className="text-[#f1f5f9] font-semibold mt-0.5">
                    {companyData?.beta ? Number(companyData.beta).toFixed(2) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#94a3b8] uppercase">Forward P/E</div>
                  <div className="text-[#f1f5f9] font-semibold mt-0.5">
                    {companyData?.forward_pe ? Number(companyData.forward_pe).toFixed(2) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#94a3b8] uppercase">Dividend Yield</div>
                  <div className="text-[#f1f5f9] font-semibold mt-0.5">
                    {companyData?.dividend_yield
                      ? `${(Number(companyData.dividend_yield) * 100).toFixed(2)}%`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider mb-3">
                  Terminal Modules
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  <Link
                    href="/analysis"
                    className="flex items-center justify-between p-2.5 rounded bg-[#0a0f1a] hover:bg-[#1e293b] border border-[#1e293b] text-[#f1f5f9] transition-colors"
                  >
                    <span>📈 Quantitative Analysis</span>
                    <span className="text-[#10b981]">→</span>
                  </Link>
                  <Link
                    href="/models"
                    className="flex items-center justify-between p-2.5 rounded bg-[#0a0f1a] hover:bg-[#1e293b] border border-[#1e293b] text-[#f1f5f9] transition-colors"
                  >
                    <span>🤖 Model Comparison</span>
                    <span className="text-[#10b981]">→</span>
                  </Link>
                  <Link
                    href="/backtest"
                    className="flex items-center justify-between p-2.5 rounded bg-[#0a0f1a] hover:bg-[#1e293b] border border-[#1e293b] text-[#f1f5f9] transition-colors"
                  >
                    <span>⏪ Backtesting Studio</span>
                    <span className="text-[#10b981]">→</span>
                  </Link>
                  <Link
                    href="/research"
                    className="flex items-center justify-between p-2.5 rounded bg-[#0a0f1a] hover:bg-[#1e293b] border border-[#1e293b] text-[#f1f5f9] transition-colors"
                  >
                    <span>📑 AI Research Report</span>
                    <span className="text-[#10b981]">→</span>
                  </Link>
                </div>
              </div>

              <div className="text-[10px] font-mono text-[#64748b] mt-4 pt-3 border-t border-[#1e293b] text-center">
                Select another symbol above to inspect other assets.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
