"use client";

import { useState, useEffect, useRef } from "react";
import { searchStocks } from "@/lib/api";

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "RELIANCE.NS", name: "Reliance Ind." },
];

export default function StockSearch({
  currentSymbol = "AAPL",
  onSelectStock,
  placeholder = "Search symbol or company name (e.g. AAPL, NVDA, RELIANCE.NS)...",
  className = "",
  showQuickPicks = true,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await searchStocks(query);
      if (data && Array.isArray(data)) {
        setResults(data);
      } else {
        setResults([]);
      }
      setLoading(false);
      setIsOpen(true);
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (symbol) => {
    if (onSelectStock) {
      onSelectStock(symbol.toUpperCase());
    }
    setQuery("");
    setIsOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      handleSelect(query.trim());
    }
  };

  return (
    <div className={`space-y-2 ${className}`} ref={containerRef}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-[#94a3b8] text-sm pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            placeholder={placeholder}
            className="w-full bg-[#111827] border border-[#1e293b] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] rounded-lg pl-10 pr-24 py-2.5 text-sm text-[#f1f5f9] placeholder-[#94a3b8]/60 font-mono transition-all outline-none"
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-[#1e293b] border-t-[#10b981] rounded-full animate-spin mr-1" />
            )}
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[#94a3b8] hover:text-[#f1f5f9] text-xs px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="bg-[#1e293b] hover:bg-[#10b981] hover:text-black text-[#f1f5f9] px-2.5 py-1 rounded text-xs font-mono transition-colors"
            >
              Select
            </button>
          </div>
        </div>

        {/* Dropdown Results */}
        {isOpen && results.length > 0 && (
          <div className="absolute left-0 right-0 mt-1.5 bg-[#111827] border border-[#1e293b] rounded-lg shadow-2xl max-h-64 overflow-y-auto z-50 divide-y divide-[#1e293b]/50">
            {results.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => handleSelect(item.symbol)}
                className="w-full text-left p-3 hover:bg-[#1e293b]/50 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#f1f5f9] group-hover:text-[#10b981] transition-colors">
                      {item.symbol}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0a0f1a] border border-[#1e293b] text-[#94a3b8]">
                      {item.market || "US"}
                    </span>
                  </div>
                  <div className="text-xs text-[#94a3b8] truncate max-w-sm mt-0.5">
                    {item.name}
                  </div>
                </div>
                <span className="text-xs text-[#10b981] opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  Select →
                </span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Quick Picks */}
      {showQuickPicks && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-[11px] font-mono text-[#94a3b8] mr-1">Quick Picks:</span>
          {POPULAR_STOCKS.map((stock) => {
            const isSelected = currentSymbol.toUpperCase() === stock.symbol.toUpperCase();
            return (
              <button
                key={stock.symbol}
                type="button"
                onClick={() => handleSelect(stock.symbol)}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#10b981]/20 border-[#10b981] text-[#10b981] font-semibold"
                    : "bg-[#111827] border-[#1e293b] text-[#94a3b8] hover:text-[#f1f5f9] hover:border-[#334155]"
                }`}
              >
                {stock.symbol}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
