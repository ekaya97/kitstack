import { useState } from "react";
import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;
type Sequence = Data[number];
type Email = Sequence["emails"][number];

function EmailCard({ email }: { email: Email }) {
  const bodyPreview = (email.body || "")
    .split("\n")
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-ks-accent text-white flex items-center justify-center text-xs font-mono font-medium shrink-0">
          {email.position}
        </div>
        <div className="w-px flex-1 bg-ks-hair" />
      </div>
      <div className="flex-1 bg-white border border-ks-hair rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-ks-paper-deep text-ks-muted">
            +{email.delayDays}d
          </span>
          <span className="text-[13px] font-medium text-ks-ink truncate">
            {email.subject}
          </span>
        </div>
        <p className="text-xs text-ks-muted leading-relaxed line-clamp-2">
          {bodyPreview}
        </p>
      </div>
    </div>
  );
}

function SequenceCard({
  sequence,
  isExpanded,
  onToggle,
}: {
  sequence: Sequence;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-4">
      <div
        className="flex items-center justify-between bg-ks-paper-warm rounded-lg p-3 cursor-pointer hover:bg-ks-paper-deep transition-colors"
        onClick={onToggle}
      >
        <div>
          <div className="font-medium text-[13px] text-ks-ink">{sequence.name}</div>
          <div className="text-xs text-ks-muted mt-0.5">
            {sequence.emails.length} emails · {sequence.prospectCount} prospects
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              sequence.status === "active"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-ks-paper-deep text-ks-muted"
            }`}
          >
            {sequence.status}
          </span>
          <span className="text-ks-faint text-xs">
            {isExpanded ? "\u25B2" : "\u25BC"}
          </span>
        </div>
      </div>

      {isExpanded && sequence.emails.length > 0 && (
        <div className="mt-3 ml-2">
          {sequence.emails.map((email) => (
            <EmailCard key={email.id} email={email} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SequenceBuilderView({ data }: { data: Data }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const activeCount = data.filter((s) => s.status === "active").length;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl">Sequence Builder</h1>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-ks-muted">Sequences: </span>
            <span className="font-mono font-medium">{data.length}</span>
          </div>
          <div>
            <span className="text-ks-muted">Active: </span>
            <span className="font-mono font-medium text-emerald-700">
              {activeCount}
            </span>
          </div>
        </div>
      </div>

      {data.map((seq) => (
        <SequenceCard
          key={seq.id}
          sequence={seq}
          isExpanded={expandedId === seq.id}
          onToggle={() =>
            setExpandedId(expandedId === seq.id ? null : seq.id)
          }
        />
      ))}

      {data.length === 0 && (
        <div className="text-center text-ks-faint py-8 text-sm">
          No sequences yet
        </div>
      )}
    </div>
  );
}
