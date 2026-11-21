"use client";

import { useState } from "react";
import StockSearch from "@/components/StockSearch";
import MetricCard from "@/components/MetricCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import DataTable from "@/components/DataTable";
import ChartTooltip from "@/components/Tooltip";
import { explainModel } from "@/lib/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";

const TREE_MODELS = [
  { id: "XGBoost", name: "XGBoost (Extreme Gradient Boosting)" },
  { id: "RandomForest", name: "Random Forest Regressor" },
];

export default function ExplainabilityPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [model, setModel] = useState("XGBoost");
  const [period, setPeriod] = useState("1y");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [explanation, setExplanation] = useState(null);

  const handleExplain = async () => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await explainModel(symbol, model, period);

    if (apiError) {
      setError(apiError);
    } else if (data?.error) {
      setError(data.error);
    } else {
      setExplanation(data);
    }
    setLoading(false);
  };

  // Prepare top 10 features sorted by absolute contribution
  const topFeaturesData = (() => {
    if (!explanation?.feature_contributions) return [];
    const entries = Object.entries(explanation.feature_contributions).map(
      ([feature, value]) => ({
        feature,
        value: Number(value),
        absVal: Math.abs(Number(value)),
        isPositive: Number(value) >= 0,
      })
    );

    // Sort descending by magnitude
    entries.sort((a, b) => b.absVal - a.absVal);
    // Take top 10
    const top10 = entries.slice(0, 10);
    // For vertical layout, reverse so highest impact is at top of chart
    return top10.reverse();
  })();

  // Full feature ranking for table
  const rankingTableData = (() => {
    if (!explanation?.feature_contributions) return [];
    const entries = Object.entries(explanation.feature_contributions).map(
      ([feature, value], idx) => ({
        id: idx,
        feature,
        value: Number(value),
        absVal: Math.abs(Number(value)),
        direction: Number(value) >= 0 ? "Bullish (+)" : "Bearish (-)",
      })
    );
    entries.sort((a, b) => b.absVal - a.absVal);
    return entries.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  })();

  const tableColumns = [
    { key: "rank", label: "#", align: "center" },
    { key: "feature", label: "Feature Name" },
    {
      key: "value",
      label: "SHAP Impact",
      align: "right",
      render: (v) => {
        const num = Number(v);
        return (
          <span className={`font-mono font-semibold ${num >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
            {num >= 0 ? "+" : ""}
            {num.toFixed(5)}
          </span>
        );
      },
    },
    {
      key: "direction",
      label: "Signal Bias",
      align: "center",
      render: (v) => {
        const isUp = v.includes("+");
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
              isUp
                ? "bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30"
                : "bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30"
            }`}
          >
            {v}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1e293b]">
        <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#f1f5f9] flex items-center gap-2">
          <span>Explainable AI (XAI)</span>
          <span className="text-sm px-2.5 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-mono">
            SHAP Attribution
          </span>
        </h1>
        <p className="text-xs text-[#94a3b8] font-mono mt-1">
          SHapley Additive exPlanations decomposing black-box predictions into individual feature contributions
        </p>
      </div>

      {/* Control Panel */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
          Attribution Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">Target Asset</label>
            <StockSearch
              currentSymbol={symbol}
              onSelectStock={(s) => setSymbol(s)}
              showQuickPicks={false}
              placeholder="Search ticker..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">Tree-Based Algorithm</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#0a0f1a] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-[#f1f5f9] focus:border-[#10b981] outline-none cursor-pointer"
            >
              {TREE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#1e293b]">
          <span className="text-[11px] font-mono text-[#64748b]">
            Computes TreeExplainer exact Shapley values for the most recent trading session
          </span>
          <button
            onClick={handleExplain}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#0da674] text-black font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Computing SHAP Trees...</span>
              </>
            ) : (
              <span>💡 Explain Prediction</span>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-16">
          <LoadingSpinner
            size="lg"
            label={`Generating SHAP TreeExplainer attribution values for ${symbol} with ${model}...`}
          />
        </div>
      )}

      {error && !loading && (
        <ErrorMessage
          title="Explainability Engine Error"
          message={error}
          onRetry={handleExplain}
        />
      )}

      {explanation && !loading && (
        <div className="space-y-6">
          {/* Base Value & Forecast Breakdown Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Expected Value (Base E[Y])"
              value={
                explanation.expected_value !== undefined
                  ? `${(explanation.expected_value * 100).toFixed(3)}%`
                  : "0.000%"
              }
              subtitle="Average Dataset Return"
              icon="⚖️"
              tooltip="The baseline model prediction if no feature information was provided."
            />
            <MetricCard
              label="Predicted Return f(x)"
              value={
                explanation.prediction !== undefined
                  ? `${(explanation.prediction * 100).toFixed(3)}%`
                  : "—"
              }
              subtitle={`Total Output for ${symbol}`}
              trend={explanation.prediction >= 0 ? "up" : "down"}
              icon="🎯"
              tooltip="Sum of Expected Base Value + All Feature Attributions."
            />
            <MetricCard
              label="Net Feature Impact"
              value={
                explanation.prediction !== undefined && explanation.expected_value !== undefined
                  ? `${((explanation.prediction - explanation.expected_value) * 100).toFixed(3)}%`
                  : "—"
              }
              subtitle="Attributed Delta"
              trend={
                explanation.prediction >= explanation.expected_value ? "up" : "down"
              }
              icon="⚡"
              tooltip="The total push exerted on the prediction by the current feature values."
            />
          </div>

          {/* SHAP Waterfall / Horizontal Bar Chart */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e293b] pb-2">
              <div>
                <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                  Top 10 Feature Contributions (SHAP Waterfall)
                </h3>
                <p className="text-[11px] font-mono text-[#94a3b8]">
                  Positive green bars push prediction higher • Negative red bars push prediction lower
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-[#10b981]">
                  <span className="w-2.5 h-2.5 bg-[#10b981] rounded-xs" /> Bullish Driver (+)
                </span>
                <span className="flex items-center gap-1.5 text-[#ef4444]">
                  <span className="w-2.5 h-2.5 bg-[#ef4444] rounded-xs" /> Bearish Drag (-)
                </span>
              </div>
            </div>

            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topFeaturesData}
                  margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} opacity={0.5} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                    tickFormatter={(v) => v.toFixed(4)}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    stroke="#94a3b8"
                    fontSize={10}
                    fontFamily="monospace"
                    tickLine={false}
                    axisLine={{ stroke: "#1e293b" }}
                    width={95}
                  />
                  <ReferenceLine x={0} stroke="#475569" strokeWidth={1.5} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(val) => {
                          const num = Number(val);
                          return `${num >= 0 ? "+" : ""}${num.toFixed(5)}`;
                        }}
                      />
                    }
                  />
                  <Bar dataKey="value" name="SHAP Contribution" isAnimationActive={false}>
                    {topFeaturesData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isPositive ? "#10b981" : "#ef4444"}
                        opacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feature Importance Ranking Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                Full Feature Importance Ranking
              </h3>
              <span className="text-xs font-mono text-[#94a3b8]">
                {rankingTableData.length} Features Evaluated
              </span>
            </div>
            <DataTable
              columns={tableColumns}
              data={rankingTableData}
              defaultSortKey="absVal"
              defaultSortDir="desc"
              pageSize={12}
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!explanation && !loading && !error && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-12 text-center space-y-3">
          <div className="text-4xl">💡</div>
          <h3 className="text-base font-semibold font-mono text-[#f1f5f9]">
            Deconstruct Black-Box Predictions
          </h3>
          <p className="text-xs text-[#94a3b8] max-w-md mx-auto font-mono">
            Select a tree-based model (XGBoost or Random Forest) and click &quot;Explain Prediction&quot; to uncover the exact mathematical feature drivers.
          </p>
        </div>
      )}
    </div>
  );
}
