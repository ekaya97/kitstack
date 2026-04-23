"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { Avatar } from "@/components/ui/avatar";

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
  activatedAt: string | null;
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
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, kitsRes] = await Promise.all([
        fetch("/api/subscription"),
        fetch("/api/my-kits"),
      ]);
      const subData = await subRes.json();
      const kitsData = await kitsRes.json();
      setSubscription(subData.subscription ?? null);
      setMyKits(kitsData.kits ?? []);
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
      <div className="bg-ks-paper min-h-screen">
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
  const totalSaving = myKits.reduce((s, k) => s + (k.kitSavingsPerMonth ?? 0), 0);

  return (
    <div className="bg-ks-paper min-h-screen">
      <Nav />

      {/* TOP SUMMARY */}
      <section className="px-16 pt-12 pb-8 flex items-end justify-between">
        <div className="flex items-center gap-5">
          <Avatar name={user.name || user.email} size={48} tone="#3b7a3b" />
          <div>
            <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-1">
              YOUR SHELF
            </div>
            <h1 className="font-serif text-[44px] leading-none tracking-tight text-ks-ink">
              {getGreeting()}, {firstName}.
            </h1>
            <div className="font-sans text-[15px] text-ks-muted mt-1.5">
              {myKits.length > 0 ? (
                <>
                  {myKits.length} kit{myKits.length !== 1 ? "s" : ""} active
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

      <section className="px-16 pb-16 grid grid-cols-[2fr_1fr] gap-6 items-start">
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

          {/* Active kits */}
          {myKits.length > 0 && (
            <>
              <div className="font-mono text-[11px] text-ks-muted tracking-[1px]">
                ACTIVE KITS
              </div>
              {myKits.map((kit) => {
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

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-ks-paper-warm rounded-lg p-3">
                        <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                          ACTIONS
                        </div>
                        <div className="font-sans text-[14px] font-semibold text-ks-ink">
                          {toolCount}
                        </div>
                      </div>
                      <div className="bg-ks-paper-warm rounded-lg p-3">
                        <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                          VIEWS
                        </div>
                        <div className="font-sans text-[14px] font-semibold text-ks-ink">
                          {appCount}
                        </div>
                      </div>
                      <div className="bg-ks-paper-warm rounded-lg p-3">
                        <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                          DATA TYPES
                        </div>
                        <div className="font-sans text-[14px] font-semibold text-ks-ink">
                          {schemaCount}
                        </div>
                      </div>
                      <div className="bg-ks-paper-warm rounded-lg p-3">
                        <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                          REPLACES
                        </div>
                        <div className="font-sans text-[13px] font-medium text-ks-ink truncate">
                          {kit.kitReplaces?.split(",")[0] || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <Link
                        href={`/kits/${kit.kitSlug}`}
                        className="ks-btn ks-btn-primary !py-2 !px-3.5 !text-[12px]"
                      >
                        View kit details
                      </Link>
                      <button className="ks-btn !py-2 !px-3.5 !text-[12px]">
                        Open in Claude
                      </button>
                    </div>
                  </div>
                );
              }
              ))}
            </>
          )}

          {/* Empty state with subscription */}
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
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="flex flex-col gap-5">
          {/* Connector card */}
          {subscription && (
            <div className="ks-card p-5">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
                YOUR CONNECTION URL
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
                Paste this URL into Claude &rarr; Settings &rarr; Connectors.
                All your active kits appear automatically.
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
                onClick={async () => {
                  if (confirm("Cancel your subscription? Your data stays accessible for 30 days.")) {
                    await fetch("/api/subscription", { method: "DELETE" });
                    fetchData();
                  }
                }}
                className="mt-3 font-sans text-[12px] text-red-500 hover:text-red-700"
              >
                Cancel subscription
              </button>
            )}
          </div>

          {/* Data ownership */}
          <div className="bg-ks-paper-warm border border-ks-hair rounded-xl p-4">
            <div className="font-sans text-[12px] text-ks-muted leading-relaxed">
              <span className="font-semibold text-ks-ink">Your data.</span>{" "}
              Your data is private and exportable anytime as JSON or CSV. If
              you cancel, your data stays downloadable for 90 days.
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
