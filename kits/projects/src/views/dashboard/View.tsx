import type { ViewProps } from "@kitstackco/sdk/runtime";
import type { loader } from "./loader";

type Data = ViewProps<typeof loader>["data"];

export function DashboardView({ data }: { data: Data }) {
  const totalWeekMinutes = data.weeklyTime.reduce((sum, w) => sum + w.totalMinutes, 0);

  return (
    <div className="p-4 space-y-6">
      <h1 className="font-serif text-xl">Projects Dashboard</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active Projects" value={data.activeProjects.length} />
        <StatCard
          label="Urgent Tasks"
          value={data.urgentTasks.length}
          alert={data.urgentTasks.length > 0}
        />
        <StatCard label="This Week" value={`${(totalWeekMinutes / 60).toFixed(1)}h`} />
      </div>

      {/* Active Projects */}
      {data.activeProjects.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ks-muted uppercase tracking-wide mb-2">
            Active Projects
          </h2>
          <div className="space-y-2">
            {data.activeProjects.map((p) => {
              const tc = data.taskCounts.find((t) => t.projectId === p.id);
              const total = tc?.total ?? 0;
              const done = tc?.done ?? 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isOverdue = p.dueDate && p.dueDate < data.today;
              const isDueSoon =
                p.dueDate &&
                !isOverdue &&
                p.dueDate <= new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

              return (
                <div key={p.id} className="border border-ks-hair rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-medium">{p.name}</span>
                      {p.clientName && (
                        <span className="text-ks-muted text-sm ml-2">{p.clientName}</span>
                      )}
                    </div>
                    {p.dueDate && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          isOverdue
                            ? "bg-red-100 text-red-700"
                            : isDueSoon
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                        }`}
                      >
                        {isOverdue ? "Overdue" : p.dueDate}
                      </span>
                    )}
                  </div>
                  {total > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-ks-muted">
                        {done}/{total}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Needs Attention */}
      {data.urgentTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ks-muted uppercase tracking-wide mb-2">
            Needs Attention
          </h2>
          <ul className="space-y-1">
            {data.urgentTasks.map((t, i) => {
              const isOverdue = t.dueDate && t.dueDate < data.today;
              return (
                <li key={i} className="flex items-center justify-between py-1.5 border-b border-ks-hair last:border-0">
                  <div>
                    <span className="font-medium text-sm">{t.title}</span>
                    <span className="text-ks-muted text-xs ml-2">{t.projectName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOverdue && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        overdue
                      </span>
                    )}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        t.priority === "urgent"
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Weekly Time */}
      {data.weeklyTime.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ks-muted uppercase tracking-wide mb-2">
            This Week
          </h2>
          <div className="space-y-1.5">
            {data.weeklyTime.map((w) => {
              const hours = w.totalMinutes / 60;
              const maxHours = Math.max(...data.weeklyTime.map((x) => x.totalMinutes / 60));
              const barPct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
              return (
                <div key={w.projectId} className="flex items-center gap-3">
                  <span className="text-sm w-28 truncate">{w.projectName}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-ks-muted w-10 text-right">
                    {hours.toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${alert ? "bg-red-50" : "bg-ks-paper-warm"}`}>
      <div className={`text-lg font-semibold ${alert ? "text-red-700" : ""}`}>{value}</div>
      <div className="text-xs text-ks-muted">{label}</div>
    </div>
  );
}
