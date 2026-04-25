import { useKit, useTool } from "../../sdk-view";
import type { LoaderData } from "../../sdk";
import type pipelineView from "./index";

type Data = LoaderData<typeof pipelineView>;

const STAGES = ["prospect", "proposal", "negotiation", "won", "lost"] as const;

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-ks-paper-deep",
  proposal: "bg-blue-50",
  negotiation: "bg-amber-50",
  won: "bg-emerald-50",
  lost: "bg-red-50",
};

export function PipelineView() {
  const { data, reload } = useKit<Data>();
  const updateDeal = useTool("update_deal", { invalidate: reload });

  // Group deals by stage
  const byStage = new Map<string, Data>();
  for (const stage of STAGES) byStage.set(stage, []);
  for (const deal of data) {
    byStage.get(deal.stage)?.push(deal);
  }

  const totalPipeline = data.reduce((s, d) => s + (d.value ?? 0), 0);
  const openPipeline = data
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((s, d) => s + (d.value ?? 0), 0);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="font-serif text-xl">Pipeline</h1>
        <div className="text-sm text-ks-muted">
          Total: €{totalPipeline.toLocaleString()} · Open: €{openPipeline.toLocaleString()} · {data.length} deals
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto">
        {STAGES.map((stage) => {
          const stageDeals = byStage.get(stage) ?? [];
          const stageValue = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0);

          return (
            <div key={stage} className="flex-1 min-w-[200px]">
              <div className={`rounded-t px-3 py-2 text-sm font-medium ${STAGE_COLORS[stage]}`}>
                {STAGE_LABELS[stage]} ({stageDeals.length}) · €{stageValue.toLocaleString()}
              </div>
              <div className="border border-t-0 border-ks-hair rounded-b min-h-[200px] space-y-2 p-2">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="bg-white border border-ks-hair rounded p-2 text-sm shadow-sm"
                  >
                    <div className="font-medium">{deal.name}</div>
                    {deal.contactName && (
                      <div className="text-xs text-ks-muted">{deal.contactName}</div>
                    )}
                    <div className="flex justify-between mt-1 text-xs">
                      <span className="font-mono">
                        {deal.value ? `€${deal.value.toLocaleString()}` : "—"}
                      </span>
                      {deal.expectedCloseDate && (
                        <span className="text-ks-faint">{deal.expectedCloseDate}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {updateDeal.error && (
        <div className="mt-4 text-red-600 text-sm">{updateDeal.error}</div>
      )}
    </div>
  );
}
