"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { Avatar } from "@/components/ui/avatar";
import { AuthorCTA } from "@/components/shared/author-cta";

interface McpTool {
  name: string;
  description: string;
}

interface McpApp {
  name: string;
  description: string;
}

interface MyKit {
  kitSlug: string;
  status: "active" | "deactivated" | "archived";
  activatedAt: string | null;
  deactivatedAt: string | null;
  kitName: string | null;
  kitCategory: string | null;
  kitDescription: string | null;
  kitReplaces: string | null;
  kitSavingsPerMonth: number | null;
  kitMcpTools: McpTool[] | null;
  kitMcpApps: McpApp[] | null;
  kitDbSchema: string | null;
}

interface SubscriptionData {
  id: string;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [myKits, setMyKits] = useState<MyKit[]>([]);
  const [kitLimit, setKitLimit] = useState<number | null>(null);
  const [activeKitCount, setActiveKitCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [wishlistItems, setWishlistItems] = useState<{ targetType: string; targetSlug: string; createdAt: string | null }[]>([]);
  const [mcpConnected, setMcpConnected] = useState(true); // default true to avoid flash
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, kitsRes, wishRes, mcpRes] = await Promise.all([
        fetch("/api/subscription"),
        fetch("/api/my-kits"),
        fetch("/api/wishlists"),
        fetch("/api/check-mcp-connection"),
      ]);
      const subData = await subRes.json();
      const kitsData = await kitsRes.json();
      const wishData = await wishRes.json();
      const mcpData = await mcpRes.json();
      setSubscription(subData.subscription ?? null);
      setMyKits(kitsData.kits ?? []);
      setKitLimit(kitsData.limit ?? null);
      setActiveKitCount(kitsData.activeCount ?? 0);
      setWishlistItems(wishData.wishlists ?? []);
      setMcpConnected(mcpData.connected ?? false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace("/login");
    }
    if (session?.user) {
      fetchData();
    }
  }, [isPending, session, router, fetchData]);

  if (isPending || loading) {
    return (
      <div className="bg-ks-paper min-h-screen flex flex-col">
        <Nav />
        <div className="flex items-center justify-center py-32">
          <div className="w-6 h-6 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!session?.user) return null;

  const user = session.user;
  const firstName = user.name?.split(" ")[0] || "there";
  const activeKits = myKits.filter((k) => k.status === "active");
  const deactivatedKits = myKits.filter((k) => k.status === "deactivated");
  const totalSaving = activeKits.reduce((s, k) => s + (k.kitSavingsPerMonth ?? 0), 0);

  return (
    <div className="bg-ks-paper min-h-screen ">
      <Nav />

      {/* TOP SUMMARY */}
      <section className="px-4 sm:px-8 lg:px-16 pt-12 pb-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div className="flex items-center gap-5">
          <Avatar name={user.name || user.email} size={48} tone="#3b7a3b" />
          <div>
            <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-1">
              YOUR SHELF
            </div>
            <h1 className="font-serif text-[28px] sm:text-[36px] lg:text-[44px] leading-none tracking-tight text-ks-ink">
              {getGreeting()}, {firstName}.
            </h1>
            <div className="font-sans text-[15px] text-ks-muted mt-1.5">
              {activeKits.length > 0 ? (
                <>
                  {activeKitCount} of {kitLimit ?? "∞"} kit{kitLimit !== 1 ? "s" : ""} active
                  {totalSaving > 0 && (
                    <>
                      {" "}&middot; saving{" "}
                      <span className="font-semibold text-ks-accent">
                        &euro;{totalSaving}/mo
                      </span>
                    </>
                  )}
                </>
              ) : subscription ? (
                "No kits activated yet — browse kits to get started"
              ) : (
                "Subscribe to activate kits"
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => authClient.signOut().then(() => router.replace("/"))}
            className="ks-btn !py-2.5 !px-4 !text-[13px]"
          >
            Sign out
          </button>
          <Link
            href="/kits"
            className="ks-btn ks-btn-primary !py-2.5 !px-4 !text-[13px]"
          >
            Browse kits &rarr;
          </Link>
        </div>
      </section>

      {/* MCP connection banner */}
      {subscription && !mcpConnected && (
        <div className="mx-4 sm:mx-8 lg:mx-16 mb-2 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <span className="text-amber-600 text-lg leading-none">&#9888;</span>
          <div className="flex-1 min-w-0">
            <span className="font-sans text-[13px] font-semibold text-amber-900">
              MCP connection unavailable
            </span>
            <span className="font-sans text-[13px] text-amber-700 ml-1.5">
              &mdash; your kits won&apos;t respond until the connection is restored. Check your AI assistant&apos;s connector settings.
            </span>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText("https://mcp.kitstack.co")}
            className="shrink-0 font-mono text-[11px] font-medium text-amber-700 hover:text-amber-900 border border-amber-300 rounded-full px-3 py-1.5 transition-colors"
          >
            Copy MCP URL
          </button>
        </div>
      )}

      <section className="px-4 sm:px-8 lg:px-16 pb-16 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* No subscription CTA */}
          {!subscription && (
            <div className="ks-card-ink p-6">
              <h2 className="font-serif text-[28px] tracking-tight mb-2">
                Start with Starter
              </h2>
              <p className="font-sans text-[14px] text-ks-faint mb-4">
                &euro;5/mo for all kits. Each kit gets its own database,
                interactive UI, and memory that survives sessions. Cancel
                anytime.
              </p>
              <button
                onClick={async () => {
                  await fetch("/api/subscription", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ plan: "starter" }),
                  });
                  fetchData();
                }}
                className="ks-btn ks-btn-accent !py-2.5 !px-5 !text-[14px]"
              >
                Subscribe to Starter &mdash; &euro;5/mo
              </button>
            </div>
          )}

          {/* Kit limit indicator */}
          {subscription && kitLimit && (
            <div className="flex items-center justify-between">
              <div className="font-mono text-[11px] text-ks-muted tracking-[1px]">
                ACTIVE KITS
              </div>
              <div className="font-mono text-[11px] text-ks-muted">
                {activeKitCount}/{kitLimit} slots used
                {activeKitCount >= kitLimit && (
                  <span className="text-ks-accent ml-2">
                    Upgrade to Pro for unlimited
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Active kits */}
          {activeKits.map((kit) => {
            const toolCount = kit.kitMcpTools?.length ?? 0;
            const appCount = kit.kitMcpApps?.length ?? 0;
            const schemaCount = kit.kitDbSchema
              ? kit.kitDbSchema.split("\n").filter((l) => l.trim().includes(" (")).length
              : 0;

            return (
              <div key={kit.kitSlug} className="ks-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <CatMark cat={kit.kitCategory || "Revenue"} size={22} />
                    <h3 className="font-serif text-[24px] tracking-tight">
                      {kit.kitName}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-ks-muted">
                    <span className="inline-flex items-center gap-1 text-[#3b7a3b] font-semibold">
                      <span className="text-[8px]">&#9679;</span> Active
                    </span>
                    {kit.kitSavingsPerMonth ? (
                      <span>
                        &middot; saving &euro;{kit.kitSavingsPerMonth}/mo
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "ACTIONS", value: toolCount },
                    { label: "VIEWS", value: appCount },
                    { label: "DATA TYPES", value: schemaCount },
                    { label: "REPLACES", value: kit.kitReplaces?.split(",")[0] || "—", mono: false },
                  ].map((s) => (
                    <div key={s.label} className="bg-ks-paper-warm rounded-lg p-3">
                      <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                        {s.label}
                      </div>
                      <div className={`text-[14px] font-semibold text-ks-ink ${typeof s.value === "number" ? "" : "text-[13px] truncate"}`}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2.5">
                  <Link
                    href={`/kits/${kit.kitSlug}`}
                    className="ks-btn ks-btn-primary !py-2 !px-3.5 !text-[12px]"
                  >
                    Details
                  </Link>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      await fetch("/api/deactivate-kit", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ kitSlug: kit.kitSlug }),
                      });
                      fetchData();
                    }}
                    className="ks-btn !py-2 !px-3.5 !text-[12px] !text-ks-muted hover:!text-red-600 hover:!border-red-200 ml-auto"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            );
          })}

          {/* Deactivated kits */}
          {deactivatedKits.length > 0 && (
            <>
              <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mt-4">
                DEACTIVATED
              </div>
              {deactivatedKits.map((kit) => (
                <div key={kit.kitSlug} className="ks-card p-5 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CatMark cat={kit.kitCategory || "Revenue"} size={22} />
                      <div>
                        <h3 className="font-serif text-[20px] tracking-tight">
                          {kit.kitName}
                        </h3>
                        <div className="font-mono text-[11px] text-ks-faint">
                          Paused &middot; data preserved
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/activate-kit", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ kitSlug: kit.kitSlug }),
                        });
                        if (!res.ok) {
                          const data = await res.json();
                          alert(data.error);
                        }
                        fetchData();
                      }}
                      className="ks-btn !py-2 !px-3.5 !text-[12px]"
                    >
                      Reactivate
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Empty state */}
          {subscription && myKits.length === 0 && (
            <div className="ks-card p-8 text-center">
              <div className="font-serif text-[24px] tracking-tight mb-2">
                No kits activated yet
              </div>
              <p className="font-sans text-[14px] text-ks-muted mb-4">
                You&apos;re subscribed to {subscription.plan}. Browse kits and
                activate the ones you need.
              </p>
              <Link
                href="/kits"
                className="ks-btn ks-btn-accent !py-2.5 !px-5 !text-[13px]"
              >
                Browse kits &rarr;
              </Link>
            </div>
          )}

          {/* Author CTA */}
          <AuthorCTA />
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="flex flex-col gap-5">
          {/* Connector card — only if not yet connected */}
          {subscription && !mcpConnected && (
            <div className="ks-card p-5">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
                CONNECT YOUR AI ASSISTANT
              </div>
              <div className="flex items-center gap-2 bg-ks-ink rounded-lg px-3.5 py-2.5 mb-3">
                <code className="font-mono text-[12px] text-ks-paper flex-1 truncate">
                  mcp.kitstack.co
                </code>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText("https://mcp.kitstack.co")
                  }
                  className="font-mono text-[10px] text-ks-accent hover:text-ks-accent-deep shrink-0"
                >
                  COPY
                </button>
              </div>
              <div className="font-sans text-[12px] text-ks-muted leading-relaxed">
                Paste this URL into your AI assistant&apos;s connector settings.
                Works with Claude, ChatGPT, Gemini, and any app that supports connectors.
              </div>
            </div>
          )}

          {/* Account card */}
          <div className="ks-card p-5">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
              ACCOUNT
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: "Email", value: user.email },
                {
                  label: "Plan",
                  value: subscription
                    ? `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}`
                    : "Free",
                },
                ...(subscription
                  ? [
                    {
                      label: "Status",
                      value: subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1),
                    },
                  ]
                  : []),
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center py-1.5 border-b border-ks-hair last:border-0"
                >
                  <span className="font-sans text-[13px] text-ks-muted">
                    {row.label}
                  </span>
                  <span className="font-sans text-[13px] font-semibold text-ks-ink truncate ml-4 max-w-[180px]">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {subscription && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="mt-3 font-sans text-[12px] text-red-500 hover:text-red-700"
              >
                Cancel subscription
              </button>
            )}
          </div>
          {/* Wishlist */}
          {wishlistItems.length > 0 && (
            <div className="ks-card p-5">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
                WISHLIST &middot; {wishlistItems.length}
              </div>
              <div className="flex flex-col gap-2">
                {wishlistItems.map((item) => {
                  const href = item.targetType === "kit"
                    ? `/kits/${item.targetSlug}`
                    : `/skills/${item.targetSlug}`;
                  const label = item.targetSlug
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <Link
                      key={`${item.targetType}-${item.targetSlug}`}
                      href={href}
                      className="flex items-center justify-between py-2 border-b border-ks-hair last:border-0 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-sans text-[10px] text-ks-muted uppercase tracking-wider shrink-0">
                          {item.targetType}
                        </span>
                        <span className="font-sans text-[13px] text-ks-ink group-hover:text-ks-accent truncate">
                          {label}
                        </span>
                      </div>
                      <span className="text-ks-accent text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        &rarr;
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data ownership — Pro only */}
          {subscription && subscription.plan === "pro" && (
            <div className="bg-ks-paper-warm border border-ks-hair rounded-xl p-4">
              <div className="font-sans text-[12px] text-ks-muted leading-relaxed">
                <span className="font-semibold text-ks-ink">Your data.</span>{" "}
                Your data is private and exportable anytime as JSON or CSV. If
                you cancel, your data stays downloadable for 90 days.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Cancel subscription modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-ks-ink/40 backdrop-blur-sm"
            onClick={() => setShowCancelModal(false)}
          />
          <div className="relative bg-ks-paper border border-ks-hair rounded-2xl shadow-xl w-full max-w-md p-8">
            <h2 className="font-serif text-[28px] tracking-tight mb-3">
              Cancel subscription?
            </h2>
            <p className="font-sans text-[14px] text-ks-muted leading-relaxed mb-2">
              Your kits will stop working at the end of the current billing
              period. Your data stays accessible for 90 days so you can export
              everything.
            </p>
            <div className="flex flex-col gap-2 mb-6 font-sans text-[13px] text-ks-ink2">
              <div className="flex items-center gap-2">
                <span className="text-green-700 text-xs">&#10003;</span>
                Data exportable for 90 days
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-700 text-xs">&#10003;</span>
                Free skills keep working forever
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-700 text-xs">&#10003;</span>
                Re-subscribe anytime to restore access
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowCancelModal(false)}
                className="ks-btn flex-1 justify-center !py-3 !text-[13px]"
              >
                Keep subscription
              </button>
              <button
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  await fetch("/api/subscription", { method: "DELETE" });
                  setShowCancelModal(false);
                  setCancelling(false);
                  fetchData();
                }}
                className="flex-1 font-sans text-[13px] font-medium py-3 px-4 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
