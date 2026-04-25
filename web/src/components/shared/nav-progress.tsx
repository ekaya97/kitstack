"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    // When pathname changes, the navigation is done
    setLoading(false);
    setProgress(100);
    const t = setTimeout(() => setProgress(0), 300);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) return;
      // Same page link — skip
      if (href === pathname) return;

      setLoading(true);
      setProgress(15);
      clearInterval(timer.current);
      timer.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) {
            clearInterval(timer.current);
            return 90;
          }
          return p + (90 - p) * 0.1;
        });
      }, 100);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      clearInterval(timer.current);
    };
  }, [pathname]);

  if (!loading && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2.5px]">
      <div
        className="h-full bg-ks-accent transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
