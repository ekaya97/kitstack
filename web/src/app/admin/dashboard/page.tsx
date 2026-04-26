"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DashboardData {
  counts: {
    users: number;
    admins: number;
    skills: number;
    kits: number;
    activeSubscriptions: number;
    totalSubscriptions: number;
    activeActivations: number;
    totalActivations: number;
    totalDownloads: number;
    reviews: number;
    unverifiedReviews: number;
  };
  topSkills: { slug: string; name: string; category: string; downloads: number | null }[];
  topKits: { slug: string; name: string; category: string; activations: number }[];
  recentActivations: { id: string; userId: string; kitSlug: string; status: string; createdAt: string }[];
  recentDownloads: { id: string; userId: string | null; skillSlug: string; createdAt: string }[];
  recentUsers: { id: string; name: string; email: string; createdAt: string }[];
  recentReviews: { id: string; targetType: string; targetSlug: string; userName: string; rating: number; verified: boolean; createdAt: string }[];
  categoryCounts: { category: string; count: number }[];
  subscriptionBreakdown: { plan: string; status: string; count: number }[];
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtSlug(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;
  const { counts } = data;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-[28px] tracking-tight text-ks-ink">
          Dashboard
        </h1>
        <p className="font-sans text-[13px] text-ks-muted mt-1">
          Platform overview
        </p>
      </div>

      {/* ── Summary cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Users"
          value={counts.users}
          sub={`${counts.admins} admin${counts.admins !== 1 ? "s" : ""}`}
          href="/admin/users"
        />
        <StatCard
          label="Active Subscriptions"
          value={counts.activeSubscriptions}
          sub={`${counts.totalSubscriptions} total`}
        />
        <StatCard
          label="Kit Activations"
          value={counts.activeActivations}
          sub={`${counts.totalActivations} total`}
        />
        <StatCard
          label="Skill Downloads"
          value={counts.totalDownloads}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Skills"
          value={counts.skills}
          href="/admin/skills"
        />
        <StatCard
          label="Kits"
          value={counts.kits}
          href="/admin/kits"
        />
        <StatCard
          label="Reviews"
          value={counts.reviews}
          sub={counts.unverifiedReviews > 0 ? `${counts.unverifiedReviews} unverified` : "all verified"}
          href="/admin/reviews"
          alert={counts.unverifiedReviews > 0}
        />
        <StatCard
          label="MRR (est.)"
          value={`€${counts.activeSubscriptions * 5}`}
          sub={`${counts.activeSubscriptions} × €5`}
        />
      </div>

      {/* ── Subscription breakdown ─────────────────────── */}
      {data.subscriptionBreakdown.length > 0 && (
        <div className="mb-8">
          <SectionHeader label="Subscriptions by Plan" />
          <div className="ks-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-ks-paper-warm border-b border-ks-hair">
                  <TH>Plan</TH>
                  <TH>Status</TH>
                  <TH>Count</TH>
                </tr>
              </thead>
              <tbody>
                {data.subscriptionBreakdown.map((row) => (
                  <tr key={`${row.plan}-${row.status}`} className="border-b border-ks-hair/50">
                    <TD><span className="font-semibold capitalize">{row.plan}</span></TD>
                    <TD><StatusChip status={row.status} /></TD>
                    <TD>{row.count}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Top content + Category breakdown ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Top skills */}
        <div>
          <SectionHeader label="Top Skills by Downloads" href="/admin/skills" />
          <div className="ks-card p-4 flex flex-col gap-2">
            {data.topSkills.length === 0 ? (
              <Empty>No downloads yet</Empty>
            ) : (
              data.topSkills.map((s, i) => (
                <div key={s.slug} className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-ks-muted w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-sans text-[13px] font-medium text-ks-ink truncate">{s.name}</div>
                    <div className="font-mono text-[10px] text-ks-muted">{s.category}</div>
                  </div>
                  <span className="font-mono text-[12px] font-semibold text-ks-ink">{(s.downloads ?? 0).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top kits */}
        <div>
          <SectionHeader label="Top Kits by Activations" href="/admin/kits" />
          <div className="ks-card p-4 flex flex-col gap-2">
            {data.topKits.length === 0 ? (
              <Empty>No activations yet</Empty>
            ) : (
              data.topKits.map((k, i) => (
                <div key={k.slug} className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-ks-muted w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-sans text-[13px] font-medium text-ks-ink truncate">{k.name}</div>
                    <div className="font-mono text-[10px] text-ks-muted">{k.category}</div>
                  </div>
                  <span className="font-mono text-[12px] font-semibold text-ks-ink">{k.activations}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div>
          <SectionHeader label="Skills by Category" />
          <div className="ks-card p-4 flex flex-col gap-2">
            {data.categoryCounts.length === 0 ? (
              <Empty>No skills yet</Empty>
            ) : (
              data.categoryCounts
                .sort((a, b) => b.count - a.count)
                .map((c) => (
                  <div key={c.category} className="flex items-center justify-between">
                    <span className="ks-chip !text-[10px]">{c.category}</span>
                    <div className="flex items-center gap-2 flex-1 mx-3">
                      <div className="flex-1 bg-ks-hair/50 rounded-full h-1.5">
                        <div
                          className="bg-ks-accent h-1.5 rounded-full"
                          style={{
                            width: `${(c.count / Math.max(...data.categoryCounts.map((x) => x.count))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="font-mono text-[12px] font-semibold text-ks-ink w-6 text-right">{c.count}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* ── Activity feeds ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent users */}
        <div>
          <SectionHeader label="Recent Users" href="/admin/users" />
          <div className="ks-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-ks-paper-warm border-b border-ks-hair">
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Joined</TH>
                </tr>
              </thead>
              <tbody>
                {data.recentUsers.length === 0 ? (
                  <tr><TD colSpan={3}><Empty>No users yet</Empty></TD></tr>
                ) : (
                  data.recentUsers.map((u) => (
                    <tr key={u.id} className="border-b border-ks-hair/50">
                      <TD><span className="font-semibold">{u.name}</span></TD>
                      <TD><span className="text-ks-muted">{u.email}</span></TD>
                      <TD>{fmtDate(u.createdAt)}</TD>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent reviews */}
        <div>
          <SectionHeader label="Recent Reviews" href="/admin/reviews" />
          <div className="ks-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-ks-paper-warm border-b border-ks-hair">
                  <TH>Target</TH>
                  <TH>User</TH>
                  <TH>Rating</TH>
                  <TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                {data.recentReviews.length === 0 ? (
                  <tr><TD colSpan={4}><Empty>No reviews yet</Empty></TD></tr>
                ) : (
                  data.recentReviews.map((r) => (
                    <tr key={r.id} className="border-b border-ks-hair/50">
                      <TD>
                        <span className="ks-chip !text-[9px] !py-0 !px-1.5 mr-1.5">{r.targetType}</span>
                        <span className="text-[12px]">{fmtSlug(r.targetSlug)}</span>
                      </TD>
                      <TD>{r.userName}</TD>
                      <TD>
                        <span className="text-amber-500">&#9733;</span> {r.rating}/5
                      </TD>
                      <TD>
                        {r.verified ? (
                          <span className="text-green-700 text-[11px] font-mono">&#9679; verified</span>
                        ) : (
                          <span className="text-amber-600 text-[11px] font-mono">&#9675; pending</span>
                        )}
                      </TD>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent activations + downloads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader label="Recent Kit Activations" />
          <div className="ks-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-ks-paper-warm border-b border-ks-hair">
                  <TH>Kit</TH>
                  <TH>User ID</TH>
                  <TH>Status</TH>
                  <TH>Date</TH>
                </tr>
              </thead>
              <tbody>
                {data.recentActivations.length === 0 ? (
                  <tr><TD colSpan={4}><Empty>No activations yet</Empty></TD></tr>
                ) : (
                  data.recentActivations.map((a) => (
                    <tr key={a.id} className="border-b border-ks-hair/50">
                      <TD><span className="font-semibold">{fmtSlug(a.kitSlug)}</span></TD>
                      <TD><span className="font-mono text-[11px] text-ks-muted">{a.userId.slice(0, 12)}...</span></TD>
                      <TD><StatusChip status={a.status} /></TD>
                      <TD>{fmtDate(a.createdAt)}</TD>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeader label="Recent Skill Downloads" />
          <div className="ks-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-ks-paper-warm border-b border-ks-hair">
                  <TH>Skill</TH>
                  <TH>User ID</TH>
                  <TH>Date</TH>
                </tr>
              </thead>
              <tbody>
                {data.recentDownloads.length === 0 ? (
                  <tr><TD colSpan={3}><Empty>No downloads yet</Empty></TD></tr>
                ) : (
                  data.recentDownloads.map((d) => (
                    <tr key={d.id} className="border-b border-ks-hair/50">
                      <TD><span className="font-semibold">{fmtSlug(d.skillSlug)}</span></TD>
                      <TD>
                        {d.userId ? (
                          <span className="font-mono text-[11px] text-ks-muted">{d.userId.slice(0, 12)}...</span>
                        ) : (
                          <span className="font-mono text-[11px] text-ks-muted">anonymous</span>
                        )}
                      </TD>
                      <TD>{fmtDate(d.createdAt)}</TD>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared components ───────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  href,
  alert,
}: {
  label: string;
  value: number | string;
  sub?: string;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <div className={`ks-card p-4 ${href ? "hover:bg-ks-paper-warm/50 transition-colors" : ""}`}>
      <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
        {label.toUpperCase()}
      </div>
      <div className="font-serif text-[28px] tracking-tight text-ks-ink leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {sub && (
        <div className={`font-mono text-[11px] mt-1 ${alert ? "text-amber-600" : "text-ks-muted"}`}>
          {sub}
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SectionHeader({ label, href }: { label: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="font-mono text-[10px] text-ks-muted tracking-wider">
        {label.toUpperCase()}
      </span>
      {href && (
        <Link href={href} className="font-sans text-[11px] text-ks-accent hover:underline">
          View all &rarr;
        </Link>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "text-green-700",
    cancelled: "text-red-600",
    expired: "text-ks-muted",
    deactivated: "text-amber-600",
    archived: "text-ks-muted",
  };
  return (
    <span className={`font-mono text-[11px] ${colors[status] || "text-ks-muted"}`}>
      {status}
    </span>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
      {children}
    </th>
  );
}

function TD({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <td className="px-4 py-2.5 font-sans text-[13px] text-ks-ink" colSpan={colSpan}>
      {children}
    </td>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-4 font-sans text-[13px] text-ks-muted">{children}</div>
  );
}
