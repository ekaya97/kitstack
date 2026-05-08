import type { ViewProps } from "@kitstackco/sdk/runtime";
import type { loader } from "./loader";

type Data = ViewProps<typeof loader>["data"];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  planning: "bg-blue-100 text-blue-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

const TASK_STATUS_ICON: Record<string, string> = {
  done: "✅",
  in_progress: "🔄",
  todo: "⬜",
  blocked: "🚫",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

export function ProjectDetailView({ data }: { data: Data }) {
  if (!data.project) {
    return <div className="p-4 text-ks-muted">No project found.</div>;
  }

  const p = data.project;
  const totalHours = (data.totalMinutes / 60).toFixed(1);
  const billableHours = (data.billableMinutes / 60).toFixed(1);
  const doneTasks = data.tasks.filter(t => t.status === "done").length;
  const totalTasks = data.tasks.length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Budget calculation
  let budgetPct: number | null = null;
  let budgetSpent: number | null = null;
  if (p.budget && p.billingType === "hourly" && p.hourlyRate) {
    budgetSpent = (data.billableMinutes / 60) * p.hourlyRate;
    budgetPct = Math.round((budgetSpent / p.budget) * 100);
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-serif text-xl">{p.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status ?? "active"]}`}>
            {p.status}
          </span>
        </div>
        {data.client && <p className="text-sm text-ks-muted">{data.client.name}</p>}
        {p.description && <p className="text-sm mt-1">{p.description}</p>}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="Tasks" value={`${doneTasks}/${totalTasks}`} />
        <MiniStat label="Time" value={`${totalHours}h`} />
        <MiniStat label="Billable" value={`${billableHours}h`} />
        {p.dueDate ? <MiniStat label="Due" value={p.dueDate} /> : <MiniStat label="Priority" value={p.priority ?? "medium"} />}
      </div>

      {/* Budget meter */}
      {p.budget && (
        <div>
          <div className="flex justify-between text-xs text-ks-muted mb-1">
            <span>Budget</span>
            <span>
              {budgetSpent !== null ? `€${budgetSpent.toFixed(0)}` : "—"} / €{p.budget.toFixed(0)}
              {budgetPct !== null ? ` (${budgetPct}%)` : ""}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                budgetPct !== null && budgetPct >= 80 ? "bg-red-400" : "bg-blue-400"
              }`}
              style={{ width: `${Math.min(budgetPct ?? 0, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Task progress */}
      {totalTasks > 0 && (
        <div>
          <div className="flex justify-between text-xs text-ks-muted mb-1">
            <span>Progress</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Milestones */}
      {data.milestones.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ks-muted uppercase tracking-wide mb-2">
            Milestones
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.milestones.map((ms) => (
              <div
                key={ms.id}
                className={`flex-shrink-0 border rounded-lg px-3 py-2 text-sm ${
                  ms.status === "completed"
                    ? "bg-green-50 border-green-200"
                    : ms.status === "in_progress"
                      ? "bg-blue-50 border-blue-200"
                      : "border-ks-hair"
                }`}
              >
                <div className="font-medium">{ms.name}</div>
                {ms.dueDate && <div className="text-xs text-ks-muted">{ms.dueDate}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tasks */}
      {data.tasks.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ks-muted uppercase tracking-wide mb-2">
            Tasks
          </h2>
          <ul className="space-y-1">
            {data.tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-1.5 border-b border-ks-hair last:border-0">
                <div className="flex items-center gap-2">
                  <span>{TASK_STATUS_ICON[t.status ?? "todo"] ?? "⬜"}</span>
                  <span className={`text-sm ${t.status === "done" ? "line-through text-ks-muted" : ""}`}>
                    {t.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {t.priority && t.priority !== "medium" && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[t.priority]}`}>
                      {t.priority}
                    </span>
                  )}
                  {t.dueDate && <span className="text-xs text-ks-muted">{t.dueDate}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-ks-muted">{label}</div>
    </div>
  );
}
