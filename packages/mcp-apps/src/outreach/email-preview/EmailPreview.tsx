import { useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData, getParam } from "@shared/use-app-data";
import type { Email } from "@shared/types";

/** Highlight merge fields like {firstName}, {company} with accent color */
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
  const matches = text.match(/\{[^}]+\}/g);
  return matches ? [...new Set(matches)] : [];
}

export function EmailPreview() {
  const { data: emails, loading, error, refetch } = useAppData<Email>("emails");
  const emailId = getParam("emailId");

  const email = useMemo(() => {
    if (!emails) return null;
    // If emailId param is set, show that specific email. Otherwise show the first.
    if (emailId) return emails.find((e) => e.id === emailId) ?? emails[0] ?? null;
    return emails[0] ?? null;
  }, [emails, emailId]);

  const mergeFields = useMemo(() => {
    if (!email) return [];
    return getMergeFields(email.subject + " " + email.body);
  }, [email]);

  return (
    <AppShell title="Email Preview" loading={loading} error={error} onRetry={refetch}>
      {email ? (
        <div className="max-w-2xl">
          {/* Merge field indicators */}
          {mergeFields.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-[10px] text-ks-faint uppercase tracking-wider">Merge fields:</span>
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

          {/* Email preview card */}
          <div className="bg-white border border-ks-hair rounded-lg overflow-hidden">
            {/* Header */}
            <div className="border-b border-ks-hair px-4 py-3 bg-ks-paper-warm/50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-ks-faint uppercase tracking-wider">Subject</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-ks-paper-deep text-ks-muted">
                  Step {email.position} &middot; +{email.delay_days}d
                </span>
              </div>
              <div className="text-[15px] font-medium text-ks-ink leading-snug">
                {highlightMergeFields(email.subject)}
              </div>
            </div>

            {/* Body */}
            <div className="px-4 py-4 text-sm text-ks-ink2">
              {renderBody(email.body)}
            </div>
          </div>

          {/* Email selector */}
          {emails && emails.length > 1 && (
            <div className="mt-4">
              <div className="text-[10px] text-ks-faint uppercase tracking-wider mb-2">All emails in sequence</div>
              <div className="flex gap-2 flex-wrap">
                {emails.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      const params = new URLSearchParams(window.location.search);
                      params.set("emailId", e.id);
                      window.history.replaceState(null, "", `?${params}`);
                      window.location.reload();
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      e.id === email.id
                        ? "border-ks-accent bg-ks-accent-soft text-ks-accent-deep font-medium"
                        : "border-ks-hair hover:bg-ks-paper-warm text-ks-muted"
                    }`}
                  >
                    Step {e.position}: +{e.delay_days}d
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-ks-faint py-8 text-sm">No email to preview</div>
      )}
    </AppShell>
  );
}
