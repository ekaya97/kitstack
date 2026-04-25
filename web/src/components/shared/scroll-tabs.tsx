"use client";

import { useState, useEffect } from "react";

interface Tab {
  id: string;
  label: string;
}

export function ScrollTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const tab of tabs) {
      const el = document.getElementById(tab.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [tabs]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="sticky top-0 z-20 bg-ks-paper border-b border-ks-hair">
      <div className="px-4 sm:px-8 md:px-16 flex gap-1.5 py-3 overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => scrollTo(tab.id)}
            className={`font-sans text-[12px] sm:text-[13px] font-medium px-3 py-1.5 sm:px-4 sm:py-2 rounded-full cursor-pointer transition-colors whitespace-nowrap ${
              active === tab.id
                ? "bg-ks-ink text-ks-paper"
                : "text-ks-muted hover:bg-ks-paper-warm"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
