"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Nav } from "@/components/shared/nav";
import { CatMark } from "@/components/ui/cat-mark";
import { Avatar } from "@/components/ui/avatar";
import { AuthorCTA } from "@/components/shared/author-cta";
import { McpUrlCopy } from "@/components/shared/mcp-url-copy";
import {
  useSubscription,
  useSubscribe,
  useCancelSubscription,
} from "@/hooks/use-subscription";
import {
  useMyKits,
  useActivateKit,
  useDeactivateKit,
  useDeleteKit,
} from "@/hooks/use-my-kits";
import { useMcpConnection } from "@/hooks/use-mcp-connection";
import { useWishlists, useToggleWishlist } from "@/hooks/use-wishlists";

type Tab = "kits" | "developer" | "downloads" | "wishlist" | "billing" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "kits", label: "My Kits" },
  { key: "developer", label: "Developer" },
  { key: "downloads", label: "Downloads" },
  { key: "wishlist", label: "Wishlist" },
  { key: "billing", label: "Billing" },
  { key: "settings", label: "Settings" },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();

  const initialTab = (searchParams.get("tab") as Tab) || "kits";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const { data: mcpData } = useMcpConnection();
  const mcpConnected = mcpData?.connected ?? false;

  useEffect(() => {
    fetch("/api/admin/me").then((r) => {
      if (r.ok) setIsAdmin(true);
    });
  }, []);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    const url = tab === "kits" ? "/dashboard" : `/dashboard?tab=${tab}`;
    window.history.replaceState(null, "", url);
  }

  if (isPending) {
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

  return (
    <div className="bg-ks-paper h-screen flex flex-col overflow-hidden">
      <Nav />

      {/* Header */}
      <section className="shrink-0 ">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 pb-5 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              name={user.name || user.email}
              src={user.image || undefined}
              size={40}
              tone="#3b7a3b"
            />
            <div>
              <div className="font-mono text-[10px] text-ks-muted tracking-[1px] mb-0.5">
                YOUR SHELF
              </div>
              <h1 className="font-serif text-[24px] sm:text-[30px] leading-none tracking-tight text-ks-ink">
                {getGreeting()}, {firstName}.
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="ks-btn !py-2 !px-3.5 !text-[12px] !border-ks-accent !text-ks-accent"
              >
                Admin
              </Link>
            )}
            <button
              onClick={() => setShowConnectModal(true)}
              className="ks-btn !py-2 !px-3.5 !text-[12px] !gap-1.5"
            >
              <span className={`inline-block w-2 h-2 rounded-full ${mcpConnected ? "bg-green-500" : "bg-ks-hair"}`} />
              Connect
            </button>
            <Link
              href="/kits"
              className="ks-btn ks-btn-primary !py-2 !px-3.5 !text-[12px]"
            >
              Browse kits &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Sidebar + content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 flex gap-10 flex-1 min-h-0 w-full">
        {/* Sidebar */}
        <aside className="w-44 shrink-0">
          {/* Nav tabs */}
          <nav className="flex flex-col gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`text-left px-3 py-1.5 rounded-lg font-sans text-[13px] transition-colors cursor-pointer ${activeTab === tab.key
                  ? "text-ks-ink font-semibold"
                  : "text-ks-muted hover:text-ks-ink"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {activeTab === "kits" && <MyKitsTab />}
          {activeTab === "developer" && <DeveloperTab />}
          {activeTab === "downloads" && <DownloadsTab />}
          {activeTab === "wishlist" && <WishlistTab />}
          {activeTab === "billing" && <BillingTab />}
          {activeTab === "settings" && <SettingsTab user={user} onSignOut={() => authClient.signOut().then(() => router.replace("/"))} />}
        </main>
      </div>

      {/* Connect modal */}
      {showConnectModal && (
        <Modal onClose={() => setShowConnectModal(false)}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-[24px] tracking-tight">
              Connect your AI assistant
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium ${mcpConnected ? "text-green-700" : "text-ks-muted"}`}
            >
              <span className={`w-2 h-2 rounded-full ${mcpConnected ? "bg-green-500" : "bg-ks-hair"}`} />
              {mcpConnected ? "Connected" : "Not connected"}
            </span>
          </div>

          <p className="font-sans text-[13px] text-ks-muted leading-relaxed mb-4">
            Copy the URL below and paste it into your AI assistant&apos;s MCP connector settings.
          </p>

          <div className="mb-3">
            <McpUrlCopy />
          </div>

          <div className="font-sans text-[12px] text-ks-muted leading-relaxed space-y-2">
            <p><span className="font-semibold text-ks-ink">Claude.ai</span> &mdash; Settings &rarr; Connectors &rarr; Add MCP &rarr; paste URL</p>
            <p><span className="font-semibold text-ks-ink">Claude Desktop</span> &mdash; Settings &rarr; Developer &rarr; Add MCP Server</p>
            <p><span className="font-semibold text-ks-ink">Other apps</span> &mdash; Look for MCP or connector settings and paste the URL</p>
          </div>

          <button
            onClick={() => setShowConnectModal(false)}
            className="ks-btn ks-btn-primary !py-2.5 !px-5 !text-[13px] mt-5 w-full justify-center"
          >
            Done
          </button>
        </Modal>
      )}

      <footer className="shrink-0 px-4 sm:px-8 lg:px-16 py-3 border-t border-ks-hair flex items-center justify-between font-mono text-[11px] text-ks-muted">
        <span>&copy; 2026 kitstack</span>
        <div className="flex gap-4">
          <a href="/legal/privacy" className="hover:text-ks-ink">Privacy</a>
          <a href="/legal/terms" className="hover:text-ks-ink">Terms</a>
          <a href="mailto:hello@kitstack.co" className="hover:text-ks-ink">Support</a>
        </div>
      </footer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// My Kits
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MyKitsTab() {
  const { data: subData, isLoading: subLoading } = useSubscription();
  const { data: kitsData, isLoading: kitsLoading } = useMyKits();
  const { data: mcpData } = useMcpConnection();
  const subscribe = useSubscribe();
  const deactivateKit = useDeactivateKit();
  const activateKit = useActivateKit();
  const deleteKitMut = useDeleteKit();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (subLoading || kitsLoading) return <Spinner />;

  const subscription = subData?.subscription ?? null;
  const myKits = kitsData?.kits ?? [];
  const kitLimit = kitsData?.limit ?? null;
  const activeKitCount = kitsData?.activeCount ?? 0;
  const mcpConnected = mcpData?.connected ?? true;
  const activeKits = myKits.filter((k) => k.status === "active");
  const deactivatedKits = myKits.filter((k) => k.status === "deactivated");
  const totalSaving = activeKits.reduce(
    (s, k) => s + (k.kitSavingsPerMonth ?? 0),
    0,
  );

  return (
    <div className="max-w-3xl">
      {/* MCP connection banner */}
      {subscription && !mcpConnected && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <span className="text-amber-600 text-lg leading-none">&#9888;</span>
          <div className="flex-1 min-w-0">
            <span className="font-sans text-[13px] font-semibold text-amber-900">
              MCP connection unavailable
            </span>
            <span className="font-sans text-[13px] text-amber-700 ml-1.5">
              &mdash; check your AI assistant&apos;s connector settings.
            </span>
          </div>
          <CopyMcpButton />
        </div>
      )}

      {/* No subscription */}
      {!subscription && (
        <div className="ks-card-ink p-6 mb-6">
          <h2 className="font-serif text-[28px] tracking-tight mb-2">
            Start with Starter
          </h2>
          <p className="font-sans text-[14px] text-ks-faint mb-4">
            &euro;5/mo for all kits. Each kit gets its own database, interactive
            UI, and memory that survives sessions. Cancel anytime.
          </p>
          <button
            onClick={() => subscribe.mutate("starter")}
            disabled={subscribe.isPending}
            className="ks-btn ks-btn-accent !py-2.5 !px-5 !text-[14px]"
          >
            Subscribe to Starter &mdash; &euro;5/mo
          </button>
        </div>
      )}

      {/* Summary bar */}
      {subscription && (
        <div className="flex items-center justify-between mb-5">
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px]">
            ACTIVE KITS
          </div>
          <div className="font-mono text-[11px] text-ks-muted">
            {activeKitCount}/{kitLimit ?? "∞"} slots
            {totalSaving > 0 && (
              <span className="ml-2 text-ks-accent font-semibold">
                saving &euro;{totalSaving}/mo
              </span>
            )}
          </div>
        </div>
      )}

      {/* Active kits */}
      <div className="flex flex-col gap-4">
        {activeKits.map((kit) => {
          const toolCount = kit.kitMcpTools?.length ?? 0;
          const appCount = kit.kitMcpApps?.length ?? 0;
          const schemaCount = kit.kitDbSchema
            ? kit.kitDbSchema
              .split("\n")
              .filter((l) => l.trim().includes(" (")).length
            : 0;

          return (
            <div key={kit.kitSlug} className="ks-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <CatMark cat={kit.kitCategory || "Revenue"} size={22} />
                  <h3 className="font-serif text-[22px] tracking-tight">
                    {kit.kitName}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#3b7a3b] font-semibold">
                  <span className="text-[8px]">&#9679;</span> Active
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "ACTIONS", value: toolCount },
                  { label: "VIEWS", value: appCount },
                  { label: "DATA TYPES", value: schemaCount },
                  {
                    label: "REPLACES",
                    value: kit.kitReplaces?.split(",")[0] || "—",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-ks-paper-warm rounded-lg p-3"
                  >
                    <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                      {s.label}
                    </div>
                    <div
                      className={`text-[14px] font-semibold text-ks-ink ${typeof s.value !== "number" ? "text-[13px] truncate" : ""}`}
                    >
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
                  onClick={() => deactivateKit.mutate(kit.kitSlug)}
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
            <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mt-2">
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => activateKit.mutate(kit.kitSlug)}
                      className="ks-btn hover:ks-btn-accent !py-2 !px-3.5 !text-[12px]"
                    >
                      Reactivate
                    </button>
                    <button
                      onClick={() => setDeleteTarget(kit.kitSlug)}
                      className="ks-btn !py-2 !px-3.5 !text-[12px] !text-ks-muted hover:!text-red-600 hover:!border-red-200"
                    >
                      Delete
                    </button>
                  </div>
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
              Browse kits and activate the ones you need.
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

      {/* Delete kit modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h2 className="font-serif text-[28px] tracking-tight mb-3">
            Delete kit permanently?
          </h2>
          <p className="font-sans text-[14px] text-ks-muted leading-relaxed mb-6">
            This will permanently destroy the database and all data for{" "}
            <span className="font-semibold text-ks-ink">
              {deleteTarget
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
            . This action cannot be undone.
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={() => setDeleteTarget(null)}
              className="ks-btn flex-1 justify-center !py-3 !text-[13px]"
            >
              Cancel
            </button>
            <button
              disabled={deleteKitMut.isPending}
              onClick={() =>
                deleteKitMut.mutate(deleteTarget, {
                  onSuccess: () => setDeleteTarget(null),
                })
              }
              className="flex-1 font-sans text-[13px] font-medium py-3 px-4 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleteKitMut.isPending ? "Deleting..." : "Yes, delete permanently"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Developer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DevKit {
  kitId: string;
  kitName: string;
  kitDescription: string | null;
  visibility: string;
  tools: { name: string; description: string }[];
  views: { slug: string; name: string; description: string }[];
  activeUsers: number;
}

function DeveloperTab() {
  const [kits, setKits] = useState<DevKit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/developer")
      .then((r) => r.json())
      .then((d) => setKits(d.kits || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl">
      {kits.length === 0 ? (
        <>
          {/* Empty state */}
          <div className="ks-card p-8 text-center mb-6">
            <div className="font-serif text-[24px] tracking-tight mb-2">
              Build your own kit
            </div>
            <p className="font-sans text-[14px] text-ks-muted leading-relaxed mb-4 max-w-md mx-auto">
              Use the KitStack SDK to build custom kits with tools, views, and a
              database &mdash; then deploy them to our infrastructure. Invite
              users or publish to the marketplace.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/docs"
                className="ks-btn ks-btn-primary !py-2.5 !px-5 !text-[13px]"
              >
                Read the docs &rarr;
              </Link>
              <a
                href="https://github.com/kitstack/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="ks-btn !py-2.5 !px-5 !text-[13px]"
              >
                View SDK on GitHub
              </a>
            </div>
          </div>

          <AuthorCTA />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <div className="font-mono text-[11px] text-ks-muted tracking-[1px]">
              YOUR DEPLOYED KITS &middot; {kits.length}
            </div>
            <Link
              href="/docs"
              className="font-sans text-[12px] text-ks-accent hover:underline"
            >
              SDK Docs &rarr;
            </Link>
          </div>

          <div className="flex flex-col gap-4 mb-6">
            {kits.map((kit) => (
              <div key={kit.kitId} className="ks-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-serif text-[22px] tracking-tight">
                      {kit.kitName}
                    </h3>
                    <div className="font-mono text-[11px] text-ks-muted">
                      {kit.kitId}
                    </div>
                  </div>
                  <VisibilityChip visibility={kit.visibility} />
                </div>

                {kit.kitDescription && (
                  <p className="font-sans text-[13px] text-ks-muted mb-3">
                    {kit.kitDescription}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-ks-paper-warm rounded-lg p-3">
                    <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                      TOOLS
                    </div>
                    <div className="text-[14px] font-semibold text-ks-ink">
                      {kit.tools.length}
                    </div>
                  </div>
                  <div className="bg-ks-paper-warm rounded-lg p-3">
                    <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                      VIEWS
                    </div>
                    <div className="text-[14px] font-semibold text-ks-ink">
                      {kit.views.length}
                    </div>
                  </div>
                  <div className="bg-ks-paper-warm rounded-lg p-3">
                    <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                      ACTIVE USERS
                    </div>
                    <div className="text-[14px] font-semibold text-ks-ink">
                      {kit.activeUsers}
                    </div>
                  </div>
                </div>

                {/* Tool list */}
                {kit.tools.length > 0 && (
                  <div className="border-t border-ks-hair pt-3">
                    <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-2">
                      TOOLS
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {kit.tools.map((t) => (
                        <span
                          key={t.name}
                          className="font-mono text-[11px] bg-ks-paper-warm rounded px-2 py-0.5 text-ks-ink"
                          title={t.description}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-ks-hair flex justify-end">
                  <Link
                    href={`/kits/${kit.kitId}-kit`}
                    className="font-sans text-[12px] text-ks-accent hover:underline"
                  >
                    View kit &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <AuthorCTA />
        </>
      )}
    </div>
  );
}

function VisibilityChip({ visibility }: { visibility: string }) {
  const styles: Record<string, string> = {
    private: "text-amber-700 bg-amber-50 border-amber-200",
    unlisted: "text-blue-700 bg-blue-50 border-blue-200",
    public: "text-green-700 bg-green-50 border-green-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border ${styles[visibility] || styles.private}`}
    >
      {visibility}
    </span>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Downloads
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Download {
  id: string;
  skillSlug: string;
  createdAt: string;
  skillName: string | null;
  skillCategory: string | null;
}

function DownloadsTab() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/downloads")
      .then((r) => r.json())
      .then((d) => setDownloads(d.downloads || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-4">
        DOWNLOADED SKILLS &middot; {downloads.length}
      </div>

      {downloads.length === 0 ? (
        <div className="ks-card p-8 text-center">
          <div className="font-serif text-[24px] tracking-tight mb-2">
            No downloads yet
          </div>
          <p className="font-sans text-[14px] text-ks-muted mb-4">
            Browse free skills and download them to use with Claude.
          </p>
          <Link
            href="/skills"
            className="ks-btn ks-btn-accent !py-2.5 !px-5 !text-[13px]"
          >
            Browse skills &rarr;
          </Link>
        </div>
      ) : (
        <div className="ks-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-ks-paper-warm border-b border-ks-hair">
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Skill
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Category
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Downloaded
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5 text-right" />
              </tr>
            </thead>
            <tbody>
              {downloads.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-sans text-[13px] font-semibold text-ks-ink">
                      {d.skillName || d.skillSlug}
                    </div>
                    <div className="font-mono text-[11px] text-ks-muted">
                      {d.skillSlug}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {d.skillCategory && (
                      <span className="ks-chip !text-[10px]">
                        {d.skillCategory}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ks-muted">
                    {fmtDate(d.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/skills/${d.skillSlug}`}
                      className="font-sans text-[12px] text-ks-accent hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Wishlist
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WishlistTab() {
  const { data: wishData, isLoading } = useWishlists();
  const toggleWishlist = useToggleWishlist();

  if (isLoading) return <Spinner />;

  const items = wishData?.wishlists ?? [];

  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-4">
        WISHLIST &middot; {items.length}
      </div>

      {items.length === 0 ? (
        <div className="ks-card p-8 text-center">
          <div className="font-serif text-[24px] tracking-tight mb-2">
            Wishlist is empty
          </div>
          <p className="font-sans text-[14px] text-ks-muted mb-4">
            Save skills and kits to your wishlist while browsing.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/skills"
              className="ks-btn !py-2.5 !px-4 !text-[13px]"
            >
              Browse skills
            </Link>
            <Link
              href="/kits"
              className="ks-btn ks-btn-primary !py-2.5 !px-4 !text-[13px]"
            >
              Browse kits
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => {
            const href =
              item.targetType === "kit"
                ? `/kits/${item.targetSlug}`
                : `/skills/${item.targetSlug}`;
            const label = item.targetSlug
              .replace(/-/g, " ")
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
            return (
              <div
                key={`${item.targetType}-${item.targetSlug}`}
                className="ks-card p-4 flex items-center justify-between group"
              >
                <Link href={href} className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="ks-chip !text-[9px] !py-0 !px-1.5 shrink-0">
                    {item.targetType}
                  </span>
                  <span className="font-sans text-[13px] font-medium text-ks-ink group-hover:text-ks-accent truncate">
                    {label}
                  </span>
                </Link>
                <button
                  onClick={() =>
                    toggleWishlist.mutate({
                      targetType: item.targetType,
                      targetSlug: item.targetSlug,
                      wishlisted: true,
                    })
                  }
                  className="font-sans text-[11px] text-ks-muted hover:text-red-500 ml-3 shrink-0"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Billing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BillingTab() {
  const { data: subData, isLoading } = useSubscription();
  const subscribe = useSubscribe();
  const cancelSub = useCancelSubscription();
  const [showCancelModal, setShowCancelModal] = useState(false);

  if (isLoading) return <Spinner />;

  const subscription = subData?.subscription ?? null;

  return (
    <div className="max-w-xl">
      <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-4">
        SUBSCRIPTION
      </div>

      {!subscription ? (
        <>
          <div className="ks-card p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-[22px] tracking-tight">Free</h3>
                <p className="font-sans text-[13px] text-ks-muted mt-0.5">
                  Current plan
                </p>
              </div>
              <div className="font-serif text-[28px] text-ks-muted">
                &euro;0
              </div>
            </div>
            <div className="font-sans text-[13px] text-ks-muted">
              Download free skills. No kits, no database, no persistence.
            </div>
          </div>

          <div className="ks-card-ink p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-[22px] tracking-tight">
                  Starter
                </h3>
                <p className="font-sans text-[13px] text-ks-faint mt-0.5">
                  All kits included
                </p>
              </div>
              <div className="font-serif text-[28px]">
                &euro;5<span className="text-[16px] text-ks-faint">/mo</span>
              </div>
            </div>
            <ul className="font-sans text-[13px] text-ks-faint space-y-1.5 mb-5">
              <li className="flex items-center gap-2">
                <span className="text-ks-accent text-xs">&#10003;</span>
                All kits with database &amp; persistence
              </li>
              <li className="flex items-center gap-2">
                <span className="text-ks-accent text-xs">&#10003;</span>
                Interactive UI inside the chat
              </li>
              <li className="flex items-center gap-2">
                <span className="text-ks-accent text-xs">&#10003;</span>
                Cancel anytime
              </li>
            </ul>
            <button
              onClick={() => subscribe.mutate("starter")}
              disabled={subscribe.isPending}
              className="ks-btn ks-btn-accent !py-2.5 !px-5 !text-[14px]"
            >
              {subscribe.isPending ? "Processing..." : "Subscribe to Starter"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="ks-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-[22px] tracking-tight capitalize">
                  {subscription.plan}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium ${subscription.status === "active"
                      ? "text-green-700"
                      : subscription.status === "cancelled"
                        ? "text-amber-600"
                        : "text-red-600"
                      }`}
                  >
                    <span className="text-[8px]">&#9679;</span>
                    {subscription.status}
                  </span>
                </div>
              </div>
              <div className="font-serif text-[28px] text-ks-ink">
                &euro;5<span className="text-[16px] text-ks-muted">/mo</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-ks-hair pt-4">
              {[
                { label: "Plan", value: subscription.plan },
                { label: "Status", value: subscription.status },
                ...(subscription.currentPeriodEnd
                  ? [
                    {
                      label: "Current period ends",
                      value: fmtDate(
                        subscription.currentPeriodEnd as unknown as string,
                      ),
                    },
                  ]
                  : []),
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between py-1.5 border-b border-ks-hair/50 last:border-0"
                >
                  <span className="font-sans text-[13px] text-ks-muted">
                    {row.label}
                  </span>
                  <span className="font-sans text-[13px] font-semibold text-ks-ink capitalize">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {subscription.status === "active" && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="mt-4 font-sans text-[12px] text-red-500 hover:text-red-700"
              >
                Cancel subscription
              </button>
            )}
          </div>

          <div className="bg-ks-paper-warm border border-ks-hair rounded-xl p-4 mt-4">
            <div className="font-sans text-[12px] text-ks-muted leading-relaxed">
              <span className="font-semibold text-ks-ink">Your data.</span> Your
              data is private and exportable anytime as JSON or CSV. If you
              cancel, your data stays downloadable for 90 days.
            </div>
          </div>
        </>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <Modal onClose={() => setShowCancelModal(false)}>
          <h2 className="font-serif text-[28px] tracking-tight mb-3">
            Cancel subscription?
          </h2>
          <p className="font-sans text-[14px] text-ks-muted leading-relaxed mb-2">
            Your kits will stop working at the end of the current billing period.
            Your data stays accessible for 90 days.
          </p>
          <div className="flex flex-col gap-2 mb-6 font-sans text-[13px] text-ks-ink2">
            {[
              "Data exportable for 90 days",
              "Free skills keep working forever",
              "Re-subscribe anytime to restore access",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="text-green-700 text-xs">&#10003;</span>
                {t}
              </div>
            ))}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowCancelModal(false)}
              className="ks-btn flex-1 justify-center !py-3 !text-[13px]"
            >
              Keep subscription
            </button>
            <button
              disabled={cancelSub.isPending}
              onClick={() =>
                cancelSub.mutate(undefined, {
                  onSuccess: () => setShowCancelModal(false),
                })
              }
              className="flex-1 font-sans text-[13px] font-medium py-3 px-4 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {cancelSub.isPending ? "Cancelling..." : "Yes, cancel"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Settings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SettingsTab({ user, onSignOut }: { user: { id: string; name: string; email: string; image?: string | null }; onSignOut: () => void }) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.image || "");

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      setAvatarUrl(data.imageUrl);
    }
    setUploading(false);
  }

  return (
    <div className="max-w-xl">
      {/* Profile */}
      <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-4">
        PROFILE
      </div>
      <div className="ks-card p-6 mb-6">
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-5">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover border border-ks-hair"
              />
            ) : (
              <Avatar name={user.name || user.email} size={64} tone="#3b7a3b" />
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-full">
                <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div>
            <label className="ks-btn !py-1.5 !px-3 !text-[12px] cursor-pointer">
              {uploading ? "Uploading..." : "Change photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </label>
            <div className="font-mono text-[10px] text-ks-muted mt-1">
              JPG, PNG, or WebP. Max 2MB.
            </div>
          </div>
        </div>

        {/* Name */}
        <form onSubmit={handleSaveName} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[12px] font-medium text-ks-ink">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ks-input"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-sans text-[12px] font-medium text-ks-ink">
              Email
            </span>
            <input
              type="text"
              value={user.email}
              disabled
              className="ks-input opacity-60"
            />
            <span className="font-mono text-[10px] text-ks-muted">
              Email cannot be changed
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || name === user.name}
              className="ks-btn ks-btn-primary !py-2 !px-4 !text-[13px] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {saved && (
              <span className="font-sans text-[12px] text-green-700">
                &#10003; Saved
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Sign out */}
      <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-4 mt-6">
        ACCOUNT
      </div>
      <div className="ks-card p-6 flex items-center justify-between">
        <div>
          <div className="font-sans text-[13px] font-medium text-ks-ink">
            Sign out
          </div>
          <div className="font-sans text-[12px] text-ks-muted">
            Sign out of your KitStack account on this device.
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="ks-btn !py-2 !px-4 !text-[12px] !text-red-600 !border-red-200 hover:!bg-red-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CopyMcpButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText("https://mcp.kitstack.co");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 font-mono text-[11px] font-medium text-amber-700 hover:text-amber-900 border border-amber-300 rounded-full px-3 py-1.5 transition-colors"
    >
      {copied ? "\u2713 Copied" : "Copy MCP URL"}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
    </div>
  );
}

function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-ks-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-ks-paper border border-ks-hair rounded-2xl shadow-xl w-full max-w-md p-8">
        {children}
      </div>
    </div>
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

