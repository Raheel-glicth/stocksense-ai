"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: "📊" },
  { href: "/explorer", label: "Explorer", icon: "🔍" },
  { href: "/analysis", label: "Analysis", icon: "📈" },
  { href: "/predictions", label: "Predictions", icon: "🔮" },
  { href: "/models", label: "Models", icon: "🤖" },
  { href: "/backtest", label: "Backtest", icon: "⏪" },
  { href: "/explainability", label: "Explainability", icon: "💡" },
  { href: "/research", label: "Research", icon: "📑" },
  { href: "/health", label: "Health", icon: "🩺" },
];

export default function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#111827] border-b border-[#1e293b] px-4 flex items-center justify-between z-40">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold text-sm">
            ⚡
          </div>
          <span className="font-mono font-bold text-base tracking-wider text-[#f1f5f9]">
            StockSense<span className="text-[#10b981]"> AI</span>
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-[#94a3b8] hover:text-[#f1f5f9] rounded-md border border-[#1e293b] bg-[#0a0f1a] focus:outline-none"
          aria-label="Toggle menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop fixed w-64, Mobile slide-over) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-[#111827] border-r border-[#1e293b] flex flex-col z-50 transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand / Logo */}
        <div className="p-5 border-b border-[#1e293b] flex items-center justify-between">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-md bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center text-[#10b981] font-bold text-base shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              ⚡
            </div>
            <div>
              <div className="font-mono font-bold text-base tracking-wide text-[#f1f5f9] group-hover:text-white transition-colors">
                StockSense <span className="text-[#10b981]">AI</span>
              </div>
              <div className="text-[10px] font-mono text-[#94a3b8] tracking-widest uppercase">
                Quantitative ML
              </div>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-[#94a3b8] hover:text-[#f1f5f9] p-1"
          >
            ✕
          </button>
        </div>

        {/* Live Terminal Status Tag */}
        <div className="px-4 py-2.5 bg-[#0a0f1a]/60 border-b border-[#1e293b]/60 flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#94a3b8] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            ENGINE
          </span>
          <span className="text-[#10b981] font-semibold">ONLINE</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-r-md text-xs font-mono transition-all duration-150 ${
                  isActive
                    ? "border-l-4 border-[#10b981] bg-[#1e293b]/70 text-[#10b981] font-semibold shadow-inner"
                    : "border-l-4 border-transparent text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e293b]/30"
                }`}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                <span className="tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* System Info & Footer */}
        <div className="p-4 border-t border-[#1e293b] bg-[#0a0f1a]/40 text-[11px] font-mono text-[#94a3b8] space-y-2">
          <div className="flex justify-between items-center text-[10px]">
            <span>MODELS:</span>
            <span className="text-[#f1f5f9]">XGB, RF, LR, LSTM</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span>API:</span>
            <span className="text-[#10b981]">FASTAPI 8000</span>
          </div>
          <div className="pt-2 border-t border-[#1e293b]/60 text-[10px] text-center text-[#64748b] leading-tight">
            Educational Project
          </div>
        </div>
      </aside>
    </>
  );
}
