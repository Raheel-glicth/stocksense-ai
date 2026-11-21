"use client";

import { useState } from "react";
import StockSearch from "@/components/StockSearch";
import Badge from "@/components/Badge";
import MetricCard from "@/components/MetricCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { getResearch } from "@/lib/api";

export default function ResearchReportsPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await getResearch(symbol);

    if (apiError) {
      setError(apiError);
    } else {
      setReport(data);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1e293b]">
        <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#f1f5f9] flex items-center gap-2">
          <span>AI Research Reports</span>
          <span className="text-sm px-2.5 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-mono">
            Autonomous Equity Dossier
          </span>
        </h1>
        <p className="text-xs text-[#94a3b8] font-mono mt-1">
          Automated multi-factor quantitative synthesis covering price structure, momentum, volatility, and volume
        </p>
      </div>

      {/* Control Panel */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
          Report Generation
        </h3>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <StockSearch
              currentSymbol={symbol}
              onSelectStock={(s) => setSymbol(s)}
              showQuickPicks={false}
              placeholder="Search ticker to generate report..."
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#0da674] text-black font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Synthesizing Report...</span>
              </>
            ) : (
              <span>📑 Generate Report</span>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-16">
          <LoadingSpinner
            size="lg"
            label={`Compiling multi-factor quantitative analysis and generating structured intelligence for ${symbol}...`}
          />
        </div>
      )}

      {error && !loading && (
        <ErrorMessage
          title="Report Generation Failed"
          message={error}
          onRetry={handleGenerate}
        />
      )}

      {report && !loading && (
        <div className="space-y-6">
          {/* Section 1: Executive Summary */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-4 mb-4">
              <div>
                <span className="text-xs font-mono text-[#94a3b8] uppercase tracking-wider">
                  Executive Dossier
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-2xl font-bold font-mono text-[#f1f5f9]">
                    {report.symbol} Intelligence Brief
                  </h2>
                  <Badge variant={report.trend_analysis?.sma_crossover || "neutral"} size="md">
                    {report.trend_analysis?.sma_crossover || "NEUTRAL"}
                  </Badge>
                </div>
              </div>

              <div className="text-xs font-mono text-[#94a3b8]">
                Current Price:{" "}
                <span className="text-lg font-bold text-[#10b981]">
                  ${Number(report.current_price).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="bg-[#0a0f1a] border border-[#1e293b] p-4 rounded-lg">
              <h4 className="text-xs font-mono font-bold text-[#10b981] uppercase tracking-wider mb-2">
                Executive Synthesis
              </h4>
              <p className="text-xs text-[#f1f5f9] leading-relaxed font-sans">
                {report.overall_assessment}
              </p>
            </div>
          </div>

          {/* Section 2: Price Analysis & 52-Week Range */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2 flex items-center gap-2">
              <span>📊 Price Analysis & Range Position</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard
                label="52-Week High"
                value={`$${Number(report.price_range?.high_52w || 0).toFixed(2)}`}
                subtitle="Peak Price"
              />
              <MetricCard
                label="52-Week Low"
                value={`$${Number(report.price_range?.low_52w || 0).toFixed(2)}`}
                subtitle="Trough Price"
              />
              <MetricCard
                label="From 52W High"
                value={`${Number(report.price_range?.change_from_52w_high_pct || 0).toFixed(1)}%`}
                trend={report.price_range?.change_from_52w_high_pct >= 0 ? "up" : "down"}
              />
              <MetricCard
                label="From 52W Low"
                value={`+${Number(report.price_range?.change_from_52w_low_pct || 0).toFixed(1)}%`}
                trend="up"
              />
            </div>
          </div>

          {/* Section 3 & 4: Trend Analysis & Momentum Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trend Analysis */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
                📈 Trend Analysis
              </h3>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-[#0a0f1a] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-[#94a3b8] uppercase">20-Day SMA</span>
                  <div className="text-base font-bold text-[#f1f5f9] mt-0.5">
                    ${Number(report.trend_analysis?.sma_20 || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#0a0f1a] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-[#94a3b8] uppercase">50-Day SMA</span>
                  <div className="text-base font-bold text-[#f1f5f9] mt-0.5">
                    ${Number(report.trend_analysis?.sma_50 || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="p-3 bg-[#0a0f1a]/60 rounded border border-[#1e293b] text-xs font-sans text-[#94a3b8] leading-relaxed">
                {report.trend_analysis?.trend_description}
              </div>
            </div>

            {/* Momentum Assessment */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
                ⚡ Momentum Assessment
              </h3>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-[#0a0f1a] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-[#94a3b8] uppercase">RSI (14)</span>
                  <div className="text-base font-bold text-[#f1f5f9] mt-0.5">
                    {Number(report.momentum_analysis?.rsi || 0).toFixed(1)}
                  </div>
                  <span className="text-[10px] uppercase text-[#10b981]">
                    {report.momentum_analysis?.rsi_condition}
                  </span>
                </div>
                <div className="bg-[#0a0f1a] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-[#94a3b8] uppercase">MACD Value</span>
                  <div className="text-base font-bold text-[#f1f5f9] mt-0.5">
                    {Number(report.momentum_analysis?.macd || 0).toFixed(3)}
                  </div>
                  <span className="text-[10px] text-[#94a3b8]">
                    Sig: {Number(report.momentum_analysis?.macd_signal || 0).toFixed(3)}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-[#0a0f1a]/60 rounded border border-[#1e293b] text-xs font-sans text-[#94a3b8] leading-relaxed">
                {report.momentum_analysis?.macd_interpretation}
              </div>
            </div>
          </div>

          {/* Section 5 & 6: Volatility Analysis & Volume Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Volatility Analysis */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
                🌊 Volatility Analysis
              </h3>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-[#0a0f1a] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-[#94a3b8] uppercase">ATR (14)</span>
                  <div className="text-base font-bold text-[#f1f5f9] mt-0.5">
                    ${Number(report.volatility_assessment?.atr || 0).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-[#94a3b8]">Daily Range</span>
                </div>
                <div className="bg-[#0a0f1a] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-[#94a3b8] uppercase">BB Width</span>
                  <div className="text-base font-bold text-[#f1f5f9] mt-0.5">
                    {Number(report.volatility_assessment?.bollinger_width || 0).toFixed(3)}
                  </div>
                  <span className="text-[10px] text-[#94a3b8]">Channel Spread</span>
                </div>
              </div>
              <div className="p-3 bg-[#0a0f1a]/60 rounded border border-[#1e293b] text-xs font-sans text-[#94a3b8] leading-relaxed">
                {report.volatility_assessment?.volatility_assessment}
              </div>
            </div>

            {/* Volume Trends */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
                📦 Volume Dynamics
              </h3>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-[#0a0f1a] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-[#94a3b8] uppercase">Current Volume</span>
                  <div className="text-base font-bold text-[#f1f5f9] mt-0.5">
                    {Number(report.volume_analysis?.current_volume || 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-[#94a3b8]">Shares</span>
                </div>
                <div className="bg-[#0a0f1a] p-3 rounded border border-[#1e293b]">
                  <span className="text-[10px] text-[#94a3b8] uppercase">20D Avg Ratio</span>
                  <div className="text-base font-bold text-[#10b981] mt-0.5">
                    {Number(report.volume_analysis?.volume_ratio || 1).toFixed(2)}x
                  </div>
                  <span className="text-[10px] text-[#94a3b8]">Multiple of 20 SMA</span>
                </div>
              </div>
              <div className="p-3 bg-[#0a0f1a]/60 rounded border border-[#1e293b] text-xs font-sans text-[#94a3b8] leading-relaxed">
                {report.volume_analysis?.volume_assessment}
              </div>
            </div>
          </div>

          {/* Section 7: Key Support & Resistance Levels */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider border-b border-[#1e293b] pb-2">
              🛡️ Key Support & Resistance Channels
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#0a0f1a] border border-[#1e293b] p-4 rounded-lg">
                <div className="text-[10px] font-mono text-[#10b981] uppercase font-bold">
                  Major Support Level
                </div>
                <div className="text-2xl font-bold font-mono text-[#10b981] mt-1">
                  ${Number(report.support_resistance?.support || 0).toFixed(2)}
                </div>
                <div className="text-[10px] font-mono text-[#64748b] mt-1">Key Buyer Floor</div>
              </div>

              <div className="bg-[#0a0f1a] border border-[#1e293b] p-4 rounded-lg">
                <div className="text-[10px] font-mono text-[#ef4444] uppercase font-bold">
                  Major Resistance Level
                </div>
                <div className="text-2xl font-bold font-mono text-[#ef4444] mt-1">
                  ${Number(report.support_resistance?.resistance || 0).toFixed(2)}
                </div>
                <div className="text-[10px] font-mono text-[#64748b] mt-1">Seller Ceiling</div>
              </div>

              <div className="bg-[#0a0f1a] border border-[#1e293b] p-4 rounded-lg">
                <div className="text-[10px] font-mono text-[#94a3b8] uppercase">
                  50-Day Swing Low
                </div>
                <div className="text-xl font-bold font-mono text-[#f1f5f9] mt-1">
                  ${Number(report.support_resistance?.recent_low || 0).toFixed(2)}
                </div>
                <div className="text-[10px] font-mono text-[#64748b] mt-1">Trough Anchor</div>
              </div>

              <div className="bg-[#0a0f1a] border border-[#1e293b] p-4 rounded-lg">
                <div className="text-[10px] font-mono text-[#94a3b8] uppercase">
                  50-Day Swing High
                </div>
                <div className="text-xl font-bold font-mono text-[#f1f5f9] mt-1">
                  ${Number(report.support_resistance?.recent_high || 0).toFixed(2)}
                </div>
                <div className="text-[10px] font-mono text-[#64748b] mt-1">Crest Anchor</div>
              </div>
            </div>
          </div>

          {/* Section 8: Overall Quantitative Assessment */}
          <div className="bg-[#0a0f1a] border border-[#1e293b] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                Overall Quantitative Assessment
              </h3>
              <span className="text-xs font-mono text-[#64748b]">
                {new Date(report.timestamp).toLocaleString()}
              </span>
            </div>
            <p className="text-xs font-mono text-[#94a3b8] leading-relaxed">
              {report.overall_assessment}
            </p>
          </div>
        </div>
      )}

      {/* Empty Initial State */}
      {!report && !loading && !error && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-12 text-center space-y-3">
          <div className="text-4xl">📑</div>
          <h3 className="text-base font-semibold font-mono text-[#f1f5f9]">
            Generate Quantitative Research Report
          </h3>
          <p className="text-xs text-[#94a3b8] max-w-md mx-auto font-mono">
            Click &quot;Generate Report&quot; to synthesize multi-indicator intelligence, trend regressions, volatility channels, and support/resistance matrices for {symbol}.
          </p>
        </div>
      )}
    </div>
  );
}
