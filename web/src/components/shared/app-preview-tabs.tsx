"use client";

import { useState } from "react";

interface AppPreviewView {
  name: string;
  previewUrl: string;
}

export function AppPreviewTabs({ views }: { views: AppPreviewView[] }) {
  const [active, setActive] = useState(0);

  if (!views || views.length === 0) return null;

  return (
    <div>
      {/* View tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {views.map((view, i) => (
          <button
            key={view.name}
            onClick={() => setActive(i)}
            className={`font-sans text-[13px] font-medium px-4 py-2 rounded-full cursor-pointer transition-colors shrink-0 whitespace-nowrap ${
              active === i
                ? "bg-ks-ink text-ks-paper"
                : "text-ks-muted hover:bg-ks-paper-warm border border-ks-hair"
            }`}
          >
            {view.name}
          </button>
        ))}
      </div>

      {/* Iframe preview */}
      <div className="ks-card overflow-hidden rounded-xl border-2 border-ks-hair">
        <div className="bg-ks-paper-deep px-4 py-2 flex items-center gap-2 border-b border-ks-hair">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e06b4a]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#f4c95f]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#6bb56b]" />
          <span className="ml-3 font-mono text-[11px] text-ks-muted">
            {views[active].name}
          </span>
          <span className="ml-auto font-mono text-[10px] text-ks-faint">
            live preview with sample data
          </span>
        </div>
        <iframe
          key={views[active].previewUrl}
          src={views[active].previewUrl}
          className="w-full border-0 bg-white min-h-[280px] sm:min-h-[380px] md:min-h-[480px]"
          title={views[active].name}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}
