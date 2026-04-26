import { useState } from "react";
import { useFile } from "../../sdk-view";
import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-ks-paper-deep text-ks-ink",
  sent: "bg-blue-50 text-blue-800",
  accepted: "bg-emerald-50 text-emerald-800",
  rejected: "bg-red-50 text-red-800",
};

export function ProposalView({ data }: { data: Data }) {
  const file = useFile();
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (data.length === 0) {
    return <div className="p-4 text-ks-muted">No proposals yet.</div>;
  }

  const proposal = data[selectedIdx];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-xl">Proposal</h1>
          {proposal.dealName && (
            <span className="text-sm text-ks-muted">for {proposal.dealName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[proposal.status] ?? ""}`}>
            {proposal.status.toUpperCase()}
          </span>
          <span className="font-mono text-xs text-ks-muted">Version {proposal.version}</span>
          <button
            onClick={() => file.copy(proposal.content)}
            className="border border-ks-hair rounded-lg px-2 py-1 text-xs text-ks-muted hover:bg-ks-paper-warm transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      {data.length > 1 && (
        <div className="flex gap-1 mb-4">
          {data.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setSelectedIdx(i)}
              className={`text-xs px-2 py-1 rounded-lg border ${
                i === selectedIdx
                  ? "border-ks-accent bg-ks-accent-soft text-ks-accent-deep"
                  : "border-ks-hair text-ks-muted hover:bg-ks-paper-warm"
              }`}
            >
              v{p.version} — {p.dealName ?? "unknown deal"}
            </button>
          ))}
        </div>
      )}

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
        >
          <pre className="whitespace-pre-wrap font-sans">{proposal.content}</pre>
        </div>
      </div>

      {file.feedback && (
        <div className="fixed bottom-4 right-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
          {file.feedback}
        </div>
      )}
    </div>
  );
}
