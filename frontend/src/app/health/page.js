"use client";

import { useState, useEffect, useCallback } from "react";
import Badge from "@/components/Badge";
import MetricCard from "@/components/MetricCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { fetchHealth, API_URL } from "@/lib/api";

export default function HealthPage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);
  const [pingHistory, setPingHistory] = useState([]);
  const [testingPing, setTestingPing] = useState(false);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const { data, error: apiError } = await fetchHealth();
      const duration = Math.round(performance.now() - start);

      if (apiError) {
        setError(apiError);
        setLatency(null);
      } else {
        setHealthData(data);
        setLatency(duration);
        setPingHistory((prev) => [
          { time: new Date().toLocaleTimeString(), latency: duration, status: "OK" },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (err) {
      setError(err.message || "Failed to reach backend");
      setLatency(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const pingTest = async () => {
    setTestingPing(true);
    const start = performance.now();
    try {
      const res = await fetch(`${API_URL}/api/health`, { cache: "no-store" });
      const duration = Math.round(performance.now() - start);
      if (res.ok) {
        setLatency(duration);
        setPingHistory((prev) => [
          { time: new Date().toLocaleTimeString(), latency: duration, status: "OK" },
          ...prev.slice(0, 9),
        ]);
      } else {
        setPingHistory((prev) => [
          { time: new Date().toLocaleTimeString(), latency: duration, status: `HTTP ${res.status}` },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (_) {
      setPingHistory((prev) => [
        { time: new Date().toLocaleTimeString(), latency: null, status: "FAILED" },
        ...prev.slice(0, 9),
      ]);
    } finally {
      setTestingPing(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const isHealthy = healthData?.status === "healthy" && !error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1e293b]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#f1f5f9] flex items-center gap-2">
              <span>System & Data Health</span>
              <span className="text-sm px-2.5 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-mono">
                Diagnostics
              </span>
            </h1>
            <p className="text-xs text-[#94a3b8] font-mono mt-1">
              Real-time telemetry of backend API, loaded model weights, memory cache, and network latency
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={checkHealth}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-xs font-mono text-[#f1f5f9] transition-colors border border-[#1e293b] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>↻</span> Refresh Telemetry
            </button>
            <button
              onClick={pingTest}
              disabled={testingPing}
              className="px-3.5 py-2 rounded-lg bg-[#10b981] hover:bg-[#0da674] text-black font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {testingPing ? (
                <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>⚡</span>
              )}
              <span>Ping Latency</span>
            </button>
          </div>
        </div>
      </div>

      {loading && !healthData && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-16">
          <LoadingSpinner size="lg" label="Querying backend health status..." />
        </div>
      )}

      {error && (
        <ErrorMessage
          title="Backend Connection Offline"
          message={`Unable to connect to FastAPI backend at ${API_URL}. Ensure the backend server is running with 'python main.py' or 'uvicorn main:app --reload'.`}
          onRetry={checkHealth}
        />
      )}

      {/* Hero Status Banner */}
      <div
        className={`border rounded-xl p-6 transition-all ${
          isHealthy
            ? "bg-[#10b981]/10 border-[#10b981]/40"
            : "bg-[#ef4444]/10 border-[#ef4444]/40"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold border ${
                isHealthy
                  ? "bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]"
                  : "bg-[#ef4444]/20 border-[#ef4444]/40 text-[#ef4444]"
              }`}
            >
              {isHealthy ? "✓" : "✕"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-mono text-[#f1f5f9]">
                  {isHealthy ? "All Systems Operational" : "Backend Service Unavailable"}
                </h2>
                <Badge variant={isHealthy ? "bullish" : "bearish"} size="md">
                  {isHealthy ? "HEALTHY" : "OFFLINE"}
                </Badge>
              </div>
              <p className="text-xs font-mono text-[#94a3b8] mt-1">
                Endpoint: <span className="text-[#f1f5f9]">{API_URL}/api/health</span> • Version:{" "}
                <span className="text-[#f1f5f9]">{healthData?.version || "1.0.0"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 font-mono text-xs">
            <div>
              <div className="text-[10px] text-[#94a3b8] uppercase">Round-Trip Latency</div>
              <div className="text-lg font-bold text-[#10b981]">
                {latency !== null ? `${latency} ms` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#94a3b8] uppercase">Models Active</div>
              <div className="text-lg font-bold text-[#f1f5f9]">
                {healthData?.models_loaded?.length || 0} In Memory
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="FastAPI Backend"
          value={isHealthy ? "Running" : "Offline"}
          subtitle={`Host: localhost:8000`}
          trend={isHealthy ? "up" : "down"}
          icon="⚡"
        />

        <MetricCard
          label="Network Latency"
          value={latency !== null ? `${latency} ms` : "Timeout"}
          subtitle={latency && latency < 100 ? "Low Latency" : "Normal Response"}
          trend={latency && latency < 200 ? "up" : "down"}
          icon="⏱️"
        />

        <MetricCard
          label="Data Provider"
          value="Yahoo Finance"
          subtitle="Cache TTL: 24 Hours"
          trend="up"
          icon="📡"
        />

        <MetricCard
          label="Feature Pipeline"
          value="30+ Features"
          subtitle="RSI, MACD, BB, Volatility"
          trend="up"
          icon="🔬"
        />
      </div>

      {/* Loaded Models Matrix */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
          <div>
            <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
              Loaded Machine Learning Models
            </h3>
            <p className="text-[11px] font-mono text-[#94a3b8]">
              Pre-trained serialized weights (.pkl) loaded in backend server memory
            </p>
          </div>
          <span className="text-xs font-mono text-[#10b981]">
            {healthData?.models_loaded?.length || 0} Models Available
          </span>
        </div>

        {healthData?.models_loaded?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {healthData.models_loaded.map((modelName) => (
              <div
                key={modelName}
                className="bg-[#0a0f1a] border border-[#1e293b] p-3.5 rounded-lg flex items-center justify-between font-mono"
              >
                <div>
                  <div className="text-xs font-bold text-[#f1f5f9]">{modelName}</div>
                  <div className="text-[10px] text-[#94a3b8] mt-0.5">Ready for inference</div>
                </div>
                <Badge variant="bullish" size="sm">
                  READY
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#0a0f1a] border border-[#1e293b] p-6 rounded-lg text-center text-xs font-mono text-[#94a3b8]">
            No persistent models saved to disk yet. Models train automatically on-demand when requested by any module.
          </div>
        )}
      </div>

      {/* Latency History & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Log Table */}
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
              API Latency Log
            </h3>
            <span className="text-[10px] font-mono text-[#64748b]">Recent Pings</span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            {pingHistory.length === 0 ? (
              <div className="text-center py-6 text-[#64748b]">No ping history recorded yet.</div>
            ) : (
              pingHistory.map((ping, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-[#0a0f1a] border border-[#1e293b]"
                >
                  <span className="text-[#94a3b8]">{ping.time}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#10b981] font-semibold">
                      {ping.latency !== null ? `${ping.latency} ms` : "—"}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        ping.status === "OK"
                          ? "bg-[#10b981]/20 text-[#10b981]"
                          : "bg-[#ef4444]/20 text-[#ef4444]"
                      }`}
                    >
                      {ping.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Data Freshness & Cache Telemetry */}
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 space-y-3">
          <div className="border-b border-[#1e293b] pb-2">
            <h3 className="text-sm font-semibold text-[#f1f5f9] font-mono uppercase tracking-wider">
              Data Freshness & Storage
            </h3>
            <p className="text-[11px] font-mono text-[#94a3b8]">Local caching and API rate limiting safety</p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-[#0a0f1a] border border-[#1e293b] p-3 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-[#94a3b8] block text-[10px] uppercase">Cache Architecture</span>
                <span className="text-[#f1f5f9] font-bold">Pickle / Disk Serialization</span>
              </div>
              <span className="text-[#10b981]">24h Expiry</span>
            </div>

            <div className="bg-[#0a0f1a] border border-[#1e293b] p-3 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-[#94a3b8] block text-[10px] uppercase">Market Coverage</span>
                <span className="text-[#f1f5f9] font-bold">US Equities & National Stock Exchange (India)</span>
              </div>
              <span className="text-[#3b82f6]">Dual Market</span>
            </div>

            <div className="bg-[#0a0f1a] border border-[#1e293b] p-3 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-[#94a3b8] block text-[10px] uppercase">Client Environment</span>
                <span className="text-[#f1f5f9] font-bold">Next.js 14 App Router (Turbopack)</span>
              </div>
              <span className="text-[#10b981]">SSR / Client Hydrated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
