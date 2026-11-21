"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Cell,
  ErrorBar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// Custom Tooltip for Candlesticks
function CandlestickTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const isBullish = data.close >= data.open;
  const change = data.close - data.open;
  const changePct = data.open > 0 ? (change / data.open) * 100 : 0;

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-3 shadow-2xl text-xs font-mono backdrop-blur-md min-w-[170px] z-50">
      <div className="text-[#94a3b8] text-[11px] mb-2 border-b border-[#1e293b] pb-1">
        {data.dateFormatted || data.date}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div className="text-[#94a3b8]">Open:</div>
        <div className="text-right text-[#f1f5f9] font-medium">${Number(data.open).toFixed(2)}</div>
        <div className="text-[#94a3b8]">High:</div>
        <div className="text-right text-[#10b981] font-medium">${Number(data.high).toFixed(2)}</div>
        <div className="text-[#94a3b8]">Low:</div>
        <div className="text-right text-[#ef4444] font-medium">${Number(data.low).toFixed(2)}</div>
        <div className="text-[#94a3b8]">Close:</div>
        <div className="text-right text-[#f1f5f9] font-medium">${Number(data.close).toFixed(2)}</div>
      </div>
      <div className="mt-2 pt-1.5 border-t border-[#1e293b] flex justify-between items-center text-[11px]">
        <span className="text-[#94a3b8]">Change:</span>
        <span className={`font-semibold ${isBullish ? "text-[#10b981]" : "text-[#ef4444]"}`}>
          {change >= 0 ? `+$${change.toFixed(2)}` : `-$${Math.abs(change).toFixed(2)}`} (
          {changePct >= 0 ? `+${changePct.toFixed(2)}%` : `${changePct.toFixed(2)}%`})
        </span>
      </div>
    </div>
  );
}

// Custom Bar shape that renders both the candle body and the high-low wick
const CandlestickShape = (props) => {
  const { x, y, width, height, payload, yAxis } = props;
  if (!payload || !yAxis) return null;

  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? "#10b981" : "#ef4444";

  // Calculate pixel positions using the yAxis scale
  const scale = yAxis.scale;
  if (typeof scale !== "function") {
    // Fallback if scale function isn't available
    return <rect x={x} y={y} width={Math.max(width, 2)} height={Math.max(height, 2)} fill={color} />;
  }

  const yHigh = scale(high);
  const yLow = scale(low);
  const yOpen = scale(open);
  const yClose = scale(close);

  const candleTop = Math.min(yOpen, yClose);
  const candleBottom = Math.max(yOpen, yClose);
  const bodyHeight = Math.max(candleBottom - candleTop, 2);
  const candleWidth = Math.max(Math.min(width * 0.8, 14), 3);
  const candleX = x + (width - candleWidth) / 2;
  const centerX = x + width / 2;

  return (
    <g>
      {/* Upper & Lower Wick (Single vertical line from high to low) */}
      <line
        x1={centerX}
        y1={yHigh}
        x2={centerX}
        y2={yLow}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Real body */}
      <rect
        x={candleX}
        y={candleTop}
        width={candleWidth}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={1}
        rx={0.5}
      />
    </g>
  );
};

export default function CandlestickChart({
  data = [],
  height = 360,
  currency = "$",
  className = "",
}) {
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((item) => {
      let rawDate = item.date || item.timestamp || "";
      let formattedDate = rawDate;
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        }
      } catch (_) {}

      const open = Number(item.open || 0);
      const close = Number(item.close || 0);
      const high = Number(item.high || Math.max(open, close));
      const low = Number(item.low || Math.min(open, close));
      const isUp = close >= open;

      return {
        ...item,
        dateFormatted: formattedDate,
        open,
        close,
        high,
        low,
        isUp,
        // For Recharts ComposedChart stacked bars
        candleBase: Math.min(open, close),
        candleBody: Math.max(Math.abs(close - open), 0.05),
        // Error bar wick offsets relative to candleBody top/bottom
        wick: [Math.min(open, close) - low, high - Math.max(open, close)],
      };
    });
  }, [data]);

  const { minPrice, maxPrice } = useMemo(() => {
    if (chartData.length === 0) return { minPrice: 0, maxPrice: 100 };
    const lows = chartData.map((d) => d.low).filter((l) => !isNaN(l) && l > 0);
    const highs = chartData.map((d) => d.high).filter((h) => !isNaN(h) && h > 0);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.05 || max * 0.05 || 1;
    return {
      minPrice: Math.max(0, Math.floor(min - padding)),
      maxPrice: Math.ceil(max + padding),
    };
  }, [chartData]);

  if (!chartData || chartData.length === 0) {
    return (
      <div
        style={{ height }}
        className={`w-full flex items-center justify-center bg-[#0a0f1a]/50 border border-[#1e293b] rounded-lg text-xs font-mono text-[#94a3b8] ${className}`}
      >
        No candlestick data available.
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1e293b"
            vertical={false}
            opacity={0.6}
          />
          <XAxis
            dataKey="dateFormatted"
            stroke="#64748b"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            minTickGap={25}
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            stroke="#64748b"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={false}
            orientation="right"
            tickFormatter={(v) => `${currency}${v.toFixed(v < 10 ? 2 : 0)}`}
            width={55}
          />
          <Tooltip content={<CandlestickTooltip />} />

          {/* Candlesticks rendered via custom shape with exact wicks & bodies */}
          <Bar
            dataKey="candleBody"
            shape={<CandlestickShape />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
