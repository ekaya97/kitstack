import { useState, useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import { ACTION_STATUS_COLORS, type ActionItem } from "@shared/types";

type Filter = "all" | "open" | "mine" | "overdue";

export function ActionTracker() {
  const { data: items, loading, error, refetch } = useAppData<ActionItem>("action_items");
  const [filter, setFilter] = useState<Filter>("all");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatus = (item: ActionItem): ActionItem["status"] => {
    if (checkedItems.has(item.id) || item.status === "done") return "done";
    return item.status;
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const status = getStatus(item);
      switch (filter) {
        case "open":
          return status === "open" || status === "overdue";
        case "mine":
          return item.owner === "You";
        case "overdue":
          return status === "overdue";
        default:
          return true;
      }
    });
  }, [items, filter, checkedItems]);

  const counts = useMemo(() => {
    if (!items) return { all: 0, open: 0, mine: 0, overdue: 0 };
    return {
      all: items.length,
      open: items.filter((i) => getStatus(i) === "open" || getStatus(i) === "overdue").length,
      mine: items.filter((i) => i.owner === "You").length,
      overdue: items.filter((i) => getStatus(i) === "overdue").length,
    };
  }, [items, checkedItems]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "mine", label: "Mine" },
    { key: "overdue", label: "Overdue" },
  ];

  return (
    <AppShell title="Action Tracker" loading={loading} error={error} onRetry={refetch}>
      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              filter === f.key
                ? "border-ks-accent bg-ks-accent-soft text-ks-accent-deep"
                : "border-ks-hair hover:bg-ks-paper-warm text-ks-muted"
            }`}
          >
            {f.label}
            <span className="ml-1 font-mono text-[10px]">
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="border border-ks-hair rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper-warm border-b border-ks-hair">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Action</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Owner</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Deadline</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Status</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Meeting</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const status = getStatus(item);
              return (
                <tr
                  key={item.id}
                  className={`border-b border-ks-hair/50 transition-colors ${
                    status === "overdue" ? "bg-red-50/40" : "hover:bg-ks-paper-warm/40"
                  }`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={status === "done"}
                      onChange={() => toggleItem(item.id)}
                      className="w-3.5 h-3.5 rounded border-ks-hair text-ks-accent focus:ring-ks-accent cursor-pointer"
                    />
                  </td>
                  <td className={`px-3 py-2.5 ${status === "done" ? "line-through text-ks-faint" : ""}`}>
                    {item.description}
                  </td>
                  <td className="px-3 py-2.5 text-ks-muted text-xs">
                    {item.owner === "You" ? (
                      <span className="font-medium text-ks-accent">{item.owner}</span>
                    ) : (
                      item.owner
                    )}
                  </td>
                  <td className={`px-3 py-2.5 font-mono text-xs ${status === "overdue" ? "text-red-600 font-medium" : "text-ks-muted"}`}>
                    {item.deadline}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ACTION_STATUS_COLORS[status]}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ks-muted">{item.meeting_title ?? "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ks-faint">
                  {filter !== "all" ? "No items match this filter" : "No action items yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-ks-faint">
        {filtered.length} of {items?.length ?? 0} action items
      </div>
    </AppShell>
  );
}
