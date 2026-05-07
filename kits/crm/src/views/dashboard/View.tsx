import { useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type Deal = {
  id: string;
  title: string;
  stage: string | null;
  valueCents: number | null;
  currency: string | null;
};

type Activity = {
  id: string;
  type: string;
  summary: string;
  contactId: string;
  firstName: string;
  lastName: string | null;
  createdAt: string;
};

type Data = { deals: Deal[]; activities: Activity[] };

const STAGES = ["lead", "contacted", "proposal", "negotiation", "won", "lost"] as const;

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", contacted: "Contacted", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞", email: "✉️", meeting: "🤝", coffee: "☕",
  linkedin: "🔗", event: "🌟", note: "📝", task: "☑️",
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function DashboardView() {
  const { data } = useKit<Data>();
  const deals = data?.deals ?? [];
  const activities = data?.activities ?? [];

  const stats = useMemo(() => {
    const byStage = new Map<string, { count: number; value: number }>();
    STAGES.forEach((s) => byStage.set(s, { count: 0, value: 0 }));
    deals.forEach((d) => {
      const s = byStage.get(d.stage ?? "lead")!;
      s.count++;
      s.value += d.valueCents || 0;
    });

    const total = deals.reduce((sum, d) => sum + (d.valueCents || 0), 0);
    const open = deals
      .filter((d) => !["won", "lost"].includes(d.stage ?? ""))
      .reduce((sum, d) => sum + (d.valueCents || 0), 0);
    const won = byStage.get("won")!.value;
    const maxStageValue = Math.max(...[...byStage.values()].map((s) => s.value), 1);

    return { byStage, total, open, won, maxStageValue, dealCount: deals.length };
  }, [deals]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Dashboard</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Total Pipeline</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{formatCurrency(stats.total)}</div>
          <div className="text-[11px] text-ks-muted">{stats.dealCount} deals</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Open</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{formatCurrency(stats.open)}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Won</div>
          <div className="font-mono text-lg font-semibold text-emerald-800 mt-0.5">
            {formatCurrency(stats.won)}
          </div>
        </div>
      </div>

      {/* Pipeline bar chart */}
      <div className="mb-5">
        <h2 className="font-serif text-base mb-3">Pipeline by Stage</h2>
        <div className="flex flex-col gap-2">
          {STAGES.map((stage) => {
            const { count, value } = stats.byStage.get(stage)!;
            const width = (value / stats.maxStageValue) * 100;
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-24 text-xs text-ks-muted">{STAGE_LABELS[stage]}</div>
                <div className="flex-1 h-6 bg-ks-paper-warm rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stage === "won"
                        ? "bg-emerald-400"
                        : stage === "lost"
                          ? "bg-red-300"
                          : "bg-ks-accent"
                    }`}
                    style={{ width: `${Math.max(width, count > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <div className="w-20 text-right font-mono text-[11px] text-ks-muted">
                  {count > 0 ? `${count} · ${formatCurrency(value)}` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div>
          <h2 className="font-serif text-base mb-2">Recent Activity</h2>
          <div className="flex flex-col gap-1">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-1.5 text-sm border-b border-ks-hair/30 last:border-0">
                <span>{ACTIVITY_ICONS[a.type] ?? "•"}</span>
                <span className="flex-1 text-[13px] truncate">
                  <span className="font-medium">{a.firstName} {a.lastName ?? ""}</span>
                  <span className="text-ks-muted"> — </span>
                  {a.summary}
                </span>
                <span className="text-[10px] text-ks-faint">{a.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
