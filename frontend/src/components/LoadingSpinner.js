"use client";

export default function LoadingSpinner({ size = "md", label = "Loading data...", className = "" }) {
  const sizeMap = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-10 h-10 border-3",
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div
        className={`${sizeMap[size] || sizeMap.md} rounded-full border-[#1e293b] border-t-[#10b981] animate-spin mb-3`}
      />
      {label && <p className="text-xs text-[#94a3b8] font-mono tracking-wide">{label}</p>}
    </div>
  );
}
