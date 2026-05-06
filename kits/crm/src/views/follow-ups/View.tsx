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

const TYPE_ICONS: Record<string, string> = {
  call: "\uD83D\uDCDE",
  email: "\u2709\uFE0F",
  meeting: "\uD83E\uDD1D",
  coffee: "\u2615",
  linkedin: "\uD83D\uDD17",
  event: "\uD83C\uDF1F",
  note: "\uD83D\uDCDD",
};

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / 86400000);
}

function dueDateLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < -1) return `${Math.abs(d)} days overdue`;
  if (d === -1) return "Yesterday";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

export function FollowUpsView() {
  const { data, loading, reload } = useKit<Data>();
  const logDone = useTool("log_interaction", { invalidate: reload });
  const items = data ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const overdue = items.filter((i) => i.followUpBy! < today);
  const upcoming = items.filter((i) => i.followUpBy! >= today);

  const handleMarkDone = (item: FollowUp) => {
    logDone.call({
      contact: item.contactId,
      type: "note",
      summary: `Completed follow-up: ${item.followUp}`,
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-full bg-[#faf7f1] text-[#1a1814] p-4 flex flex-col items-center justify-center">
        <div className="text-3xl mb-3 opacity-40">{"\u2713"}</div>
        <p className="font-serif text-base text-[#6b6357]">All caught up.</p>
        <p className="text-xs text-[#6b6357]/60 mt-1">No follow-ups due</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#faf7f1] text-[#1a1814] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-xl tracking-tight">Follow-ups</h1>
          <p className="text-xs text-[#6b6357] mt-0.5">
            {overdue.length > 0 && <span className="text-red-700 font-medium">{overdue.length} overdue</span>}
            {overdue.length > 0 && upcoming.length > 0 && " \u00B7 "}
            {upcoming.length > 0 && <span>{upcoming.length} upcoming</span>}
          </p>
        </div>
        {loading && (
          <span className="text-[10px] text-[#6b6357] tracking-widest uppercase animate-pulse">
            Updating{"\u2026"}
          </span>
        )}
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-red-700 mb-2">
            Overdue
          </div>
          <div className="space-y-2">
            {overdue.map((item) => (
              <FollowUpCard key={item.id} item={item} isOverdue onMarkDone={handleMarkDone} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#6b6357] mb-2">
            Upcoming
          </div>
          <div className="space-y-2">
            {upcoming.map((item) => (
              <FollowUpCard key={item.id} item={item} isOverdue={false} onMarkDone={handleMarkDone} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FollowUpCard({
  item, isOverdue, onMarkDone,
}: {
  item: FollowUp; isOverdue: boolean; onMarkDone: (item: FollowUp) => void;
}) {
  const name = `${item.firstName} ${item.lastName ?? ""}`.trim();
  const icon = TYPE_ICONS[item.type] ?? "\uD83D\uDCCB";
  const dueLabel = item.followUpBy ? dueDateLabel(item.followUpBy) : "";

  return (
    <div
      className={`border rounded-lg p-3 ${
        isOverdue
          ? "border-red-200 bg-red-50/60"
          : "border-[#e8e2d9] bg-white/50"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="text-sm mt-0.5 shrink-0">{icon}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] font-medium text-[#1a1814]">{name}</span>
            <span className={`text-[10px] font-medium ${isOverdue ? "text-red-700" : "text-[#6b6357]"}`}>
              {dueLabel}
            </span>
          </div>
          <div className="text-[13px] text-[#1a1814] leading-snug">{item.followUp}</div>
          <div className="text-[11px] text-[#6b6357]/60 mt-1 truncate">
            {item.type} \u00B7 {item.summary}
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => onMarkDone(item)}
          className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#e8e2d9] text-[#6b6357] hover:bg-[#1a1814] hover:text-white hover:border-[#1a1814] transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
