import { useState, useMemo } from "react";
import { useKit, useTool } from "@kitstackco/sdk/view";

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
type Stage = "lead" | "contacted" | "proposal" | "negotiation" | "won" | "lost";

const STAGES: Stage[] = ["lead", "contacted", "proposal", "negotiation", "won", "lost"];

const STAGE_LABELS: Record<Stage, string> = {
  lead: "Lead", contacted: "Contacted", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const STAGE_COLORS: Record<Stage, string> = {
  lead: "bg-ks-paper-deep text-ks-ink",
  contacted: "bg-blue-50 text-blue-800",
  proposal: "bg-blue-50 text-blue-800",
  negotiation: "bg-amber-50 text-amber-800",
  won: "bg-emerald-50 text-emerald-800",
  lost: "bg-red-50 text-red-800",
};

function formatCurrency(value: number | null, currency = "EUR"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(value / 100);
}

interface DealCardProps {
  deal: Deal;
  onDragStart: () => void;
}

function DealCard({ deal, onDragStart }: DealCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white border border-ks-hair rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
    >
      <div className="font-medium text-ks-ink text-[13px] leading-tight">{deal.title}</div>
      {deal.contactName?.trim() && (
        <div className="text-ks-muted text-xs mt-0.5">{deal.contactName.trim()}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-xs font-medium text-ks-accent">
          {formatCurrency(deal.valueCents, deal.currency ?? "EUR")}
        </span>
        {deal.expectedClose && (
          <span className="text-[10px] text-ks-faint">{deal.expectedClose}</span>
        )}
      </div>
    </div>
  );
}

interface StageColumnProps {
  stage: Stage;
  deals: Deal[];
  onDrop: (dealId: string, newStage: Stage) => void;
  draggedDealId: string | null;
  onDragStart: (dealId: string) => void;
}

function StageColumn({ stage, deals, onDrop, draggedDealId, onDragStart }: StageColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const total = deals.reduce((sum, d) => sum + (d.valueCents || 0), 0);

  return (
    <div
      className={`flex flex-col min-w-[200px] rounded-xl transition-colors ${
        dragOver ? "bg-ks-accent-soft/40" : "bg-ks-paper-warm/60"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (draggedDealId) onDrop(draggedDealId, stage);
      }}
    >
      <div className="px-3 py-2.5 border-b border-ks-hair/50">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_COLORS[stage]}`}>
            {STAGE_LABELS[stage]}
          </span>
          <span className="font-mono text-[10px] text-ks-faint">{deals.length}</span>
        </div>
        <div className="font-mono text-[11px] text-ks-muted mt-1">
          {formatCurrency(total)}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-2 min-h-[100px]">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onDragStart={() => onDragStart(deal.id)}
          />
        ))}
        {deals.length === 0 && (
          <div className="text-[11px] text-ks-faint text-center py-6">No deals</div>
        )}
      </div>
    </div>
  );
}

export function PipelineView() {
  const { data, reload } = useKit<Data>();
  const updateDeal = useTool("update_deal", { invalidate: reload });
  const deals = data ?? [];
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);

  const dealsByStage = useMemo(() => {
    const grouped = new Map<Stage, Deal[]>();
    STAGES.forEach((s) => grouped.set(s, []));
    if (deals) deals.forEach((d) => grouped.get((d.stage as Stage) || "lead")!.push(d));
    return grouped;
  }, [deals]);

  const totalPipeline = deals?.reduce((sum, d) => sum + (d.valueCents || 0), 0) ?? 0;
  const openPipeline = deals
    ?.filter((d) => !["won", "lost"].includes(d.stage ?? ""))
    .reduce((sum, d) => sum + (d.valueCents || 0), 0) ?? 0;

  const handleDrop = (dealId: string, newStage: Stage) => {
    setDraggedDealId(null);
    updateDeal.call({ deal: dealId, stage: newStage });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Pipeline</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div>
          <span className="text-ks-muted">Total: </span>
          <span className="font-mono font-medium">{formatCurrency(totalPipeline)}</span>
        </div>
        <div>
          <span className="text-ks-muted">Open: </span>
          <span className="font-mono font-medium">{formatCurrency(openPipeline)}</span>
        </div>
        <div>
          <span className="text-ks-muted">Deals: </span>
          <span className="font-mono font-medium">{deals?.length ?? 0}</span>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            deals={dealsByStage.get(stage) || []}
            onDrop={handleDrop}
            draggedDealId={draggedDealId}
            onDragStart={setDraggedDealId}
          />
        ))}
      </div>
    </div>
  );
}
