"use client";

import { useState } from "react";
import StockSearch from "@/components/StockSearch";
import MetricCard from "@/components/MetricCard";
import Badge from "@/components/Badge";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { predict, getExportPredictionsUrl } from "@/lib/api";

const MODELS = [
  { id: "XGBoost", name: "XGBoost (Extreme Gradient Boosting)", tag: "Recommended" },
  { id: "RandomForest", name: "Random Forest Regressor", tag: "Ensemble" },
  { id: "LinearRegression", name: "Ridge / Linear Regression", tag: "Fast Baseline" },
  { id: "LSTM", name: "LSTM Neural Network (Deep Learning)", tag: "Sequential" },
];

const HORIZONS = [
  { label: "1 Trading Day", value: 1 },
  { label: "5 Trading Days", value: 5 },
];

const PERIODS = [
  { label: "6 Months", value: "6mo" },
  { label: "1 Year", value: "1y" },
  { label: "2 Years", value: "2y" },
];

export default function PredictionLabPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [model, setModel] = useState("XGBoost");
  const [horizon, setHorizon] = useState(1);
  const [period, setPeriod] = useState("1y");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await predict(symbol, model, horizon, period);
    if (apiError) {
      setError(apiError);
    } else {
      setPrediction(data);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-[#1e293b]">
        <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#f1f5f9] flex items-center gap-2">
          <span>Prediction Lab</span>
          <span className="text-sm px-2.5 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-mono">
            ML Inference
          </span>
        </h1>
        <p className="text-xs text-[#94a3b8] font-mono mt-1">
          Supervised machine learning algorithms trained on technical indicators to forecast future returns
        </p>
      </div>

      {/* Configuration Control Panel */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
          Model Inference Configuration
        </h3>

        {/* Stock Selector */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-[#94a3b8] uppercase">
            1. Target Asset
          </label>
          <StockSearch
            currentSymbol={symbol}
            onSelectStock={(s) => setSymbol(s)}
            placeholder="Search stock ticker to predict..."
          />
        </div>

        {/* Algorithm, Horizon, Period Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">
              2. ML Algorithm
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#0a0f1a] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-[#f1f5f9] focus:border-[#10b981] outline-none cursor-pointer"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.tag})
                </option>
              ))}
            </select>
          </div>

          {/* Horizon Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">
              3. Forecast Horizon
            </label>
            <div className="grid grid-cols-2 gap-2">
              {HORIZONS.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => setHorizon(h.value)}
                  className={`py-2 px-3 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                    horizon === h.value
                      ? "bg-[#10b981] text-black font-bold border-[#10b981]"
                      : "bg-[#0a0f1a] border-[#1e293b] text-[#94a3b8] hover:text-[#f1f5f9]"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#94a3b8] uppercase">
              4. Training Lookback
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  className={`py-2 px-2 text-center rounded-lg text-xs font-mono border transition-all cursor-pointer ${
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

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#1e293b]">
          <span className="text-[11px] font-mono text-[#64748b]">
            Training feature vector: RSI, MACD, Bollinger Bands, ATR, Moving Average Crossovers
          </span>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#0da674] text-black font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Training & Predicting...</span>
              </>
            ) : (
              <span>⚡ Generate Prediction</span>
            )}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-16">
          <LoadingSpinner
            size="lg"
            label={`Fitting ${model} on ${symbol} historical data and calculating inference...`}
          />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <ErrorMessage
          title="Prediction Pipeline Error"
          message={error}
          onRetry={handleGenerate}
        />
      )}

      {/* Results state */}
      {prediction && !loading && (
        <div className="space-y-6">
          {/* Hero Forecast Result Card */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-8xl font-mono">
              🔮
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-4 mb-5">
              <div>
                <span className="text-xs font-mono text-[#94a3b8] uppercase tracking-wider">
                  Inference Forecast Summary
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-2xl font-bold font-mono text-[#f1f5f9]">
                    {prediction.symbol} ({prediction.model})
                  </h2>
                  <Badge variant={prediction.directional_bias} size="lg">
                    {prediction.directional_bias}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={getExportPredictionsUrl(symbol, model, period)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded bg-[#0a0f1a] hover:bg-[#1e293b] border border-[#1e293b] text-xs font-mono text-[#94a3b8] hover:text-[#f1f5f9] transition-colors flex items-center gap-1.5"
                >
                  <span>📥</span> Export CSV
                </a>
              </div>
            </div>

            {/* Metric Displays */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0a0f1a] border border-[#1e293b] p-4 rounded-lg">
                <div className="text-[11px] font-mono text-[#94a3b8] uppercase">
                  Current Reference Price
                </div>
                <div className="text-2xl font-bold font-mono text-[#f1f5f9] mt-1">
                  ${Number(prediction.current_price).toFixed(2)}
                </div>
                <div className="text-[11px] font-mono text-[#64748b] mt-1">Market Benchmark</div>
              </div>

              <div className="bg-[#0a0f1a] border border-[#1e293b] p-4 rounded-lg">
                <div className="text-[11px] font-mono text-[#94a3b8] uppercase">
                  Predicted Price
                </div>
                <div className="text-2xl font-bold font-mono text-[#10b981] mt-1">
                  ${Number(prediction.predicted_price).toFixed(2)}
                </div>
                <div className="text-[11px] font-mono text-[#64748b] mt-1">
                  Target in {prediction.horizon} session{prediction.horizon > 1 ? "s" : ""}
                </div>
              </div>

              <div className="bg-[#0a0f1a] border border-[#1e293b] p-4 rounded-lg">
                <div className="text-[11px] font-mono text-[#94a3b8] uppercase">
                  Expected Return
                </div>
                <div
                  className={`text-2xl font-bold font-mono mt-1 ${
                    prediction.predicted_return >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                  }`}
                >
                  {prediction.predicted_return >= 0 ? "+" : ""}
                  {(prediction.predicted_return * 100).toFixed(2)}%
                </div>
                <div className="text-[11px] font-mono text-[#64748b] mt-1">
                  Absolute Diff: ${(prediction.predicted_price - prediction.current_price).toFixed(2)}
                </div>
              </div>

              <div className="bg-[#0a0f1a] border border-[#1e293b] p-4 rounded-lg">
                <div className="text-[11px] font-mono text-[#94a3b8] uppercase">
                  Confidence Bounds
                </div>
                <div className="text-base font-bold font-mono text-[#f1f5f9] mt-1 truncate">
                  {prediction.confidence_interval?.length === 2
                    ? `$${Number(prediction.confidence_interval[0]).toFixed(1)} - $${Number(prediction.confidence_interval[1]).toFixed(1)}`
                    : "Std Dev N/A"}
                </div>
                <div className="text-[11px] font-mono text-[#64748b] mt-1">95% Predictive Band</div>
              </div>
            </div>

            {/* Inference Metadata */}
            <div className="mt-5 pt-4 border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#94a3b8]">
              <div>
                <span>Generated At: </span>
                <span className="text-[#f1f5f9]">{new Date(prediction.timestamp).toLocaleString()}</span>
              </div>
              <div>
                <span>Features: </span>
                <span className="text-[#f1f5f9]">Technical Oscillators & Volume Moments</span>
              </div>
              <div>
                <span>Model State: </span>
                <span className="text-[#10b981]">Converged & Validated</span>
              </div>
            </div>
          </div>

          {/* Model Explanation Callout */}
          <div className="bg-[#0a0f1a] border border-[#1e293b] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold font-mono text-[#f1f5f9] mb-1">
                Want to see why {prediction.model} made this prediction?
              </h4>
              <p className="text-xs text-[#94a3b8] font-mono">
                Inspect SHAP values and feature contributions in the Explainable AI studio.
              </p>
            </div>
            <a
              href="/explainability"
              className="px-4 py-2 rounded bg-[#1e293b] hover:bg-[#10b981] hover:text-black text-xs font-mono font-bold transition-colors text-center shrink-0"
            >
              Explain Prediction →
            </a>
          </div>
        </div>
      )}

      {/* Empty Initial State */}
      {!prediction && !loading && !error && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-12 text-center space-y-3">
          <div className="text-4xl">🔮</div>
          <h3 className="text-base font-semibold font-mono text-[#f1f5f9]">
            Ready to Generate Predictions
          </h3>
          <p className="text-xs text-[#94a3b8] max-w-md mx-auto font-mono">
            Select a stock ticker, choose an algorithm (XGBoost, Random Forest, Linear Regression, or LSTM), and click &quot;Generate Prediction&quot;.
          </p>
        </div>
      )}

      {/* Educational Disclaimer Banner */}
      <div className="bg-[#0a0f1a] border border-[#1e293b]/70 rounded-lg p-4 text-xs font-mono text-[#64748b] flex items-start gap-3">
        <span className="text-amber-500 text-base shrink-0">⚠</span>
        <div className="leading-relaxed">
          <span className="text-[#94a3b8] font-bold">Model Disclaimer:</span> All predictions
          are generated by statistical machine learning models on historical market data. Financial
          markets are subject to extreme macroeconomic randomness, regime shifts, and black swan events.
          Predictions are strictly for quantitative academic research and educational evaluation. Not financial advice.
        </div>
      </div>
    </div>
  );
}
