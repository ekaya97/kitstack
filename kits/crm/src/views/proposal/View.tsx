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
          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[proposal.status] ?? ""}`}>
            {proposal.status}
          </span>
          <span className="text-xs text-ks-faint">v{proposal.version}</span>
          <button
            onClick={() => file.copy(proposal.content)}
            className="border border-ks-hair rounded px-2 py-1 text-xs text-ks-muted hover:bg-ks-paper-warm"
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
              className={`text-xs px-2 py-1 rounded border ${
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

      <div className="prose prose-sm max-w-none border border-ks-hair rounded p-4 bg-white">
        {/* In production, parse markdown with `marked` */}
        <pre className="whitespace-pre-wrap font-sans">{proposal.content}</pre>
      </div>

      {file.feedback && (
        <div className="fixed bottom-4 right-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-3 py-2 text-sm">
          {file.feedback}
        </div>
      )}
    </div>
  );
}
