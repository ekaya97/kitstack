"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { McpConnectModal } from "./mcp-connect-modal";
import { WishlistButton } from "./wishlist-button";
import { ShareButton } from "./share-modal";
import { useSubscription, useSubscribe } from "@/hooks/use-subscription";
import { useMyKits, useActivateKit } from "@/hooks/use-my-kits";

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
  | "deactivated"
  | "connecting"
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
  const { data: subData, isLoading: subLoading } = useSubscription();
  const { data: kitsData, isLoading: kitsLoading } = useMyKits();
  const subscribeMut = useSubscribe();
  const activateMut = useActivateKit();

  const [showConnect, setShowConnect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Manual override state for post-mutation transitions
  const [overrideState, setOverrideState] = useState<ActivationState | null>(null);

  const derivedState: ActivationState = useMemo(() => {
    if (overrideState) return overrideState;
    if (sessionPending || subLoading || kitsLoading) return "loading";
    if (!session?.user) return "not-logged-in";
    if (!subData?.subscription) return "no-subscription";

    const kit = kitsData?.kits?.find((k) => k.kitSlug === kitSlug);
    if (kit?.status === "active") return "active";
    if (kit?.status === "deactivated") return "deactivated";
    return "not-activated";
  }, [sessionPending, subLoading, kitsLoading, session, subData, kitsData, kitSlug, overrideState]);

  const handleStartActivation = () => {
    setError(null);
    setOverrideState("connecting");
    setShowConnect(true);
  };

  const handleSubscribeAndConnect = () => {
    setError(null);
    subscribeMut.mutate("starter", {
      onSuccess: () => {
        setOverrideState("connecting");
        setShowConnect(true);
      },
      onError: () => setError("Failed to subscribe"),
    });
  };

  const handleMcpConnected = () => {
    setOverrideState("activating");
    setError(null);
    setShowConnect(false);

    activateMut.mutate(kitSlug, {
      onSuccess: () => setOverrideState("active"),
      onError: (err) => {
        setError(err.message || "Activation failed");
        setOverrideState(null);
      },
    });
  };

  const state = derivedState;

  return (
    <>
      <McpConnectModal
        open={showConnect}
        onConnected={handleMcpConnected}
        onClose={() => {
          setShowConnect(false);
          setOverrideState(null);
        }}
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
            disabled={subscribeMut.isPending}
            className="ks-btn ks-btn-accent w-full justify-center !py-3.5 !text-[15px] mb-2.5"
          >
            {subscribeMut.isPending ? "Subscribing..." : "Subscribe & activate →"}
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

        {state === "deactivated" && (
          <>
            <div className="flex items-center gap-2 bg-ks-paper-warm border border-ks-hair rounded-full px-4 py-2.5 mb-2.5">
              <span className="text-ks-muted text-sm">&#9724;</span>
              <span className="font-sans text-[13px] text-ks-muted">
                Paused &mdash; data preserved
              </span>
            </div>
            <button
              onClick={handleStartActivation}
              className="ks-btn ks-btn-accent w-full justify-center !py-3.5 !text-[15px] mb-2.5"
            >
              Reactivate {kitName} &rarr;
            </button>
          </>
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
            <a
              href={`https://claude.ai/new?q=${encodeURIComponent(`Load my ${kitName} and show me what's inside.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ks-btn ks-btn-primary w-full justify-center !py-3 !text-[13px] mb-2.5"
            >
              Open in Claude &nearr;
            </a>
          </>
        )}

        {error && (
          <div className="font-sans text-[12px] text-red-600 mb-3">
            {error}
          </div>
        )}

        {/* Action row */}
        <div className="flex justify-between border-t border-ks-hair pt-4 mb-5">
          <WishlistButton targetType="kit" targetSlug={kitSlug} />
          <ShareButton type="kit" slug={kitSlug} title={kitName} />
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
