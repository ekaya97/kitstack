"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { McpConnectModal } from "./mcp-connect-modal";

interface Props {
  kitSlug: string;
  kitName: string;
  toolCount: number;
  uiCount: number;
  schemaCount: number;
  linkedSkillSlug?: string | null;
}

type ActivationState =
  | "loading"
  | "not-logged-in"
  | "no-subscription"
  | "not-activated"
  | "connecting"    // showing MCP connect modal
  | "activating"
  | "active";

export function KitActivateCard({
  kitSlug,
  kitName,
  toolCount,
  uiCount,
  schemaCount,
  linkedSkillSlug,
}: Props) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [state, setState] = useState<ActivationState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionPending) return;

    if (!session?.user) {
      setState("not-logged-in");
      return;
    }

    Promise.all([
      fetch("/api/subscription").then((r) => r.json()),
      fetch("/api/my-kits").then((r) => r.json()),
    ]).then(([subData, kitsData]) => {
      if (!subData.subscription) {
        setState("no-subscription");
        return;
      }
      const isActive = kitsData.kits?.some(
        (k: { kitSlug: string }) => k.kitSlug === kitSlug
      );
      setState(isActive ? "active" : "not-activated");
    });
  }, [session, sessionPending, kitSlug]);

  // Step 1: Subscribe (if needed), then show MCP connect modal
  const handleStartActivation = async () => {
    setError(null);
    setState("connecting");
  };

  const handleSubscribeAndConnect = async () => {
    setError(null);

    try {
      const subRes = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "starter" }),
      });

      if (!subRes.ok) {
        setError("Failed to subscribe");
        return;
      }

      setState("connecting");
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  // Step 2: After MCP connection verified, activate the kit
  const handleMcpConnected = async () => {
    setState("activating");
    setError(null);

    try {
      const res = await fetch("/api/activate-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitSlug }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Activation failed");
        setState("not-activated");
        return;
      }

      setState("active");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("not-activated");
    }
  };

  return (
    <>
      <McpConnectModal
        open={state === "connecting"}
        onConnected={handleMcpConnected}
        onClose={() => setState("not-activated")}
      />

      <div className="ks-card p-6 sticky top-8">
        <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2">
          SUBSCRIPTION KIT
        </div>
        <div className="font-serif text-[44px] text-ks-ink italic leading-none mb-1">
          &euro;5<span className="text-lg">/mo</span>
        </div>
        <div className="font-sans text-[13px] text-ks-muted mb-5">
          Starter plan &middot; unlocks every kit
        </div>

        {/* CTA based on state */}
        {state === "loading" && (
          <div className="h-[52px] bg-ks-paper-warm rounded-full animate-pulse mb-2.5" />
        )}

        {state === "not-logged-in" && (
          <Link
            href={`/login?redirect=/kits/${kitSlug}`}
            className="ks-btn ks-btn-accent w-full justify-center !py-3.5 !text-[15px] mb-2.5"
          >
            Sign up to activate &rarr;
          </Link>
        )}

        {state === "no-subscription" && (
          <button
            onClick={handleSubscribeAndConnect}
            className="ks-btn ks-btn-accent w-full justify-center !py-3.5 !text-[15px] mb-2.5"
          >
            Subscribe &amp; activate &rarr;
          </button>
        )}

        {state === "not-activated" && (
          <button
            onClick={handleStartActivation}
            className="ks-btn ks-btn-accent w-full justify-center !py-3.5 !text-[15px] mb-2.5"
          >
            Activate {kitName} &rarr;
          </button>
        )}

        {state === "activating" && (
          <button
            disabled
            className="ks-btn w-full justify-center !py-3.5 !text-[15px] mb-2.5 opacity-60 cursor-wait"
          >
            <span className="inline-block w-4 h-4 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin mr-2" />
            Activating...
          </button>
        )}

        {state === "active" && (
          <>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-3 mb-2.5">
              <span className="text-emerald-600 text-sm">&#10003;</span>
              <span className="font-sans text-[14px] text-emerald-800 font-medium">
                Active &mdash; ready in Claude
              </span>
            </div>
            <Link
              href="/dashboard"
              className="ks-btn w-full justify-center !py-3 !text-[13px] mb-2.5"
            >
              Go to dashboard
            </Link>
          </>
        )}

        {state === "connecting" ? null : error ? (
          <div className="font-sans text-[12px] text-red-600 mb-3">
            {error}
          </div>
        ) : null}

        {/* Action row */}
        <div className="flex justify-between border-t border-ks-hair pt-4 mb-5">
          <button className="font-sans text-xs text-ks-muted hover:text-ks-ink cursor-pointer">
            &#9825; Wishlist
          </button>
          <button className="font-sans text-xs text-ks-muted hover:text-ks-ink cursor-pointer">
            &#8599; Share
          </button>
        </div>

        {/* Features checklist */}
        <div className="border-t border-ks-hair pt-4 flex flex-col gap-2">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
            INCLUDES
          </div>
          {[
            "Your own private database",
            `${toolCount} built-in actions`,
            `${uiCount} interactive views`,
            `${schemaCount} data types`,
            "Data export anytime",
            "EU-hosted, your data stays private",
          ].map((f) => (
            <div
              key={f}
              className="font-sans text-[13px] text-ks-ink flex items-center gap-2"
            >
              <span className="text-green-700 text-xs">&#10003;</span>
              {f}
            </div>
          ))}
        </div>

        {/* Link to free skill */}
        {linkedSkillSlug && (
          <div className="mt-5 pt-4 border-t border-ks-hair">
            <Link
              href={`/skills/${linkedSkillSlug}`}
              className="font-sans text-[13px] text-ks-accent hover:underline"
            >
              Want just the basics? Try the free skill &rarr;
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
