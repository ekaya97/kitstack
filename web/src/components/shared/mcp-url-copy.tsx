"use client";

import { useState } from "react";

const MCP_URL = "https://mcp.kitstack.co";

export function McpUrlCopy({ display }: { display?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 bg-ks-ink rounded-lg px-4 py-3">
      <code className="font-mono text-[13px] text-ks-paper flex-1">
        {display || MCP_URL}
      </code>
      <button
        onClick={handleCopy}
        className="font-mono text-[11px] text-ks-accent hover:text-ks-accent-deep shrink-0 transition-colors"
      >
        {copied ? "\u2713 COPIED" : "COPY"}
      </button>
    </div>
  );
}
