import { useKit } from "@kitstackco/sdk/view";

type Deal = {
  id: string;
  title: string;
  stage: string | null;
  valueCents: number | null;
  currency: string | null;
  probability: number | null;
  expectedClose: string | null;
  contactName: string | null;
  companyName: string | null;
};

type Data = Deal[];

const STAGES = ["lead", "contacted", "proposal", "negotiation", "won", "lost"] as const;

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", contacted: "Contacted", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-[#f5f0e8] text-[#6b6357]",
  contacted: "bg-[#e8f0f5] text-[#3b6b8a]",
  proposal: "bg-[#f0e8f5] text-[#6b3b8a]",
  negotiation: "bg-[#f5ede8] text-[#8a5e3b]",
  won: "bg-emerald-50 text-emerald-800",
  lost: "bg-red-50 text-red-800",
};

function fmt(cents: number | null, currency = "EUR"): string {
  if (cents == null) return "\u2014";
  return new Intl.NumberFormat("de-DE", {
    style: "currency", currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(cents / 100);
}

function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="bg-white border border-[#e8e2d9] rounded-lg p-3 hover:shadow-sm transition-shadow">
      <div className="font-medium text-[#1a1814] text-[13px] leading-tight">{deal.title}</div>
      {(deal.contactName || deal.companyName) && (
        <div className="text-[#6b6357] text-xs mt-0.5 truncate">
          {deal.contactName?.trim()}{deal.contactName && deal.companyName ? " \u00B7 " : ""}{deal.companyName}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-xs font-medium text-[#d65a2f]">
          {fmt(deal.valueCents, deal.currency ?? "EUR")}
        </span>
        {deal.expectedClose && (
          <span className="text-[10px] text-[#6b6357]/60">{deal.expectedClose.slice(0, 10)}</span>
        )}
      </div>
      {deal.probability != null && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-[#e8e2d9]">
            <div
              className={`h-1 rounded-full ${
                deal.probability > 70 ? "bg-emerald-500" : deal.probability >= 30 ? "bg-amber-500" : "bg-red-400"
              }`}
              style={{ width: `${deal.probability}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-[#6b6357]">{deal.probability}%</span>
        </div>
      )}
    </div>
  );
}

export function PipelineView() {
  const { data, loading } = useKit<Data>();
  const deals = data ?? [];

  const grouped = new Map<string, Deal[]>();
  for (const s of STAGES) grouped.set(s, []);
  for (const d of deals) {
    const stage = d.stage || "lead";
    const arr = grouped.get(stage);
    if (arr) arr.push(d);
  }

  const totalPipeline = deals.reduce((s, d) => s + (d.valueCents ?? 0), 0);
  const openPipeline = deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((s, d) => s + (d.valueCents ?? 0), 0);

  return (
    <div className="min-h-full bg-[#faf7f1] text-[#1a1814] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl tracking-tight">Pipeline</h1>
        {loading && (
          <span className="text-[10px] text-[#6b6357] tracking-widest uppercase animate-pulse">
            Updating\u2026
          </span>
        )}
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-5 mb-4 text-xs">
        <div>
          <span className="text-[#6b6357]">Total: </span>
          <span className="font-mono font-medium">{fmt(totalPipeline)}</span>
        </div>
        <div>
          <span className="text-[#6b6357]">Open: </span>
          <span className="font-mono font-medium">{fmt(openPipeline)}</span>
        </div>
        <div>
          <span className="text-[#6b6357]">Deals: </span>
          <span className="font-mono font-medium">{deals.length}</span>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const items = grouped.get(stage) || [];
          const colTotal = items.reduce((s, d) => s + (d.valueCents ?? 0), 0);

          return (
            <div
              key={stage}
              className="flex flex-col min-w-[200px] rounded-xl bg-[#f5f2ec]/60"
            >
              {/* Column header */}
              <div className="px-3 py-2.5 border-b border-[#e8e2d9]/50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_COLORS[stage]}`}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="font-mono text-[10px] text-[#6b6357]/60">{items.length}</span>
                </div>
                <div className="font-mono text-[11px] text-[#6b6357] mt-1">
                  {fmt(colTotal)}
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-2 min-h-[100px]">
                {items.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
                {items.length === 0 && (
                  <div className="text-[11px] text-[#6b6357]/40 text-center py-6">No deals</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
