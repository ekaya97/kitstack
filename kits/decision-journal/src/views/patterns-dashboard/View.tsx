import { useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type Decision = {
  id: string;
  title: string;
  category: string | null;
  confidence: string | null;
  urgency: string | null;
  stakes: string | null;
  decidedAt: string;
};

type Outcome = {
  id: string;
  decisionId: string;
  assessment: string | null;
  wouldDecideDifferently: number | null;
};

type Principle = {
  id: string;
  title: string;
  description: string | null;
  timesReferenced: number | null;
};

type Data = { decisions: Decision[]; outcomes: Outcome[]; principles: Principle[] };

const CATEGORY_COLORS: Record<string, string> = {
  business: "bg-blue-400",
  product: "bg-violet-400",
  hiring: "bg-amber-400",
  financial: "bg-emerald-400",
  personal: "bg-rose-400",
  strategy: "bg-indigo-400",
};

const ASSESSMENT_COLORS: Record<string, string> = {
  good: "bg-emerald-400",
  mixed: "bg-amber-400",
  bad: "bg-red-400",
  too_early: "bg-gray-300",
};

export function PatternsDashboardView() {
  const { data } = useKit<Data>();
  const allDecisions = data?.decisions ?? [];
  const allOutcomes = data?.outcomes ?? [];
  const allPrinciples = data?.principles ?? [];

  const stats = useMemo(() => {
    // Outcome lookup
    const outcomeMap = new Map<string, Outcome>();
    for (const o of allOutcomes) {
      outcomeMap.set(o.decisionId, o);
    }

    // Category breakdown
    const byCategory = new Map<string, { total: number; good: number; bad: number }>();
    for (const d of allDecisions) {
      const cat = d.category || "uncategorized";
      if (!byCategory.has(cat)) byCategory.set(cat, { total: 0, good: 0, bad: 0 });
      const bucket = byCategory.get(cat)!;
      bucket.total++;
      const o = outcomeMap.get(d.id);
      if (o?.assessment === "good") bucket.good++;
      if (o?.assessment === "bad") bucket.bad++;
    }

    // Confidence calibration
    const calibration: Record<string, { good: number; bad: number; total: number }> = {
      high: { good: 0, bad: 0, total: 0 },
      medium: { good: 0, bad: 0, total: 0 },
      low: { good: 0, bad: 0, total: 0 },
    };
    for (const d of allDecisions) {
      if (!d.confidence || !outcomeMap.has(d.id)) continue;
      const o = outcomeMap.get(d.id)!;
      if (!o.assessment || o.assessment === "too_early") continue;
      const row = calibration[d.confidence];
      if (row) {
        row.total++;
        if (o.assessment === "good") row.good++;
        if (o.assessment === "bad") row.bad++;
      }
    }

    const maxCategory = Math.max(...[...byCategory.values()].map((v) => v.total), 1);
    const withOutcomes = allDecisions.filter((d) => outcomeMap.has(d.id)).length;
    const regrets = allOutcomes.filter((o) => o.wouldDecideDifferently === 1).length;

    return { byCategory, calibration, maxCategory, outcomeMap, withOutcomes, regrets };
  }, [allDecisions, allOutcomes]);

  if (allDecisions.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[200px] gap-2">
        <p className="text-ks-muted text-sm">No data yet</p>
        <p className="text-ks-faint text-xs">Log decisions and outcomes to see your patterns</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Patterns</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Decisions</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{allDecisions.length}</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">With Outcomes</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{stats.withOutcomes}</div>
        </div>
        <div className="bg-ks-paper-warm rounded-lg p-3">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider">Principles</div>
          <div className="font-mono text-lg font-semibold mt-0.5">{allPrinciples.length}</div>
        </div>
        <div className={stats.regrets > 0 ? "bg-red-50 rounded-lg p-3" : "bg-ks-paper-warm rounded-lg p-3"}>
          <div className={`text-[10px] uppercase tracking-wider ${stats.regrets > 0 ? "text-red-600" : "text-ks-faint"}`}>Regrets</div>
          <div className={`font-mono text-lg font-semibold mt-0.5 ${stats.regrets > 0 ? "text-red-800" : ""}`}>{stats.regrets}</div>
        </div>
      </div>

      {/* Category breakdown bar chart */}
      <div className="mb-5">
        <h2 className="font-serif text-base mb-3">By Category</h2>
        <div className="flex flex-col gap-2">
          {[...stats.byCategory.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([cat, { total, good, bad }]) => {
              const width = (total / stats.maxCategory) * 100;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-ks-muted capitalize">{cat}</div>
                  <div className="flex-1 h-6 bg-ks-paper-warm rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${CATEGORY_COLORS[cat] ?? "bg-gray-400"}`}
                      style={{ width: `${Math.max(width, 4)}%` }}
                    />
                  </div>
                  <div className="w-24 text-right font-mono text-[11px] text-ks-muted">
                    {total} · {good}✓ {bad}✗
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Confidence calibration */}
      {(stats.calibration.high.total > 0 || stats.calibration.medium.total > 0 || stats.calibration.low.total > 0) && (
        <div className="mb-5">
          <h2 className="font-serif text-base mb-3">Confidence Calibration</h2>
          <div className="flex flex-col gap-2">
            {(["high", "medium", "low"] as const).map((level) => {
              const row = stats.calibration[level];
              if (row.total === 0) return null;
              const hitRate = Math.round((row.good / row.total) * 100);
              const maxWidth = Math.max(stats.calibration.high.total, stats.calibration.medium.total, stats.calibration.low.total, 1);
              return (
                <div key={level} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-ks-muted capitalize">{level}</div>
                  <div className="flex-1 h-6 bg-ks-paper-warm rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-400" style={{ width: `${(row.good / maxWidth) * 100}%` }} />
                    <div className="h-full bg-amber-400" style={{ width: `${((row.total - row.good - row.bad) / maxWidth) * 100}%` }} />
                    <div className="h-full bg-red-400" style={{ width: `${(row.bad / maxWidth) * 100}%` }} />
                  </div>
                  <div className="w-20 text-right font-mono text-[11px] text-ks-muted">
                    {hitRate}% hit
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Principles */}
      {allPrinciples.length > 0 && (
        <div>
          <h2 className="font-serif text-base mb-2">Principles</h2>
          <div className="flex flex-col gap-1">
            {allPrinciples.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-ks-hair/30 last:border-0">
                <span className="text-ks-accent text-sm">◆</span>
                <span className="flex-1 text-[13px]">{p.title}</span>
                <span className="text-[10px] text-ks-faint">{p.timesReferenced ?? 0}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
