"use client";

import Link from "next/link";
import type { KitCardData } from "@/services/transformers";
import { CatMark } from "@/components/ui/cat-mark";
import { PipelineKanban } from "@/components/mcp-apps/pipeline-kanban";
import { ExpenseTable } from "@/components/mcp-apps/expense-table";
import { SequenceBuilder } from "@/components/mcp-apps/sequence-builder";
import { ActionTracker } from "@/components/mcp-apps/action-tracker";

const demos: Record<string, React.ReactNode> = {
  "crm-kit": <PipelineKanban compact />,
  "expense-tax-prep-kit": <ExpenseTable rows={4} />,
  "cold-outreach-kit": <SequenceBuilder />,
  "meeting-action-tracker-kit": <ActionTracker />,
};

export function KitPreviewCard({ kit }: { kit: KitCardData }) {
  return (
    <div className="ks-card p-5 flex flex-col">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <CatMark cat={kit.cat} />
          <div className="font-serif text-2xl tracking-tight">{kit.name}</div>
        </div>
        <div className="font-sans text-xs text-ks-accent">
          replaces &euro;{kit.replacesValue}/mo &darr;
        </div>
      </div>
      <div className="font-sans text-[13px] text-ks-muted mb-3.5">
        {kit.tagline}
      </div>
      <div className="bg-ks-paper-warm rounded-lg p-3 border border-ks-hair">
        <div className="font-mono text-[9px] text-ks-muted tracking-wide mb-2">
          &#9635; LIVE PREVIEW &middot; {kit.uiComponents[0]}
        </div>
        {demos[kit.slug]}
      </div>
      <div className="flex flex-wrap justify-between items-center gap-2 mt-3.5">
        <div className="font-mono text-[11px] text-ks-muted">
          Persistent data &middot; interactive dashboards
        </div>
        <Link href={`/kits/${kit.slug}`} className="ks-btn !text-xs !py-1.5 !px-3">
          Open kit &rarr;
        </Link>
      </div>
    </div>
  );
}
