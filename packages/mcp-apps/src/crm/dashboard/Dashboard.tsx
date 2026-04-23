import { useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import { STAGES, STAGE_LABELS, STAGE_COLORS, type Deal, type Activity } from "@shared/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞", email: "✉️", meeting: "🤝", note: "📝", task: "☑️",
};

export function Dashboard() {
  const { data: deals, loading: dl, error, refetch } = useAppData<Deal>("deals");
  const { data: activities, loading: al } = useAppData<Activity>("activities");
  const loading = dl || al;

  const stats = useMemo(() => {
    if (!deals) return null;
    const byStage = new Map<string, { count: number; value: number }>();
    STAGES.forEach((s) => byStage.set(s, { count: 0, value: 0 }));
    deals.forEach((d) => {
      const s = byStage.get(d.stage)!;
      s.count++;
      s.value += d.value || 0;
    });

    const total = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const open = deals
      .filter((d) => !["won", "lost"].includes(d.stage))
      .reduce((sum, d) => sum + (d.value || 0), 0);
    const won = byStage.get("won")!.value;
    const maxStageValue = Math.max(...[...byStage.values()].map((s) => s.value), 1);

    return { byStage, total, open, won, maxStageValue, dealCount: deals.length };
  }, [deals]);

  const recentActivities = useMemo(
    () =>
      activities
        ?.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
        .slice(0, 8) ?? [],
    [activities]
  );

  return (
    <AppShell title="Dashboard" loading={loading} error={error} onRetry={refetch}>
      {stats && (
        <>
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
          {recentActivities.length > 0 && (
            <div>
              <h2 className="font-serif text-base mb-2">Recent Activity</h2>
              <div className="flex flex-col gap-1">
                {recentActivities.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 py-1.5 text-sm border-b border-ks-hair/30 last:border-0">
                    <span>{ACTIVITY_ICONS[a.type] ?? "•"}</span>
                    <span className="flex-1 text-[13px] truncate">{a.description}</span>
                    <span className="text-[10px] text-ks-faint">{a.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
