import { useKit } from "../../sdk-view";
import type { LoaderData } from "../../sdk";
import type dashboardView from "./index";

type Data = LoaderData<typeof dashboardView>;

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞",
  email: "✉️",
  meeting: "🤝",
  note: "📝",
  task: "☑️",
};

export function DashboardView() {
  const { data } = useKit<Data>();

  const maxStageValue = Math.max(...data.stages.map((s) => s.value), 1);

  return (
    <div className="p-4">
      <h1 className="font-serif text-xl mb-4">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border border-ks-hair rounded p-3">
          <div className="text-xs text-ks-muted">Total Pipeline</div>
          <div className="font-mono text-lg">€{data.total.toLocaleString()}</div>
        </div>
        <div className="border border-ks-hair rounded p-3">
          <div className="text-xs text-ks-muted">Open</div>
          <div className="font-mono text-lg text-ks-accent">€{data.open.toLocaleString()}</div>
        </div>
        <div className="border border-emerald-200 rounded p-3 bg-emerald-50">
          <div className="text-xs text-emerald-600">Won</div>
          <div className="font-mono text-lg text-emerald-800">€{data.won.toLocaleString()}</div>
        </div>
      </div>

      {/* Pipeline bar chart */}
      <div className="mb-6">
        <h2 className="font-serif text-lg mb-2">Pipeline by Stage</h2>
        <div className="space-y-2">
          {data.stages.map((s) => {
            const width = maxStageValue > 0 ? (s.value / maxStageValue) * 100 : 0;
            const barColor = s.stage === "won" ? "bg-emerald-400" : s.stage === "lost" ? "bg-red-300" : "bg-ks-accent";

            return (
              <div key={s.stage} className="flex items-center gap-3">
                <span className="text-sm text-ks-muted w-24">{s.stage}</span>
                <div className="flex-1 bg-ks-paper-deep rounded h-5">
                  <div className={`${barColor} rounded h-5`} style={{ width: `${width}%` }} />
                </div>
                <span className="text-xs font-mono w-20 text-right">
                  {s.count} · €{s.value.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      {data.recentActivities.length > 0 && (
        <div>
          <h2 className="font-serif text-lg mb-2">Recent Activity</h2>
          <div className="space-y-1 text-sm">
            {data.recentActivities.map((a) => (
              <div key={a.id} className="flex gap-2">
                <span>{ACTIVITY_ICONS[a.type] ?? "·"}</span>
                <span className="text-ks-muted">[{a.type}]</span>
                <span>{a.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
