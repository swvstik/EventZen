import React from "react";

// Simple retro loader: animated dots with a retro font and color
export function Loader({ className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`} data-testid="retro-loader">
      <div className="flex gap-1 mb-2">
        <span className="w-2 h-2 bg-neo-black rounded-full animate-bounce [animation-delay:0ms]"></span>
        <span className="w-2 h-2 bg-neo-black rounded-full animate-bounce [animation-delay:150ms]"></span>
        <span className="w-2 h-2 bg-neo-black rounded-full animate-bounce [animation-delay:300ms]"></span>
      </div>
      <span className="font-mono text-xs text-neo-black tracking-widest uppercase">Loading...</span>
    </div>
  );
}
