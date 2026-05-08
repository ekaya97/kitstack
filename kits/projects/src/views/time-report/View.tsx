import type { ViewProps } from "@kitstackco/sdk/runtime";
import type { loader } from "./loader";

type Data = ViewProps<typeof loader>["data"];

const BAR_COLORS = [
  "bg-blue-400", "bg-green-400", "bg-purple-400", "bg-orange-400",
  "bg-pink-400", "bg-teal-400", "bg-indigo-400", "bg-yellow-400",
];

export function TimeReportView({ data }: { data: Data }) {
  const grandTotal = data.monthlyByProject.reduce((sum, r) => sum + r.totalMinutes, 0);
  const grandBillable = data.monthlyByProject.reduce((sum, r) => sum + r.billableMinutes, 0);
  const grandValue = data.monthlyByProject.reduce((sum, r) => {
    if (r.hourlyRate) return sum + (r.billableMinutes / 60) * r.hourlyRate;
    return sum;
  }, 0);

  // Collect unique project names for color assignment
  const projectNames = [...new Set(data.monthlyByProject.map(r => r.projectName))];
  const colorMap: Record<string, string> = {};
  projectNames.forEach((name, i) => {
    colorMap[name] = BAR_COLORS[i % BAR_COLORS.length];
  });

  // Group daily entries by date
  const dateMap: Record<string, Array<{ projectName: string; totalMinutes: number }>> = {};
  for (const entry of data.dailyEntries) {
    if (!dateMap[entry.entryDate]) dateMap[entry.entryDate] = [];
    dateMap[entry.entryDate].push(entry);
  }
  const dates = Object.keys(dateMap).sort();
  const maxDayMinutes = Math.max(
    ...dates.map(d => dateMap[d].reduce((s, e) => s + e.totalMinutes, 0)),
    1,
  );

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="font-serif text-xl">Time Report</h1>
        <p className="text-sm text-ks-muted">
          {data.monthStart} to {data.today}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-lg font-semibold">{(grandTotal / 60).toFixed(1)}h</div>
          <div className="text-xs text-ks-muted">Total</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{(grandBillable / 60).toFixed(1)}h</div>
          <div className="text-xs text-ks-muted">Billable</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">€{grandValue.toFixed(0)}</div>
          <div className="text-xs text-ks-muted">Value</div>
        </div>
      </div>

      {/* Daily stacked bars */}
      {dates.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ks-muted uppercase tracking-wide mb-2">
            Last 7 Days
          </h2>
          <div className="space-y-1.5">
            {dates.map((date) => {
              const entries = dateMap[date];
              const dayTotal = entries.reduce((s, e) => s + e.totalMinutes, 0);
              return (
                <div key={date} className="flex items-center gap-2">
                  <span className="text-xs w-16 text-ks-muted">{formatShortDate(date)}</span>
                  <div className="flex-1 flex h-3 bg-gray-50 rounded overflow-hidden">
                    {entries.map((e, i) => (
                      <div
                        key={i}
                        className={`${colorMap[e.projectName]} h-full`}
                        style={{ width: `${(e.totalMinutes / maxDayMinutes) * 100}%` }}
                        title={`${e.projectName}: ${(e.totalMinutes / 60).toFixed(1)}h`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-ks-muted w-10 text-right">
                    {(dayTotal / 60).toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-2">
            {projectNames.map((name) => (
              <div key={name} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-sm ${colorMap[name]}`} />
                <span className="text-xs text-ks-muted">{name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Monthly breakdown table */}
      <section>
        <h2 className="text-sm font-medium text-ks-muted uppercase tracking-wide mb-2">
          This Month
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ks-hair">
              <th className="text-left py-1">Project</th>
              <th className="text-right py-1">Total</th>
              <th className="text-right py-1">Billable</th>
              <th className="text-right py-1">Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.monthlyByProject.map((r) => (
              <tr key={r.projectName} className="border-b border-ks-hair">
                <td className="py-1.5 font-medium">{r.projectName}</td>
                <td className="py-1.5 text-right">{(r.totalMinutes / 60).toFixed(1)}h</td>
                <td className="py-1.5 text-right">{(r.billableMinutes / 60).toFixed(1)}h</td>
                <td className="py-1.5 text-right text-ks-muted">
                  {r.hourlyRate ? `€${r.hourlyRate}/h` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right">{(grandTotal / 60).toFixed(1)}h</td>
              <td className="py-1.5 text-right">{(grandBillable / 60).toFixed(1)}h</td>
              <td className="py-1.5 text-right" />
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en", { weekday: "short", day: "numeric" });
}
