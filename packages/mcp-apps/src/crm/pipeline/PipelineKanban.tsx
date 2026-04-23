import { useState, useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import {
  STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  type Deal,
  type Contact,
  type Stage,
} from "@shared/types";

function formatCurrency(value: number | null, currency = "EUR"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(value);
}

interface DealCardProps {
  deal: Deal;
  contactName: string | null;
  onDragStart: () => void;
}

function DealCard({ deal, contactName, onDragStart }: DealCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white border border-ks-hair rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
    >
      <div className="font-medium text-ks-ink text-[13px] leading-tight">{deal.name}</div>
      {contactName && (
        <div className="text-ks-muted text-xs mt-0.5">{contactName}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-xs font-medium text-ks-accent">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        {deal.expected_close_date && (
          <span className="text-[10px] text-ks-faint">{deal.expected_close_date}</span>
        )}
      </div>
    </div>
  );
}

interface StageColumnProps {
  stage: Stage;
  deals: Deal[];
  contacts: Map<string, Contact>;
  onDrop: (dealId: string, newStage: Stage) => void;
  draggedDealId: string | null;
  onDragStart: (dealId: string) => void;
}

function StageColumn({ stage, deals, contacts, onDrop, draggedDealId, onDragStart }: StageColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const total = deals.reduce((sum, d) => sum + (d.value || 0), 0);

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
            contactName={deal.contact_id ? contacts.get(deal.contact_id)?.name ?? null : null}
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

export function PipelineKanban() {
  const { data: deals, loading: dealsLoading, error: dealsError, refetch } = useAppData<Deal>("deals");
  const { data: contactsRaw, loading: contactsLoading } = useAppData<Contact>("contacts");
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);

  const loading = dealsLoading || contactsLoading;
  const error = dealsError;

  const contacts = useMemo(() => {
    const map = new Map<string, Contact>();
    if (contactsRaw) contactsRaw.forEach((c) => map.set(c.id, c));
    return map;
  }, [contactsRaw]);

  const dealsByStage = useMemo(() => {
    const grouped = new Map<Stage, Deal[]>();
    STAGES.forEach((s) => grouped.set(s, []));
    if (deals) deals.forEach((d) => grouped.get(d.stage)!.push(d));
    return grouped;
  }, [deals]);

  const totalPipeline = deals?.reduce((sum, d) => sum + (d.value || 0), 0) ?? 0;
  const openPipeline = deals
    ?.filter((d) => !["won", "lost"].includes(d.stage))
    .reduce((sum, d) => sum + (d.value || 0), 0) ?? 0;

  const handleDrop = (dealId: string, newStage: Stage) => {
    // TODO: call App Data Lambda to update deal stage
    // For now, optimistic UI update
    setDraggedDealId(null);
    console.log(`Move deal ${dealId} to ${newStage}`);
  };

  return (
    <AppShell title="Pipeline" loading={loading} error={error} onRetry={refetch}>
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
            contacts={contacts}
            onDrop={handleDrop}
            draggedDealId={draggedDealId}
            onDragStart={setDraggedDealId}
          />
        ))}
      </div>
    </AppShell>
  );
}
