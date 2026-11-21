"use client";

export default function Badge({ variant = "neutral", children, size = "md", className = "" }) {
  const normalized = (typeof children === "string" ? children : variant || "neutral").toLowerCase();

  let colorClasses = "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30";
  let dotColor = "bg-[#3b82f6]";

  if (normalized.includes("bull") || normalized.includes("buy") || normalized.includes("positive") || normalized.includes("healthy") || normalized.includes("up")) {
    colorClasses = "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30";
    dotColor = "bg-[#10b981]";
  } else if (normalized.includes("bear") || normalized.includes("sell") || normalized.includes("negative") || normalized.includes("down") || normalized.includes("error")) {
    colorClasses = "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30";
    dotColor = "bg-[#ef4444]";
  } else if (normalized.includes("warn") || normalized.includes("volatil") || normalized.includes("oversold") || normalized.includes("overbought")) {
    colorClasses = "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30";
    dotColor = "bg-[#f59e0b]";
  } else if (normalized.includes("side") || normalized.includes("neutral") || normalized.includes("hold")) {
    colorClasses = "bg-[#64748b]/15 text-[#94a3b8] border-[#64748b]/30";
    dotColor = "bg-[#94a3b8]";
  }

  const sizeClasses = size === "sm" 
    ? "text-[10px] px-2 py-0.5" 
    : size === "lg" 
    ? "text-xs px-3 py-1 font-semibold" 
    : "text-xs px-2.5 py-0.5 font-medium";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border uppercase tracking-wider font-mono ${colorClasses} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{children}</span>
    </span>
  );
}
