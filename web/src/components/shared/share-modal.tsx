"use client";

import { useState } from "react";

export function ShareButton({
  title,
  slug,
  type,
}: {
  title: string;
  slug: string;
  type: "skill" | "kit";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/${type === "skill" ? "skills" : "kits"}/${slug}`
      : "";

  const shareText = `Check out ${title} on KitStack`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-sans text-xs text-ks-muted hover:text-ks-ink cursor-pointer"
      >
        &#8599; Share
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-ks-paper rounded-xl border border-ks-hair shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-xl">Share</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-ks-muted hover:text-ks-ink text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Copy link */}
            <div className="flex gap-2 mb-5">
              <input
                readOnly
                value={url}
                className="flex-1 font-mono text-[12px] bg-white border border-ks-hair rounded-lg px-3 py-2.5 outline-none text-ks-ink"
              />
              <button
                onClick={copy}
                className={`ks-btn !py-2 !px-4 !text-[13px] ${
                  copied ? "!border-green-600 !text-green-700" : "ks-btn-primary"
                }`}
              >
                {copied ? "\u2713 Copied" : "Copy"}
              </button>
            </div>

            {/* Social buttons */}
            <div className="flex gap-3">
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ks-btn !py-2.5 !px-4 !text-[13px] flex-1 justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Post
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ks-btn !py-2.5 !px-4 !text-[13px] flex-1 justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`}
                className="ks-btn !py-2.5 !px-4 !text-[13px] flex-1 justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
                </svg>
                Email
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
