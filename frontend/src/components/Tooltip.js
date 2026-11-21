"use client";

export default function ChartTooltip({ active, payload, label, formatter, title, extra }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-3 shadow-2xl text-xs backdrop-blur-md min-w-[150px] z-50">
      <div className="text-[#94a3b8] font-mono text-[11px] mb-2 border-b border-[#1e293b] pb-1.5 flex justify-between items-center">
        <span>{title || label}</span>
        {extra && <span className="text-[#64748b]">{extra}</span>}
      </div>
      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          let val = item.value;
          if (typeof val === "number") {
            val = val.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            });
          }
          return (
            <div key={idx} className="flex items-center justify-between gap-4 font-mono">
              <span className="flex items-center gap-1.5 text-[#94a3b8] text-[11px]">
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: item.color || item.stroke || item.fill || "#3b82f6" }}
                />
                <span className="truncate max-w-[110px]">{item.name || item.dataKey}:</span>
              </span>
              <span className="font-semibold text-[#f1f5f9] text-[11px]">
                {formatter ? formatter(item.value, item.name, item) : val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
