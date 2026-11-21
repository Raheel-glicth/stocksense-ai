"use client";

import { useState } from "react";
import StockSearch from "@/components/StockSearch";
import MetricCard from "@/components/MetricCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import ChartTooltip from "@/components/Tooltip";
import { compareModels } from "@/lib/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

const PERIODS = [
  { label: "6 Months", value: "6mo" },
  { label: "1 Year", value: "1y" },
  { label: "2 Years", value: "2y" },
];

export default function ModelComparisonPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [period, setPeriod] = useState("1y");
  const [useWalkForward, setUseWalkForward] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleCompare = async () => {
    setLoading(true);
    setError(null);

    const { data: resData, error: apiError } = await compareModels(
      symbol,
      period,
      useWalkForward
    );

    if (apiError) {
      setError(apiError);
    } else {
      setData(resData);
    }
    setLoading(false);
  };

  // Convert results dictionary to an array for tables and charts
  const modelsList = (() => {
    if (!data?.results) return [];
    return Object.values(data.results);
  })();

  const chartData = modelsList.map((m) => ({
    name: m.model,
    rmse: Number(m.rmse.toFixed(4)),
    mae: Number(m.mae.toFixed(4)),
    directional_accuracy: Number((m.directional_accuracy * 100).toFixed(1)),
    isBest: m.model === data?.best_model,
    isBaseline: m.model === "NaiveBaseline",
  }));

  const bestModelObj = modelsList.find((m) => m.model === data?.best_model);
  const baselineObj = data?.baseline;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1e293b]">
        <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#f1f5f9] flex items-center gap-2">
          <span>Model Comparison</span>
          <span className="text-sm px-2.5 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-mono">
            Benchmark Matrix
          </span>
        </h1>
        <p className="text-xs text-[#94a3b8] font-mono mt-1">
          Comparative empirical evaluation of ML architectures (XGBoost, Random Forest, Ridge, Naive Baseline)
        </p>
      </div>

      {/* Control Panel */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
          Evaluation Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">Target Asset</label>
            <StockSearch
              currentSymbol={symbol}
              onSelectStock={(s) => setSymbol(s)}
              showQuickPicks={false}
              placeholder="Select asset..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">Lookback Period</label>
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

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">Validation Methodology</label>
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#0a0f1a] border border-[#1e293b]">
              <span className="text-xs font-mono text-[#f1f5f9]">Walk-Forward Validation</span>
              <button
                type="button"
                onClick={() => setUseWalkForward(!useWalkForward)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  useWalkForward ? "bg-[#10b981]" : "bg-[#1e293b]"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    useWalkForward ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <div className="text-[10px] font-mono text-[#64748b]">
              {useWalkForward ? "Rolling out-of-sample time folds" : "Standard 80/20 train/test split"}
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#1e293b]">
          <span className="text-[11px] font-mono text-[#64748b]">
            Compares MAE, RMSE, R², MAPE, and Directional Hit-Rate against NaiveBaseline
          </span>
          <button
            onClick={handleCompare}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#0da674] text-black font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Training & Evaluating...</span>
              </>
            ) : (
              <span>🤖 Compare Models</span>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-16">
          <LoadingSpinner
            size="lg"
            label={`Training and evaluating models on ${symbol} (${useWalkForward ? "Walk-forward validation" : "Train/Test"})... This may take a few moments.`}
          />
        </div>
      )}

      {error && !loading && (
        <ErrorMessage
          title="Model Comparison Failure"
          message={error}
          onRetry={handleCompare}
        />
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Best Model Banner */}
          <div className="bg-[#10b981]/10 border border-[#10b981]/40 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center text-xl shrink-0">
                🏆
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#10b981] uppercase tracking-wider font-bold">
                  Optimal Model Architecture
                </span>
                <h3 className="text-xl font-bold font-mono text-[#f1f5f9]">
                  {data.best_model}
                </h3>
              </div>
            </div>

            {bestModelObj && (
              <div className="flex items-center gap-6 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-[#94a3b8] uppercase">RMSE Error</div>
                  <div className="text-[#10b981] font-bold text-sm">
                    {bestModelObj.rmse.toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#94a3b8] uppercase">Directional Accuracy</div>
                  <div className="text-[#10b981] font-bold text-sm">
                    {(bestModelObj.directional_accuracy * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#94a3b8] uppercase">R² Score</div>
                  <div className="text-[#f1f5f9] font-bold text-sm">
                    {bestModelObj.r2.toFixed(4)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Comparison Table */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#1e293b] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                Model Evaluation Scorecard
              </h3>
              <span className="text-xs font-mono text-[#94a3b8]">
                Validation: {useWalkForward ? "Walk-Forward" : "80/20 Split"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0a0f1a] text-[#94a3b8] uppercase tracking-wider border-b border-[#1e293b]">
                  <tr>
                    <th className="p-3.5 font-semibold">Model</th>
                    <th className="p-3.5 font-semibold text-right">MAE</th>
                    <th className="p-3.5 font-semibold text-right">RMSE</th>
                    <th className="p-3.5 font-semibold text-right">R²</th>
                    <th className="p-3.5 font-semibold text-right">MAPE</th>
                    <th className="p-3.5 font-semibold text-right">Directional Acc.</th>
                    <th className="p-3.5 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]/60">
                  {modelsList.map((m) => {
                    const isBest = m.model === data.best_model;
                    const isBaseline = m.model === "NaiveBaseline";

                    return (
                      <tr
                        key={m.model}
                        className={`transition-colors ${
                          isBest
                            ? "bg-[#10b981]/10 hover:bg-[#10b981]/15 font-semibold"
                            : isBaseline
                            ? "bg-[#0a0f1a]/40 text-[#94a3b8] hover:bg-[#1e293b]/20"
                            : "hover:bg-[#1e293b]/30 text-[#f1f5f9]"
                        }`}
                      >
                        <td className="p-3.5 flex items-center gap-2">
                          {isBest && <span className="text-xs">⭐</span>}
                          {isBaseline && <span className="text-xs text-[#64748b]">📊</span>}
                          <span className={isBest ? "text-[#10b981]" : ""}>{m.model}</span>
                        </td>
                        <td className="p-3.5 text-right">{m.mae.toFixed(4)}</td>
                        <td className={`p-3.5 text-right ${isBest ? "text-[#10b981]" : ""}`}>
                          {m.rmse.toFixed(4)}
                        </td>
                        <td className="p-3.5 text-right">{m.r2.toFixed(4)}</td>
                        <td className="p-3.5 text-right">{(m.mape * 100).toFixed(2)}%</td>
                        <td className={`p-3.5 text-right font-semibold ${
                          m.directional_accuracy >= 0.5 ? "text-[#10b981]" : "text-[#ef4444]"
                        }`}>
                          {(m.directional_accuracy * 100).toFixed(1)}%
                        </td>
                        <td className="p-3.5 text-center">
                          {isBest ? (
                            <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 text-[10px] font-bold">
                              BEST MODEL
                            </span>
                          ) : isBaseline ? (
                            <span className="px-2 py-0.5 rounded bg-[#1e293b] text-[#94a3b8] text-[10px]">
                              BASELINE
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#64748b]">COMPETITOR</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar Charts: RMSE Comparison & Directional Accuracy */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: RMSE Comparison (Lower is better) */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-2">
              <div className="border-b border-[#1e293b] pb-2 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                    Root Mean Squared Error (RMSE)
                  </h3>
                  <p className="text-[11px] font-mono text-[#94a3b8]">Lower value indicates higher precision</p>
                </div>
                <span className="text-[10px] font-mono text-[#10b981]">Green = Best</span>
              </div>
              <div className="h-64 w-full pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={10}
                      fontFamily="monospace"
                      tickLine={false}
                      axisLine={{ stroke: "#1e293b" }}
                      interval={0}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      fontFamily="monospace"
                      tickLine={false}
                      axisLine={false}
                      orientation="right"
                      width={45}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v) => Number(v).toFixed(4)} />} />
                    <Bar dataKey="rmse" name="RMSE" isAnimationActive={false}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isBest ? "#10b981" : entry.isBaseline ? "#64748b" : "#3b82f6"}
                          opacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Directional Accuracy (%) */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-2">
              <div className="border-b border-[#1e293b] pb-2 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                    Directional Accuracy (%)
                  </h3>
                  <p className="text-[11px] font-mono text-[#94a3b8]">Percentage of correct sign (+/-) predictions</p>
                </div>
                <span className="text-[10px] font-mono text-[#94a3b8]">&gt; 50% = Outperforming Coin Flip</span>
              </div>
              <div className="h-64 w-full pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={10}
                      fontFamily="monospace"
                      tickLine={false}
                      axisLine={{ stroke: "#1e293b" }}
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#64748b"
                      fontSize={10}
                      fontFamily="monospace"
                      tickLine={false}
                      axisLine={false}
                      orientation="right"
                      tickFormatter={(v) => `${v}%`}
                      width={45}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />} />
                    <Bar dataKey="directional_accuracy" name="Accuracy (%)" isAnimationActive={false}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.directional_accuracy >= 50 ? "#10b981" : "#ef4444"}
                          opacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && !error && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-12 text-center space-y-3">
          <div className="text-4xl">🤖</div>
          <h3 className="text-base font-semibold font-mono text-[#f1f5f9]">
            Ready to Compare Model Architectures
          </h3>
          <p className="text-xs text-[#94a3b8] max-w-md mx-auto font-mono">
            Click &quot;Compare Models&quot; to train and evaluate all models on {symbol} across standard regression and classification metrics.
          </p>
        </div>
      )}
    </div>
  );
}
