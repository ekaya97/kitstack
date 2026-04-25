import { useState } from "react";
import { useKit, useTool } from "../../sdk-view";
import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;
type Deal = Data[number];
type Stage = "prospect" | "proposal" | "negotiation" | "won" | "lost";

const STAGES: Stage[] = ["prospect", "proposal", "negotiation", "won", "lost"];

const STAGE_LABELS: Record<Stage, string> = {
  prospect: "Prospect",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const STAGE_COLORS: Record<Stage, string> = {
  prospect: "bg-ks-paper-deep text-ks-ink",
  proposal: "bg-blue-50 text-blue-800",
  negotiation: "bg-amber-50 text-amber-800",
  won: "bg-emerald-50 text-emerald-800",
  lost: "bg-red-50 text-red-800",
};

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function DealCard({ deal, onDragStart }: { deal: Deal; onDragStart: () => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white border border-ks-hair rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
    >
      <div className="font-medium text-[13px] leading-tight">{deal.name}</div>
      {deal.contactName && (
        <div className="text-ks-muted text-xs mt-0.5">{deal.contactName}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-xs font-medium text-ks-accent">
          {formatCurrency(deal.value)}
        </span>
        {deal.expectedCloseDate && (
          <span className="text-[10px] text-ks-faint">{deal.expectedCloseDate}</span>
        )}
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  deals,
  draggedDealId,
  onDragStart,
  onDrop,
}: {
  stage: Stage;
  deals: Deal[];
  draggedDealId: string | null;
  onDragStart: (id: string) => void;
  onDrop: (dealId: string, stage: Stage) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const total = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <div
      className={`flex flex-col min-w-[200px] rounded-xl transition-colors ${
        dragOver ? "bg-ks-accent-soft/40" : "bg-ks-paper-warm/60"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
        <div className="font-mono text-[11px] text-ks-muted mt-1">{formatCurrency(total)}</div>
      </div>
      <div className="flex flex-col gap-2 p-2 min-h-[100px]">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onDragStart={() => onDragStart(deal.id)} />
        ))}
        {deals.length === 0 && (
          <div className="text-[11px] text-ks-faint text-center py-6">No deals</div>
        )}
      </div>
    </div>
  );
}

export function PipelineView({ data: initialData }: { data: Data }) {
  const { data: kitData, loading, reload } = useKit<Data>();
  const updateDeal = useTool("update_deal");
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Data | null>(null);

  // Priority: optimistic (local) → reloaded (server) → initial (snapshot)
  const deals = optimistic ?? kitData ?? initialData;

  const byStage = new Map<Stage, Deal[]>();
  for (const stage of STAGES) byStage.set(stage, []);
  for (const deal of deals) {
    byStage.get(deal.stage as Stage)?.push(deal);
  }

  const totalPipeline = deals.reduce((s, d) => s + (d.value ?? 0), 0);
  const openPipeline = deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((s, d) => s + (d.value ?? 0), 0);

  const handleDrop = async (dealId: string, newStage: Stage) => {
    setDraggedDealId(null);

    // Optimistic update — move card immediately
    setOptimistic(deals.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)));

    // Persist, then reload fresh data from server
    await updateDeal.call({ dealId, stage: newStage });
    await reload();
    setOptimistic(null);
  };

  return (
    <div className={`p-4 transition-opacity ${loading ? "opacity-70" : ""}`}>
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
          <span className="font-mono font-medium">{deals.length}</span>
        </div>
        {loading && (
          <div className="ml-auto text-ks-accent animate-pulse">Syncing...</div>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            deals={byStage.get(stage) ?? []}
            draggedDealId={draggedDealId}
            onDragStart={setDraggedDealId}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {updateDeal.error && (
        <div className="mt-4 text-red-600 text-sm">{updateDeal.error}</div>
      )}
    </div>
  );
}
