"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import ChartTooltip from "./Tooltip";

export default function PriceChart({
  data = [],
  height = 320,
  syncId,
  showGrid = true,
  showYAxis = true,
  currency = "$",
  colorTheme = "auto", // "auto", "green", "red", "blue"
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

      return {
        ...item,
        dateFormatted: formattedDate,
        close: item.close !== undefined ? Number(item.close) : Number(item.price || 0),
        volume: item.volume !== undefined ? Number(item.volume) : 0,
      };
    });
  }, [data]);

  const { isUp, minPrice, maxPrice, gradientColor } = useMemo(() => {
    if (chartData.length < 2) {
      return { isUp: true, minPrice: 0, maxPrice: 100, gradientColor: "#10b981" };
    }
    const firstClose = chartData[0].close;
    const lastClose = chartData[chartData.length - 1].close;
    const up = lastClose >= firstClose;

    const prices = chartData.map((d) => d.close).filter((p) => !isNaN(p) && p > 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.05 || max * 0.05 || 1;

    let color = "#10b981";
    if (colorTheme === "green") color = "#10b981";
    else if (colorTheme === "red") color = "#ef4444";
    else if (colorTheme === "blue") color = "#3b82f6";
    else color = up ? "#10b981" : "#ef4444";

    return {
      isUp: up,
      minPrice: Math.max(0, Math.floor(min - padding)),
      maxPrice: Math.ceil(max + padding),
      gradientColor: color,
    };
  }, [chartData, colorTheme]);

  if (!chartData || chartData.length === 0) {
    return (
      <div
        style={{ height }}
        className={`w-full flex items-center justify-center bg-[#0a0f1a]/50 border border-[#1e293b] rounded-lg text-xs font-mono text-[#94a3b8] ${className}`}
      >
        No price history data available.
      </div>
    );
  }

  const gradientId = `priceGradient_${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          syncId={syncId}
          margin={{ top: 10, right: 10, left: showYAxis ? 0 : -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColor} stopOpacity={0.35} />
              <stop offset="95%" stopColor={gradientColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
              opacity={0.6}
            />
          )}

          <XAxis
            dataKey="dateFormatted"
            stroke="#64748b"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            minTickGap={30}
          />

          {showYAxis && (
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
          )}

          <Tooltip
            content={
              <ChartTooltip
                formatter={(val) => `${currency}${Number(val).toFixed(2)}`}
              />
            }
          />

          <Area
            type="monotone"
            dataKey="close"
            name="Close Price"
            stroke={gradientColor}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
