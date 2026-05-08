import { useState, useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type Decision = {
  id: string;
  title: string;
  category: string | null;
  confidence: string | null;
  stakes: string | null;
  decidedAt: string;
  context: string;
  decision: string;
  reasoning: string;
  reversibility: string | null;
  outcome: string | null;
};

type Data = Decision[];

const CATEGORY_COLORS: Record<string, string> = {
  business: "bg-blue-100 text-blue-800",
  product: "bg-violet-100 text-violet-800",
  hiring: "bg-amber-100 text-amber-800",
  financial: "bg-emerald-100 text-emerald-800",
  personal: "bg-rose-100 text-rose-800",
  strategy: "bg-indigo-100 text-indigo-800",
};

const OUTCOME_DOT: Record<string, string> = {
  good: "bg-emerald-400",
  mixed: "bg-amber-400",
  bad: "bg-red-400",
  too_early: "bg-gray-300",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  high: "text-emerald-700",
  medium: "text-amber-700",
  low: "text-red-700",
};

export function TimelineView() {
  const { data } = useKit<Data>();
  const items = data ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const cats = new Set(items.map((d) => d.category).filter(Boolean) as string[]);
    return ["all", ...cats];
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((d) => d.category === filter);
  }, [items, filter]);

  if (items.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[200px] gap-2">
        <p className="text-ks-muted text-sm">No decisions logged yet</p>
        <p className="text-ks-faint text-xs">Start by telling me about a decision you've made</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Decision Timeline</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Total</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{items.length}</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">With Outcome</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{items.filter((d) => d.outcome).length}</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Pending Review</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{items.filter((d) => !d.outcome).length}</div>
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 2 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                filter === cat
                  ? "bg-ks-ink text-white border-ks-ink"
                  : "border-ks-hair text-ks-muted hover:bg-ks-paper-warm"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="flex flex-col gap-1">
        {filtered.map((d) => {
          const isExpanded = expandedId === d.id;
          return (
            <div key={d.id} className="border-b border-ks-hair/30 last:border-0">
              <button
                onClick={() => setExpandedId(isExpanded ? null : d.id)}
                className="w-full flex items-center gap-2 py-2 text-left hover:bg-ks-paper-warm/50 transition-colors rounded px-1"
              >
                {/* Outcome dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${d.outcome ? OUTCOME_DOT[d.outcome] ?? "bg-gray-300" : "border border-ks-hair"}`} />

                {/* Title & date */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{d.title}</div>
                  <div className="text-[10px] text-ks-faint">{d.decidedAt.slice(0, 10)}</div>
                </div>

                {/* Category badge */}
                {d.category && (
                  <span className={`px-2 py-0.5 text-[10px] rounded-full ${CATEGORY_COLORS[d.category] ?? "bg-gray-100 text-gray-700"}`}>
                    {d.category}
                  </span>
                )}

                {/* Confidence */}
                {d.confidence && (
                  <span className={`text-[10px] font-medium ${CONFIDENCE_BADGE[d.confidence] ?? ""}`}>
                    {d.confidence}
                  </span>
                )}

                <span className="text-ks-faint text-xs">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-3 text-[12px] text-ks-muted space-y-2">
                  <div>
                    <span className="font-medium text-ks-ink">Context: </span>
                    {d.context}
                  </div>
                  <div>
                    <span className="font-medium text-ks-ink">Decision: </span>
                    {d.decision}
                  </div>
                  <div>
                    <span className="font-medium text-ks-ink">Reasoning: </span>
                    {d.reasoning}
                  </div>
                  <div className="flex gap-4 text-[11px] text-ks-faint pt-1">
                    {d.stakes && <span>Stakes: {d.stakes}</span>}
                    {d.reversibility && <span>Reversibility: {d.reversibility.replace(/_/g, " ")}</span>}
                    {d.outcome && <span>Outcome: {d.outcome}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
