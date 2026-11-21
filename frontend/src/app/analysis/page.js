"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import StockSearch from "@/components/StockSearch";
import MetricCard from "@/components/MetricCard";
import Badge from "@/components/Badge";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import ChartTooltip from "@/components/Tooltip";
import { getIndicators, getRegime, getStockHistory } from "@/lib/api";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  BarChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";

export default function AnalysisPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [period, setPeriod] = useState("1y");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [indicators, setIndicators] = useState(null);
  const [regime, setRegime] = useState(null);
  const [history, setHistory] = useState([]);

  const loadData = useCallback(async (sym, per) => {
    setLoading(true);
    setError(null);
    try {
      const [indRes, regRes, histRes] = await Promise.all([
        getIndicators(sym, per),
        getRegime(sym, per),
        getStockHistory(sym, per, "1d"),
      ]);

      if (indRes.error) {
        setError(indRes.error);
        setLoading(false);
        return;
      }

      setIndicators(indRes.data);
      setRegime(regRes.data);
      setHistory(histRes.data?.data || []);
      setLoading(false);
    } catch (err) {
      setError(err.message || "Failed to load quantitative indicators");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(symbol, period);
  }, [symbol, period, loadData]);

  // Combine indicators and history into a unified array for charting
  const mergedData = useMemo(() => {
    if (!indicators?.dates || indicators.dates.length === 0) return [];

    // Create a price lookup map by date substring
    const priceMap = {};
    history.forEach((h) => {
      const d = String(h.date).slice(0, 10);
      priceMap[d] = Number(h.close);
    });

    return indicators.dates.map((dateStr, idx) => {
      let formatted = dateStr;
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
      } catch (_) {}

      const dateKey = String(dateStr).slice(0, 10);
      const closePrice = priceMap[dateKey] || indicators.bb_middle[idx];

      return {
        date: dateStr,
        dateFormatted: formatted,
        rsi: indicators.rsi[idx] ? Number(indicators.rsi[idx].toFixed(2)) : null,
        macd: indicators.macd[idx] ? Number(indicators.macd[idx].toFixed(4)) : 0,
        macd_signal: indicators.macd_signal[idx] ? Number(indicators.macd_signal[idx].toFixed(4)) : 0,
        macd_histogram: indicators.macd_histogram[idx] ? Number(indicators.macd_histogram[idx].toFixed(4)) : 0,
        bb_upper: indicators.bb_upper[idx] ? Number(indicators.bb_upper[idx].toFixed(2)) : null,
        bb_middle: indicators.bb_middle[idx] ? Number(indicators.bb_middle[idx].toFixed(2)) : null,
        bb_lower: indicators.bb_lower[idx] ? Number(indicators.bb_lower[idx].toFixed(2)) : null,
        atr: indicators.atr[idx] ? Number(indicators.atr[idx].toFixed(2)) : null,
        volatility: indicators.volatility[idx] ? Number((indicators.volatility[idx] * 100).toFixed(2)) : null,
        close: closePrice ? Number(closePrice.toFixed(2)) : null,
      };
    });
  }, [indicators, history]);

  // Bollinger Bands domain calculation
  const bbDomain = useMemo(() => {
    if (mergedData.length === 0) return [0, 100];
    const vals = [];
    mergedData.forEach((d) => {
      if (d.bb_upper) vals.push(d.bb_upper);
      if (d.bb_lower) vals.push(d.bb_lower);
      if (d.close) vals.push(d.close);
    });
    if (vals.length === 0) return [0, 100];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.05 || 1;
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [mergedData]);

  const latest = mergedData.length > 0 ? mergedData[mergedData.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#f1f5f9]">
              Quantitative Analysis
            </h1>
            <span className="text-sm px-2.5 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-mono font-semibold">
              {symbol}
            </span>
          </div>
          <p className="text-xs text-[#94a3b8] font-mono mt-1">
            Technical indicators, statistical signals & market regime classification
          </p>
        </div>

        <div className="w-full md:w-80">
          <StockSearch
            currentSymbol={symbol}
            onSelectStock={(s) => setSymbol(s)}
            showQuickPicks={false}
          />
        </div>
      </div>

      <StockSearch
        currentSymbol={symbol}
        onSelectStock={(s) => setSymbol(s)}
        className="!space-y-0"
      />

      {loading ? (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-16">
          <LoadingSpinner size="lg" label={`Calculating technical indicators for ${symbol}...`} />
        </div>
      ) : error ? (
        <ErrorMessage
          title="Analysis Telemetry Error"
          message={error}
          onRetry={() => loadData(symbol, period)}
        />
      ) : (
        <>
          {/* Regime Classification Hero Card */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-[#94a3b8] uppercase tracking-wider block mb-1">
                  Market Regime Classification
                </span>
                <div className="flex items-center gap-3">
                  <Badge variant={regime?.regime || "neutral"} size="lg">
                    {regime?.regime || "NEUTRAL"}
                  </Badge>
                  <span className="text-xs font-mono text-[#94a3b8]">
                    Confidence:{" "}
                    <span className="text-[#f1f5f9] font-bold">
                      {regime?.confidence ? `${(regime.confidence * 100).toFixed(0)}%` : "N/A"}
                    </span>
                  </span>
                </div>
              </div>

              {/* Regime Signals Pill Matrix */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <div className="bg-[#0a0f1a] border border-[#1e293b] px-3 py-1.5 rounded-lg">
                  <span className="text-[#94a3b8]">SMA Trend: </span>
                  <span
                    className={
                      regime?.signals?.sma_crossover === "bullish"
                        ? "text-[#10b981] font-semibold"
                        : regime?.signals?.sma_crossover === "bearish"
                        ? "text-[#ef4444] font-semibold"
                        : "text-[#94a3b8]"
                    }
                  >
                    {regime?.signals?.sma_crossover || "Neutral"}
                  </span>
                </div>

                <div className="bg-[#0a0f1a] border border-[#1e293b] px-3 py-1.5 rounded-lg">
                  <span className="text-[#94a3b8]">RSI Zone: </span>
                  <span
                    className={
                      regime?.signals?.rsi_zone === "oversold"
                        ? "text-[#10b981] font-semibold"
                        : regime?.signals?.rsi_zone === "overbought"
                        ? "text-[#f59e0b] font-semibold"
                        : "text-[#f1f5f9]"
                    }
                  >
                    {regime?.signals?.rsi_zone || "Normal"}
                  </span>
                </div>

                <div className="bg-[#0a0f1a] border border-[#1e293b] px-3 py-1.5 rounded-lg">
                  <span className="text-[#94a3b8]">Volatility: </span>
                  <span
                    className={
                      regime?.signals?.is_high_volatility
                        ? "text-[#f59e0b] font-semibold"
                        : "text-[#10b981] font-semibold"
                    }
                  >
                    {regime?.signals?.is_high_volatility ? "Elevated" : "Normal"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard
              label="RSI (14)"
              value={latest?.rsi || "—"}
              subtitle={
                latest?.rsi > 70 ? "Overbought" : latest?.rsi < 30 ? "Oversold" : "Neutral"
              }
              trend={latest?.rsi > 50 ? "up" : "down"}
            />
            <MetricCard
              label="MACD Histogram"
              value={latest?.macd_histogram || "—"}
              subtitle={latest?.macd_histogram >= 0 ? "Bullish Expansion" : "Bearish Expansion"}
              trend={latest?.macd_histogram >= 0 ? "up" : "down"}
            />
            <MetricCard
              label="Bollinger Upper"
              value={`$${latest?.bb_upper || "—"}`}
              subtitle="20 SMA + 2σ"
            />
            <MetricCard
              label="Rolling Volatility"
              value={latest?.volatility ? `${latest.volatility}%` : "—"}
              subtitle="20-Day Annualized"
            />
          </div>

          {/* Chart 1: Bollinger Bands Overlay */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <div>
                <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider flex items-center gap-2">
                  <span>Bollinger Bands (20, 2) & Close Price</span>
                </h3>
                <p className="text-[11px] font-mono text-[#94a3b8]">
                  Upper/Lower bands illustrate volatility boundaries around the 20-period SMA
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-[#f1f5f9]">
                  <span className="w-2.5 h-0.5 bg-[#f1f5f9]" /> Close
                </span>
                <span className="flex items-center gap-1 text-[#3b82f6]">
                  <span className="w-2.5 h-0.5 bg-[#3b82f6]" /> SMA 20
                </span>
                <span className="flex items-center gap-1 text-[#10b981]">
                  <span className="w-2.5 h-0.5 bg-[#10b981]" /> Bands
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    domain={bbDomain}
                    stroke="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                    tickFormatter={(v) => `$${v}`}
                    width={55}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        formatter={(val) => `$${Number(val).toFixed(2)}`}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="bb_upper"
                    name="Upper Band"
                    stroke="#10b981"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="bb_middle"
                    name="SMA 20 (Middle)"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="bb_lower"
                    name="Lower Band"
                    stroke="#10b981"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    name="Close Price"
                    stroke="#f1f5f9"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: RSI with 70/30 Reference Lines */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <div>
                <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                  Relative Strength Index (RSI 14)
                </h3>
                <p className="text-[11px] font-mono text-[#94a3b8]">
                  Overbought threshold &gt; 70 • Oversold threshold &lt; 30
                </p>
              </div>
              <div className="text-xs font-mono text-[#94a3b8]">
                Current RSI:{" "}
                <span
                  className={`font-bold ${
                    latest?.rsi > 70
                      ? "text-[#f59e0b]"
                      : latest?.rsi < 30
                      ? "text-[#10b981]"
                      : "text-[#f1f5f9]"
                  }`}
                >
                  {latest?.rsi || "—"}
                </span>
              </div>
            </div>

            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    domain={[0, 100]}
                    ticks={[0, 30, 50, 70, 100]}
                    stroke="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                    width={40}
                  />
                  <ReferenceLine
                    y={70}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: "70 Overbought", fill: "#f59e0b", fontSize: 9, position: "insideTopRight" }}
                  />
                  <ReferenceLine
                    y={30}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: "30 Oversold", fill: "#10b981", fontSize: 9, position: "insideBottomRight" }}
                  />
                  <ReferenceLine y={50} stroke="#1e293b" strokeDasharray="2 2" />
                  <Tooltip content={<ChartTooltip formatter={(v) => Number(v).toFixed(2)} />} />
                  <Line
                    type="monotone"
                    dataKey="rsi"
                    name="RSI (14)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: MACD (Signal + Histogram) */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <div>
                <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                  MACD (12, 26, 9)
                </h3>
                <p className="text-[11px] font-mono text-[#94a3b8]">
                  Moving Average Convergence Divergence line, signal line, and expansion histogram
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-[#3b82f6]">
                  <span className="w-2.5 h-0.5 bg-[#3b82f6]" /> MACD
                </span>
                <span className="flex items-center gap-1 text-[#f59e0b]">
                  <span className="w-2.5 h-0.5 bg-[#f59e0b]" /> Signal
                </span>
                <span className="flex items-center gap-1 text-[#10b981]">
                  <span className="w-2 h-2 bg-[#10b981] rounded-xs" /> Hist
                </span>
              </div>
            </div>

            <div className="h-60 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    width={50}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                  <Tooltip content={<ChartTooltip formatter={(v) => Number(v).toFixed(4)} />} />
                  <Bar dataKey="macd_histogram" name="Histogram" isAnimationActive={false}>
                    {mergedData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.macd_histogram >= 0 ? "#10b981" : "#ef4444"}
                        opacity={0.8}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="macd"
                    name="MACD Line"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="macd_signal"
                    name="Signal Line"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Volatility & ATR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-2">
              <div className="border-b border-[#1e293b] pb-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                  Rolling Volatility (20-Day)
                </h3>
                <p className="text-[11px] font-mono text-[#94a3b8]">Annualized standard deviation (%)</p>
              </div>
              <div className="h-48 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                    <XAxis dataKey="dateFormatted" stroke="#64748b" fontSize={9} minTickGap={30} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={9}
                      orientation="right"
                      tickFormatter={(v) => `${v}%`}
                      width={45}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />} />
                    <Line
                      type="monotone"
                      dataKey="volatility"
                      name="Volatility"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-2">
              <div className="border-b border-[#1e293b] pb-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                  Average True Range (ATR 14)
                </h3>
                <p className="text-[11px] font-mono text-[#94a3b8]">Absolute dollar volatility per session</p>
              </div>
              <div className="h-48 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                    <XAxis dataKey="dateFormatted" stroke="#64748b" fontSize={9} minTickGap={30} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={9}
                      orientation="right"
                      tickFormatter={(v) => `$${v}`}
                      width={45}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />} />
                    <Line
                      type="monotone"
                      dataKey="atr"
                      name="ATR"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
