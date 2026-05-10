"use client";

import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onConnected: () => void;
  onClose: () => void;
  mcpUrl?: string;
}

type Step = "instructions" | "checking" | "connected" | "failed";

export function McpConnectModal({
  open,
  onConnected,
  onClose,
  mcpUrl = "https://mcp.kitstack.co",
}: Props) {
  const [step, setStep] = useState<Step>("instructions");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("instructions");
      setCopied(false);
    }
  }, [open]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckConnection = async () => {
    setStep("checking");

    try {
      // Ping the MCP router's metadata endpoint — if it responds, the server is reachable
      // Then check if the user has an active MCP session by calling our own API
      const res = await fetch("/api/check-mcp-connection");
      const data = await res.json();

      if (data.connected) {
        setStep("connected");
        setTimeout(() => onConnected(), 1500);
      } else {
        setStep("failed");
      }
    } catch {
      setStep("failed");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ks-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-ks-paper border border-ks-hair rounded-2xl shadow-xl w-full max-w-lg p-4 sm:p-6 md:p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ks-muted hover:text-ks-ink text-lg w-8 h-8 flex items-center justify-center"
        >
          &times;
        </button>

        <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2">
          CONNECT TO CLAUDE
        </div>
        <h2 className="font-serif text-[32px] tracking-tight mb-6">
          Add KitStack to Claude
        </h2>

        {/* Step 1: Copy URL */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-serif text-[28px] text-ks-accent italic leading-none">
              01
            </span>
            <span className="font-sans text-[15px] font-medium text-ks-ink">
              Copy the connector URL
            </span>
          </div>
          <div className="flex items-center gap-2 bg-ks-ink rounded-lg px-4 py-3">
            <code className="font-mono text-[13px] text-ks-paper flex-1">
              {mcpUrl}
            </code>
            <button
              onClick={handleCopy}
              className="font-mono text-[11px] text-ks-accent hover:text-ks-accent-deep shrink-0 px-2 py-1 rounded bg-ks-ink2 transition-colors"
            >
              {copied ? "\u2713 COPIED" : "COPY"}
            </button>
          </div>
        </div>

        {/* Step 2: Paste in Claude */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-serif text-[28px] text-ks-accent italic leading-none">
              02
            </span>
            <span className="font-sans text-[15px] font-medium text-ks-ink">
              Paste in Claude
            </span>
          </div>
          <div className="font-sans text-[13px] text-ks-muted leading-relaxed bg-ks-paper-warm rounded-lg p-4">
            Open Claude &rarr; <b className="text-ks-ink">Settings</b> &rarr;{" "}
            <b className="text-ks-ink">Connectors</b> &rarr;{" "}
            <b className="text-ks-ink">Add connector</b> &rarr; paste the URL
            above.
          </div>
        </div>

        {/* Step 3: Sign in */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-serif text-[28px] text-ks-accent italic leading-none">
              03
            </span>
            <span className="font-sans text-[15px] font-medium text-ks-ink">
              Sign in when prompted
            </span>
          </div>
          <div className="font-sans text-[13px] text-ks-muted leading-relaxed bg-ks-paper-warm rounded-lg p-4">
            Claude will open a sign-in window. Use the same account you&apos;re
            logged in with now. Your kits will appear automatically.
          </div>
        </div>

        {/* Action button */}
        {step === "instructions" && (
          <button
            onClick={handleCheckConnection}
            className="ks-btn ks-btn-accent w-full justify-center !py-3.5 !text-[15px]"
          >
            I&apos;ve connected &mdash; verify &rarr;
          </button>
        )}

        {step === "checking" && (
          <div className="flex items-center justify-center gap-3 py-3.5">
            <span className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
            <span className="font-sans text-[14px] text-ks-muted">
              Checking connection...
            </span>
          </div>
        )}

        {step === "connected" && (
          <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full py-3.5">
            <span className="text-emerald-600">&#10003;</span>
            <span className="font-sans text-[14px] text-emerald-800 font-medium">
              Connected! Activating your kit...
            </span>
          </div>
        )}

        {step === "failed" && (
          <div>
            <div className="font-sans text-[13px] text-ks-muted text-center mb-3">
              We couldn&apos;t detect a connection yet. Make sure you&apos;ve
              completed the steps above.
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCheckConnection}
                className="ks-btn flex-1 justify-center !py-3 !text-[13px]"
              >
                Try again
              </button>
              <button
                onClick={() => {
                  // Skip verification — activate anyway
                  onConnected();
                }}
                className="ks-btn flex-1 justify-center !py-3 !text-[13px]"
              >
                Skip &mdash; activate anyway
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
