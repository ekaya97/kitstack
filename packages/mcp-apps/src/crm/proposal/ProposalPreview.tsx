import { useMemo } from "react";
import { marked } from "marked";
import { AppShell } from "@shared/app-shell";
import { useAppData, getParam } from "@shared/use-app-data";
import type { Proposal } from "@shared/types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-ks-paper-deep text-ks-ink",
  sent: "bg-blue-50 text-blue-800",
  accepted: "bg-emerald-50 text-emerald-800",
  rejected: "bg-red-50 text-red-800",
};

export function ProposalPreview() {
  const proposalId = getParam("proposalId");
  const { data: proposals, loading, error, refetch } = useAppData<Proposal>("proposals");

  const proposal = useMemo(
    () => proposals?.find((p) => p.id === proposalId) ?? proposals?.[0] ?? null,
    [proposals, proposalId]
  );

  const html = useMemo(() => {
    if (!proposal) return "";
    return marked.parse(proposal.content, { async: false }) as string;
  }, [proposal]);

  if (!loading && !proposal) {
    return <AppShell title="Proposal" error="No proposal found" onRetry={refetch} />;
  }

  return (
    <AppShell title="Proposal" loading={loading} error={error} onRetry={refetch}>
      {proposal && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[proposal.status]}`}>
              {proposal.status.toUpperCase()}
            </span>
            <span className="font-mono text-xs text-ks-muted">Version {proposal.version}</span>
          </div>
          <div className="bg-white border border-ks-hair rounded-lg p-6">
            <div
              className="prose prose-sm max-w-none
                prose-headings:font-serif prose-headings:text-ks-ink
                prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-ks-ink2
                prose-table:text-[12px]
                prose-th:bg-ks-paper-warm prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:font-medium
                prose-td:px-3 prose-td:py-1.5 prose-td:border-t prose-td:border-ks-hair/50
                prose-strong:text-ks-ink prose-strong:font-semibold
                prose-li:text-[13px] prose-li:text-ks-ink2"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </>
      )}
    </AppShell>
  );
}
