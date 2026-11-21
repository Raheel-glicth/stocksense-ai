"use client";

import { useState } from "react";
import StockSearch from "@/components/StockSearch";
import MetricCard from "@/components/MetricCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import ChartTooltip from "@/components/Tooltip";
import { backtestSymbol } from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart,
  ScatterChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

const MODELS = ["XGBoost", "RandomForest", "LinearRegression", "LSTM"];

const PERIODS = [
  { label: "1 Year", value: "1y" },
  { label: "2 Years", value: "2y" },
  { label: "5 Years", value: "5y" },
];

export default function BacktestingStudioPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [model, setModel] = useState("XGBoost");
  const [period, setPeriod] = useState("2y");
  const [horizon, setHorizon] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleRunBacktest = async () => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await backtestSymbol(
      symbol,
      model,
      period,
      horizon
    );

    if (apiError) {
      setError(apiError);
    } else {
      setResult(data);
    }
    setLoading(false);
  };

  // Prepare cumulative returns time series
  const returnsData = (() => {
    if (!result?.dates) return [];
    return result.dates.map((dStr, idx) => {
      let formatted = dStr;
      try {
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
        }
      } catch (_) {}

      const stratRet = result.cumulative_returns[idx] !== undefined
        ? Number((result.cumulative_returns[idx] * 100).toFixed(2))
        : 0;
      const benchRet = result.benchmark_returns[idx] !== undefined
        ? Number((result.benchmark_returns[idx] * 100).toFixed(2))
        : 0;

      return {
        date: dStr,
        dateFormatted: formatted,
        strategy: stratRet,
        benchmark: benchRet,
      };
    });
  })();

  // Prepare predictions vs actuals scatter data
  const scatterData = (() => {
    if (!result?.predictions || !result?.actuals) return [];
    // Downsample if more than 300 points for clean rendering
    const step = Math.max(1, Math.floor(result.predictions.length / 250));
    const pts = [];
    for (let i = 0; i < result.predictions.length; i += step) {
      pts.push({
        predicted: Number((result.predictions[i] * 100).toFixed(2)),
        actual: Number((result.actuals[i] * 100).toFixed(2)),
      });
    }
    return pts;
  })();

  const metrics = result?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1e293b]">
        <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#f1f5f9] flex items-center gap-2">
          <span>Backtesting Studio</span>
          <span className="text-sm px-2.5 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-mono">
            Walk-Forward Engine
          </span>
        </h1>
        <p className="text-xs text-[#94a3b8] font-mono mt-1">
          Historical simulation of machine learning trading signals without look-ahead bias
        </p>
      </div>

      {/* Warning Banner */}
      <div className="bg-[#111827] border-l-4 border-amber-500 border-r border-t border-b border-[#1e293b] p-4 rounded-r-lg flex items-start gap-3">
        <span className="text-amber-500 text-lg">⚠</span>
        <div className="text-xs font-mono">
          <div className="text-[#f1f5f9] font-bold uppercase tracking-wider">
            Critical Notice: Past performance ≠ future results
          </div>
          <div className="text-[#94a3b8] mt-0.5">
            Backtest calculations simulate threshold-based execution on historical out-of-sample periods. Real-world trading involves execution slippage, commissions, bid-ask spread friction, liquidity constraints, and shifting market regimes.
          </div>
        </div>
      </div>

      {/* Configuration Controls */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
          Simulation Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">1. Asset</label>
            <StockSearch
              currentSymbol={symbol}
              onSelectStock={(s) => setSymbol(s)}
              showQuickPicks={false}
              placeholder="Search ticker..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">2. Algorithm</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#0a0f1a] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-[#f1f5f9] focus:border-[#10b981] outline-none cursor-pointer"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">3. History Window</label>
            <div className="grid grid-cols-3 gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  className={`py-2 text-center rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                    period === p.value
                      ? "bg-[#10b981] text-black font-bold border-[#10b981]"
                      : "bg-[#0a0f1a] border-[#1e293b] text-[#94a3b8] hover:text-[#f1f5f9]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#1e293b]">
          <span className="text-[11px] font-mono text-[#64748b]">
            Target Horizon: {horizon} Day • Rolling Walk-Forward Backtesting
          </span>
          <button
            onClick={handleRunBacktest}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#0da674] text-black font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Simulating Walk-Forward Folds...</span>
              </>
            ) : (
              <span>⏪ Run Backtest</span>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-16">
          <LoadingSpinner
            size="lg"
            label={`Running walk-forward cross validation & trade simulation on ${symbol} with ${model}...`}
          />
        </div>
      )}

      {error && !loading && (
        <ErrorMessage
          title="Backtesting Execution Error"
          message={error}
          onRetry={handleRunBacktest}
        />
      )}

      {result && !loading && (
        <div className="space-y-6">
          {/* Key Performance Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard
              label="Sharpe Ratio"
              value={metrics.sharpe_ratio !== undefined ? metrics.sharpe_ratio.toFixed(2) : "—"}
              subtitle={metrics.sharpe_ratio >= 1.0 ? "Attractive (>1.0)" : "Risk Adjusted"}
              trend={metrics.sharpe_ratio > 0 ? "up" : "down"}
            />
            <MetricCard
              label="Max Drawdown"
              value={metrics.max_drawdown !== undefined ? `${(metrics.max_drawdown * 100).toFixed(2)}%` : "—"}
              subtitle="Peak to Trough"
              trend="down"
            />
            <MetricCard
              label="Win Rate"
              value={metrics.win_rate !== undefined ? `${(metrics.win_rate * 100).toFixed(1)}%` : "—"}
              subtitle={`${metrics.n_predictions || 0} Sessions`}
              trend={metrics.win_rate >= 0.5 ? "up" : "down"}
            />
            <MetricCard
              label="Total Return"
              value={metrics.total_return !== undefined ? `${(metrics.total_return * 100).toFixed(2)}%` : "—"}
              subtitle="Cumulative Strategy"
              trend={metrics.total_return >= 0 ? "up" : "down"}
            />
            <MetricCard
              label="Directional Acc."
              value={
                metrics.directional_accuracy !== undefined
                  ? `${(metrics.directional_accuracy * 100).toFixed(1)}%`
                  : "—"
              }
              subtitle="Trend Sign Match"
              trend={metrics.directional_accuracy >= 0.5 ? "up" : "down"}
            />
          </div>

          {/* Cumulative Returns Chart: Strategy vs Benchmark */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e293b] pb-2">
              <div>
                <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                  Cumulative Return Profile (%)
                </h3>
                <p className="text-[11px] font-mono text-[#94a3b8]">
                  {result.model} Strategy (Green) vs Buy & Hold Benchmark (Blue)
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-[#10b981]">
                  <span className="w-3 h-0.5 bg-[#10b981]" /> Strategy Return
                </span>
                <span className="flex items-center gap-1.5 text-[#3b82f6]">
                  <span className="w-3 h-0.5 bg-[#3b82f6]" /> Buy & Hold
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={returnsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                  <XAxis
                    dataKey="dateFormatted"
                    stroke="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                    tickLine={false}
                    axisLine={{ stroke: "#1e293b" }}
                    minTickGap={30}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                    tickFormatter={(v) => `${v}%`}
                    width={50}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(v) => `${Number(v).toFixed(2)}%`}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="strategy"
                    name="Strategy Return"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    name="Benchmark"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Predictions vs Actuals Scatter Plot */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-3">
            <div className="border-b border-[#1e293b] pb-2 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                  Predictions vs Actuals Scatter
                </h3>
                <p className="text-[11px] font-mono text-[#94a3b8]">
                  Horizontal: Model Predicted Return (%) • Vertical: Actual Realized Return (%)
                </p>
              </div>
              <div className="text-xs font-mono text-[#94a3b8]">
                Correlation:{" "}
                <span className="text-[#10b981] font-bold">
                  {metrics.correlation !== undefined ? metrics.correlation.toFixed(3) : "—"}
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                  <XAxis
                    type="number"
                    dataKey="predicted"
                    name="Predicted Return"
                    unit="%"
                    stroke="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                  />
                  <YAxis
                    type="number"
                    dataKey="actual"
                    name="Actual Return"
                    unit="%"
                    stroke="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                    orientation="right"
                    width={45}
                  />
                  <ReferenceLine x={0} stroke="#334155" />
                  <ReferenceLine y={0} stroke="#334155" />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(v) => `${Number(v).toFixed(2)}%`}
                      />
                    }
                  />
                  <Scatter
                    name="Trading Sessions"
                    data={scatterData}
                    fill="#10b981"
                    opacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between text-xs font-mono text-[#64748b]">
              <span>Ideal fit lies along 45° line from bottom-left to top-right</span>
              <span>Profit Factor: {metrics.profit_factor !== undefined ? metrics.profit_factor.toFixed(2) : "—"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && !error && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-12 text-center space-y-3">
          <div className="text-4xl">⏪</div>
          <h3 className="text-base font-semibold font-mono text-[#f1f5f9]">
            Configure and Run Backtest
          </h3>
          <p className="text-xs text-[#94a3b8] max-w-md mx-auto font-mono">
            Simulate how {model} would have performed on {symbol} over the chosen time period.
          </p>
        </div>
      )}
    </div>
  );
}
