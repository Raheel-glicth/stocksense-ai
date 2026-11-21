"use client";

export default function ErrorMessage({ title = "Error Encountered", message, onRetry, className = "" }) {
  return (
    <div
      className={`bg-[#111827] border border-[#ef4444]/40 rounded-lg p-5 text-left shadow-lg ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-[#ef4444]/15 text-[#ef4444] flex items-center justify-center shrink-0 text-base font-bold">
          ⚠
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[#ef4444] mb-1 font-mono tracking-wide">
            {title}
          </h4>
          <p className="text-xs text-[#94a3b8] leading-relaxed break-words font-sans">
            {message || "An unexpected error occurred while processing your request."}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-3 py-1.5 rounded bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/40 text-xs font-mono font-medium transition-colors cursor-pointer"
            >
              ↻ Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
