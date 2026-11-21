"use client";

export default function MetricCard({
  label,
  value,
  change,
  changePct,
  subtitle,
  icon,
  trend, // "up", "down", "neutral"
  tooltip,
  className = "",
}) {
  const isPositive = trend === "up" || (change && Number(change) > 0) || (changePct && Number(changePct) > 0);
  const isNegative = trend === "down" || (change && Number(change) < 0) || (changePct && Number(changePct) < 0);

  let changeColor = "text-[#94a3b8]";
  let arrow = "";
  if (isPositive) {
    changeColor = "text-[#10b981]";
    arrow = "▲";
  } else if (isNegative) {
    changeColor = "text-[#ef4444]";
    arrow = "▼";
  }

  return (
    <div
      className={`bg-[#111827] border border-[#1e293b] rounded-lg p-4 hover:border-[#334155] transition-colors relative group ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono uppercase tracking-wider text-[#94a3b8]">
          {label}
        </span>
        {icon && <span className="text-sm opacity-80">{icon}</span>}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xl sm:text-2xl font-bold font-mono text-[#f1f5f9] tracking-tight truncate">
          {value !== undefined && value !== null ? value : "—"}
        </div>
      </div>

      {(change !== undefined || changePct !== undefined || subtitle) && (
        <div className="flex items-center gap-2 mt-2 text-xs font-mono">
          {(change !== undefined || changePct !== undefined) && (
            <span className={`flex items-center gap-1 font-medium ${changeColor}`}>
              <span>{arrow}</span>
              {change !== undefined && <span>{change > 0 ? `+${change}` : change}</span>}
              {changePct !== undefined && (
                <span>({changePct > 0 ? `+${changePct}%` : `${changePct}%`})</span>
              )}
            </span>
          )}
          {subtitle && <span className="text-[#94a3b8] text-[11px] truncate">{subtitle}</span>}
        </div>
      )}

      {tooltip && (
        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-[#0a0f1a] border border-[#1e293b] p-2 rounded text-[11px] text-[#94a3b8] z-30 shadow-xl pointer-events-none">
          {tooltip}
        </div>
      )}
    </div>
  );
}
