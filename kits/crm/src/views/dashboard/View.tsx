import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const ACTIVITY_ICONS: Record<string, string> = {
  call: "\ud83d\udcde",
  email: "\u2709\ufe0f",
  meeting: "\ud83e\udd1d",
  note: "\ud83d\udcdd",
  task: "\u2611\ufe0f",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function DashboardView({ data }: { data: Data }) {

  const maxStageValue = Math.max(...data.stages.map((s) => s.value), 1);

  return (
    <div className="p-4">
      <h1 className="font-serif text-xl mb-4">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Total Pipeline</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{formatCurrency(data.total)}</div>
          <div className="text-[11px] text-ks-muted">
            {data.stages.reduce((sum, s) => sum + s.count, 0)} deals
          </div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Open</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{formatCurrency(data.open)}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Won</div>
          <div className="font-mono text-lg font-semibold text-emerald-800 mt-0.5">
            {formatCurrency(data.won)}
          </div>
        </div>
      </div>

      {/* Pipeline bar chart */}
      <div className="mb-5">
        <h2 className="font-serif text-base mb-3">Pipeline by Stage</h2>
        <div className="flex flex-col gap-2">
          {data.stages.map((s) => {
            const width = (s.value / maxStageValue) * 100;
            return (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="w-24 text-xs text-ks-muted">{STAGE_LABELS[s.stage] ?? s.stage}</div>
                <div className="flex-1 h-6 bg-ks-paper-warm rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      s.stage === "won"
                        ? "bg-emerald-400"
                        : s.stage === "lost"
                          ? "bg-red-300"
                          : "bg-ks-accent"
                    }`}
                    style={{ width: `${Math.max(width, s.count > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <div className="w-20 text-right font-mono text-[11px] text-ks-muted">
                  {s.count > 0 ? `${s.count} \u00b7 ${formatCurrency(s.value)}` : "\u2014"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentActivities.length > 0 && (
        <div>
          <h2 className="font-serif text-base mb-2">Recent Activity</h2>
          <div className="flex flex-col gap-1">
            {data.recentActivities.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-1.5 text-sm border-b border-ks-hair/30 last:border-0">
                <span>{ACTIVITY_ICONS[a.type] ?? "\u2022"}</span>
                <span className="flex-1 text-[13px] truncate">{a.description}</span>
                <span className="text-[10px] text-ks-faint">{a.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
