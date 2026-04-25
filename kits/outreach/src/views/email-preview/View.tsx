import { useState, useMemo } from "react";
import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;
type Email = Data[number];

function highlightMergeFields(text: string): (string | JSX.Element)[] {
  if (!text) return [""];
  const parts = text.split(/(\{[^}]+\})/g);
  return parts.map((part, i) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      return (
        <span
          key={i}
          className="inline-block px-1 py-0.5 rounded bg-ks-accent-soft text-ks-accent-deep font-mono text-xs font-medium"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

function renderBody(body: string): JSX.Element[] {
  if (!body) return [];
  return body.split("\n").map((line, i) => (
    <p key={i} className={line.trim() === "" ? "h-3" : "leading-relaxed"}>
      {highlightMergeFields(line)}
    </p>
  ));
}

function getMergeFields(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\{[^}]+\}/g);
  return matches ? [...new Set(matches)] : [];
}

export function EmailPreviewView({ data }: { data: Data }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const email = useMemo(() => {
    if (data.length === 0) return null;
    if (selectedId) return data.find((e) => e.id === selectedId) ?? data[0];
    return data[0];
  }, [data, selectedId]);

  const mergeFields = useMemo(() => {
    if (!email) return [];
    return getMergeFields((email.subject || "") + " " + (email.body || ""));
  }, [email]);

  if (!email) {
    return (
      <div className="p-4 text-center text-ks-faint py-8 text-sm">
        No emails to preview
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl">
      <h1 className="font-serif text-xl mb-4">Email Preview</h1>

      {mergeFields.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[10px] text-ks-faint uppercase tracking-wider">
            Merge fields:
          </span>
          {mergeFields.map((field) => (
            <span
              key={field}
              className="text-[10px] px-2 py-0.5 rounded-full bg-ks-accent-soft text-ks-accent-deep font-mono"
            >
              {field}
            </span>
          ))}
        </div>
      )}

      <div className="bg-white border border-ks-hair rounded-lg overflow-hidden">
        <div className="border-b border-ks-hair px-4 py-3 bg-ks-paper-warm/50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-ks-faint uppercase tracking-wider">
              Subject
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-ks-paper-deep text-ks-muted">
              Step {email.position} · +{email.delayDays}d
            </span>
          </div>
          <div className="text-[15px] font-medium text-ks-ink leading-snug">
            {highlightMergeFields(email.subject)}
          </div>
        </div>

        <div className="px-4 py-4 text-sm text-ks-ink2">
          {renderBody(email.body)}
        </div>
      </div>

      {data.length > 1 && (
        <div className="mt-4">
          <div className="text-[10px] text-ks-faint uppercase tracking-wider mb-2">
            All emails in sequence
          </div>
          <div className="flex gap-2 flex-wrap">
            {data.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  e.id === email.id
                    ? "border-ks-accent bg-ks-accent-soft text-ks-accent-deep font-medium"
                    : "border-ks-hair hover:bg-ks-paper-warm text-ks-muted"
                }`}
              >
                Step {e.position}: +{e.delayDays}d
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
