import { useMemo } from "react";
import { useKit, useTool } from "@kitstackco/sdk/view";

type FollowUp = {
  id: string;
  contactId: string;
  firstName: string;
  lastName: string | null;
  followUp: string | null;
  followUpBy: string | null;
  summary: string;
  type: string;
  occurredAt: string;
};

type Data = FollowUp[];

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞", email: "✉️", meeting: "🤝", coffee: "☕",
  linkedin: "🔗", event: "🌟", note: "📝", task: "☑️",
};

export function FollowUpsView() {
  const { data, reload } = useKit<Data>();
  const logDone = useTool("log_interaction", { invalidate: reload });
  const items = data ?? [];

  const today = new Date().toISOString().slice(0, 10);

  const { overdue, upcoming } = useMemo(() => ({
    overdue: items.filter((i) => i.followUpBy! < today),
    upcoming: items.filter((i) => i.followUpBy! >= today),
  }), [items, today]);

  const handleMarkDone = (item: FollowUp) => {
    logDone.call({
      contact: item.contactId,
      type: "note",
      summary: `Completed follow-up: ${item.followUp}`,
    });
  };

  if (items.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[200px] gap-2">
        <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
        <p className="text-ks-muted text-xs">No follow-ups due</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Follow-ups</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Total</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{items.length}</div>
        </div>
        <div className={overdue.length > 0 ? "bg-red-50 rounded-lg p-3" : "bg-ks-paper-warm rounded-lg p-3"}>
          <div className={`text-[10px] uppercase tracking-wider ${overdue.length > 0 ? "text-red-600" : "text-ks-faint"}`}>Overdue</div>
          <div className={`font-mono text-lg font-semibold mt-0.5 ${overdue.length > 0 ? "text-red-800" : ""}`}>{overdue.length}</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Upcoming</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{upcoming.length}</div>
        </div>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-5">
          <h2 className="font-serif text-base mb-2">Overdue</h2>
          <div className="flex flex-col gap-1">
            {overdue.map((item) => (
              <div key={item.id} className="flex items-start gap-2 py-1.5 border-b border-ks-hair/30 last:border-0">
                <span className="text-sm mt-0.5">{ACTIVITY_ICONS[item.type] ?? "•"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px]">
                    <span className="font-medium">{item.firstName} {item.lastName ?? ""}</span>
                    <span className="text-ks-muted"> — </span>
                    <span>{item.followUp}</span>
                  </div>
                  <div className="text-[11px] text-ks-faint mt-0.5 truncate">{item.summary}</div>
                </div>
                <span className="text-[10px] text-red-700 font-medium whitespace-nowrap">{item.followUpBy}</span>
                <button
                  onClick={() => handleMarkDone(item)}
                  className="shrink-0 px-3 py-1 text-xs font-medium rounded-full border border-ks-hair hover:bg-ks-paper-warm transition-colors"
                >
                  Done
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="font-serif text-base mb-2">Upcoming</h2>
          <div className="flex flex-col gap-1">
            {upcoming.map((item) => (
              <div key={item.id} className="flex items-start gap-2 py-1.5 border-b border-ks-hair/30 last:border-0">
                <span className="text-sm mt-0.5">{ACTIVITY_ICONS[item.type] ?? "•"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px]">
                    <span className="font-medium">{item.firstName} {item.lastName ?? ""}</span>
                    <span className="text-ks-muted"> — </span>
                    <span>{item.followUp}</span>
                  </div>
                  <div className="text-[11px] text-ks-faint mt-0.5 truncate">{item.summary}</div>
                </div>
                <span className="text-[10px] text-ks-faint whitespace-nowrap">{item.followUpBy}</span>
                <button
                  onClick={() => handleMarkDone(item)}
                  className="shrink-0 px-3 py-1 text-xs font-medium rounded-full border border-ks-hair hover:bg-ks-paper-warm transition-colors"
                >
                  Done
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
