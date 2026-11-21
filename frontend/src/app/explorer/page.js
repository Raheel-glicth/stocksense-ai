"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import StockSearch from "@/components/StockSearch";
import PriceChart from "@/components/PriceChart";
import CandlestickChart from "@/components/CandlestickChart";
import DataTable from "@/components/DataTable";
import MetricCard from "@/components/MetricCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { getStockHistory, getCompanyInfo, getCurrentPrice } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import ChartTooltip from "@/components/Tooltip";

const PERIODS = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "5Y", value: "5y" },
];

export default function StockExplorerPage() {
  const [symbol, setSymbol] = useState("AAPL");
  const [period, setPeriod] = useState("1y");
  const [chartMode, setChartMode] = useState("area"); // "area" | "candlestick"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [history, setHistory] = useState([]);
  const [company, setCompany] = useState(null);
  const [price, setPrice] = useState(null);

  const loadData = useCallback(async (sym, per) => {
    setLoading(true);
    setError(null);

    try {
      const [histRes, compRes, priceRes] = await Promise.all([
        getStockHistory(sym, per, "1d"),
        getCompanyInfo(sym),
        getCurrentPrice(sym),
      ]);

      if (histRes.error) {
        setError(histRes.error);
        setLoading(false);
        return;
      }

      setHistory(histRes.data?.data || []);
      setCompany(compRes.data);
      setPrice(priceRes.data);
      setLoading(false);
    } catch (err) {
      setError(err.message || "Failed to load stock telemetry");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(symbol, period);
  }, [symbol, period, loadData]);

  // Key stats calculations
  const stats = useMemo(() => {
    if (!history || history.length === 0) return null;
    const closes = history.map((d) => Number(d.close)).filter((c) => !isNaN(c) && c > 0);
    const highs = history.map((d) => Number(d.high)).filter((h) => !isNaN(h) && h > 0);
    const lows = history.map((d) => Number(d.low)).filter((l) => !isNaN(l) && l > 0);
    const volumes = history.map((d) => Number(d.volume)).filter((v) => !isNaN(v) && v > 0);

    const latest = history[history.length - 1];
    const prev = history.length > 1 ? history[history.length - 2] : latest;
    const latestClose = Number(latest.close);
    const prevClose = Number(prev.close);
    const change = latestClose - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    const high52 = Math.max(...highs);
    const low52 = Math.min(...lows);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);

    return {
      open: Number(latest.open).toFixed(2),
      high: Number(latest.high).toFixed(2),
      low: Number(latest.low).toFixed(2),
      close: latestClose.toFixed(2),
      change: change.toFixed(2),
      changePct: changePct.toFixed(2),
      high52: high52.toFixed(2),
      low52: low52.toFixed(2),
      volume: Number(latest.volume).toLocaleString(),
      avgVolume: Math.round(avgVolume).toLocaleString(),
    };
  }, [history]);

  // Volume chart data
  const volumeData = useMemo(() => {
    return history.map((item) => {
      let dStr = item.date;
      try {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          dStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
      } catch (_) {}
      return {
        dateFormatted: dStr,
        volume: Number(item.volume || 0),
        isUp: Number(item.close) >= Number(item.open),
      };
    });
  }, [history]);

  // Price data table columns
  const tableColumns = [
    {
      key: "date",
      label: "Date",
      render: (val) => {
        try {
          return new Date(val).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        } catch (_) {
          return String(val).slice(0, 10);
        }
      },
    },
    {
      key: "open",
      label: "Open ($)",
      align: "right",
      render: (v) => Number(v).toFixed(2),
    },
    {
      key: "high",
      label: "High ($)",
      align: "right",
      render: (v) => <span className="text-[#10b981]">{Number(v).toFixed(2)}</span>,
    },
    {
      key: "low",
      label: "Low ($)",
      align: "right",
      render: (v) => <span className="text-[#ef4444]">{Number(v).toFixed(2)}</span>,
    },
    {
      key: "close",
      label: "Close ($)",
      align: "right",
      render: (v) => <span className="font-semibold">{Number(v).toFixed(2)}</span>,
    },
    {
      key: "volume",
      label: "Volume",
      align: "right",
      render: (v) => Number(v).toLocaleString(),
    },
    {
      key: "change",
      label: "Day Return",
      align: "right",
      render: (_, row) => {
        const diff = Number(row.close) - Number(row.open);
        const pct = row.open > 0 ? (diff / row.open) * 100 : 0;
        const isBull = diff >= 0;
        return (
          <span className={`font-mono ${isBull ? "text-[#10b981]" : "text-[#ef4444]"}`}>
            {isBull ? "+" : ""}
            {pct.toFixed(2)}%
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header and Full-Width Stock Search */}
      <div className="pb-4 border-b border-[#1e293b] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#f1f5f9] flex items-center gap-2">
              <span>Stock Explorer</span>
              <span className="text-sm px-2 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-normal">
                {symbol}
              </span>
            </h1>
            <p className="text-xs text-[#94a3b8] font-mono mt-0.5">
              Interactive OHLCV time-series telemetry and market microstructure
            </p>
          </div>

          {stats && (
            <div className="text-right font-mono">
              <div className="text-2xl font-bold text-[#f1f5f9]">${stats.close}</div>
              <div
                className={`text-xs font-semibold ${
                  Number(stats.change) >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                }`}
              >
                {Number(stats.change) >= 0 ? "▲ +" : "▼ "}
                {stats.change} ({Number(stats.changePct) >= 0 ? "+" : ""}
                {stats.changePct}%)
              </div>
            </div>
          )}
        </div>

        {/* Full-width search input */}
        <div className="w-full">
          <StockSearch
            currentSymbol={symbol}
            onSelectStock={(s) => setSymbol(s)}
            placeholder="Search symbol (e.g. AAPL, NVDA, TSLA, MSFT, RELIANCE.NS)..."
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-16">
          <LoadingSpinner size="lg" label={`Loading OHLCV history for ${symbol}...`} />
        </div>
      ) : error ? (
        <ErrorMessage
          title={`Unable to load explorer data for ${symbol}`}
          message={error}
          onRetry={() => loadData(symbol, period)}
        />
      ) : (
        <>
          {/* Key Statistics Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Open" value={`$${stats?.open || "—"}`} />
            <MetricCard label="High" value={`$${stats?.high || "—"}`} />
            <MetricCard label="Low" value={`$${stats?.low || "—"}`} />
            <MetricCard label="Period High" value={`$${stats?.high52 || "—"}`} subtitle={period} />
            <MetricCard label="Period Low" value={`$${stats?.low52 || "—"}`} subtitle={period} />
            <MetricCard label="Avg Volume" value={stats?.avgVolume || "—"} />
          </div>

          {/* Interactive Chart Container */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
            {/* Chart Toolbar: Period Selector & Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-1 bg-[#0a0f1a] p-1 rounded-lg border border-[#1e293b]">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`px-3 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                      period === p.value
                        ? "bg-[#10b981] text-black font-bold shadow"
                        : "text-[#94a3b8] hover:text-[#f1f5f9]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Chart Mode Toggle */}
              <div className="flex items-center gap-1 bg-[#0a0f1a] p-1 rounded-lg border border-[#1e293b]">
                <button
                  onClick={() => setChartMode("area")}
                  className={`px-3 py-1 rounded text-xs font-mono flex items-center gap-1 transition-all cursor-pointer ${
                    chartMode === "area"
                      ? "bg-[#1e293b] text-[#10b981] font-semibold"
                      : "text-[#94a3b8] hover:text-[#f1f5f9]"
                  }`}
                >
                  <span>📈</span> Area
                </button>
                <button
                  onClick={() => setChartMode("candlestick")}
                  className={`px-3 py-1 rounded text-xs font-mono flex items-center gap-1 transition-all cursor-pointer ${
                    chartMode === "candlestick"
                      ? "bg-[#1e293b] text-[#10b981] font-semibold"
                      : "text-[#94a3b8] hover:text-[#f1f5f9]"
                  }`}
                >
                  <span>🕯️</span> Candlestick
                </button>
              </div>
            </div>

            {/* Price Chart */}
            <div className="w-full">
              {chartMode === "area" ? (
                <PriceChart data={history} height={380} />
              ) : (
                <CandlestickChart data={history} height={380} />
              )}
            </div>

            {/* Volume Bar Chart */}
            <div className="pt-3 border-t border-[#1e293b]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[#94a3b8] uppercase tracking-wider">
                  Volume Breakdown
                </span>
                <span className="text-[11px] font-mono text-[#64748b]">
                  Green: Up session • Red: Down session
                </span>
              </div>
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.4} />
                    <XAxis
                      dataKey="dateFormatted"
                      stroke="#64748b"
                      fontSize={9}
                      fontFamily="monospace"
                      tickLine={false}
                      axisLine={{ stroke: "#1e293b" }}
                      minTickGap={30}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={9}
                      fontFamily="monospace"
                      tickLine={false}
                      axisLine={false}
                      orientation="right"
                      tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`}
                      width={45}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(v) => Number(v).toLocaleString()}
                        />
                      }
                    />
                    <Bar dataKey="volume" name="Shares" isAnimationActive={false}>
                      {volumeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isUp ? "#10b981" : "#ef4444"}
                          opacity={0.7}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Historical Price Data Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
                Historical Price Telemetry
              </h3>
              <span className="text-xs font-mono text-[#94a3b8]">
                {history.length} Sessions Recorded
              </span>
            </div>
            <DataTable
              columns={tableColumns}
              data={[...history].reverse()} // Show newest first
              defaultSortKey="date"
              defaultSortDir="desc"
              pageSize={15}
            />
          </div>
        </>
      )}
    </div>
  );
}
