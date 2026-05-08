import { useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type ReviewItem = {
  id: string;
  title: string;
  category: string | null;
  confidence: string | null;
  decidedAt: string;
  reviewDate: string | null;
  context: string;
  decision: string;
};

type Data = ReviewItem[];

const CATEGORY_COLORS: Record<string, string> = {
  business: "bg-blue-100 text-blue-800",
  product: "bg-violet-100 text-violet-800",
  hiring: "bg-amber-100 text-amber-800",
  financial: "bg-emerald-100 text-emerald-800",
  personal: "bg-rose-100 text-rose-800",
  strategy: "bg-indigo-100 text-indigo-800",
};

export function ReviewQueueView() {
  const { data } = useKit<Data>();
  const items = data ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const { overdue, upcoming, later } = useMemo(() => ({
    overdue: items.filter((i) => i.reviewDate! < today),
    upcoming: items.filter((i) => i.reviewDate! >= today && i.reviewDate! <= weekAhead),
    later: items.filter((i) => i.reviewDate! > weekAhead),
  }), [items, today, weekAhead]);

  if (items.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[200px] gap-2">
        <p className="text-ks-muted text-sm">No reviews scheduled</p>
        <p className="text-ks-faint text-xs">When you log decisions with review dates, they'll appear here</p>
      </div>
    );
  }

  const renderSection = (title: string, list: ReviewItem[], isOverdue: boolean) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-5">
        <h2 className="font-serif text-base mb-2">{title}</h2>
        <div className="flex flex-col gap-1">
          {list.map((item) => (
            <div key={item.id} className="flex items-start gap-2 py-2 border-b border-ks-hair/30 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-[13px]">
                  <span className="font-medium">{item.title}</span>
                </div>
                <div className="text-[11px] text-ks-faint mt-0.5">
                  Decided {item.decidedAt.slice(0, 10)} · {item.decision.slice(0, 60)}{item.decision.length > 60 ? "…" : ""}
                </div>
              </div>
              {item.category && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full shrink-0 ${CATEGORY_COLORS[item.category] ?? "bg-gray-100 text-gray-700"}`}>
                  {item.category}
                </span>
              )}
              <span className={`text-[10px] font-medium whitespace-nowrap ${isOverdue ? "text-red-700" : "text-ks-faint"}`}>
                {item.reviewDate}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Review Queue</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className={overdue.length > 0 ? "bg-red-50 rounded-lg p-3" : "bg-ks-paper-warm rounded-lg p-3"}>
          <div className={`text-[10px] uppercase tracking-wider ${overdue.length > 0 ? "text-red-600" : "text-ks-faint"}`}>Overdue</div>
          <div className={`font-mono text-lg font-semibold mt-0.5 ${overdue.length > 0 ? "text-red-800" : ""}`}>{overdue.length}</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">This Week</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{upcoming.length}</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Later</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{later.length}</div>
        </div>
      </div>

      {renderSection(`Overdue (${overdue.length})`, overdue, true)}
      {renderSection(`This Week (${upcoming.length})`, upcoming, false)}
      {renderSection(`Later (${later.length})`, later, false)}
    </div>
  );
}
