import { useState, useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import type { Meeting } from "@shared/types";

export function MeetingHistory() {
  const { data: meetings, loading, error, refetch } = useAppData<Meeting>("meetings");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!meetings) return [];
    return [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  }, [meetings]);

  return (
    <AppShell title="Meeting History" loading={loading} error={error} onRetry={refetch}>
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div>
          <span className="text-ks-muted">Meetings: </span>
          <span className="font-mono font-medium">{meetings?.length ?? 0}</span>
        </div>
        <div>
          <span className="text-ks-muted">Total actions: </span>
          <span className="font-mono font-medium">
            {meetings?.reduce((s, m) => s + m.action_items.length, 0) ?? 0}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map((meeting) => {
          const isExpanded = expandedId === meeting.id;
          return (
            <div key={meeting.id} className="border border-ks-hair rounded-lg overflow-hidden">
              {/* Card header */}
              <div
                className="flex items-center justify-between p-3 bg-ks-paper-warm/60 cursor-pointer hover:bg-ks-paper-warm transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
              >
                <div>
                  <div className="font-medium text-[13px] text-ks-ink">{meeting.title}</div>
                  <div className="text-xs text-ks-muted mt-0.5 font-mono">{meeting.date}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full bg-ks-paper-deep text-ks-muted">
                      {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? "s" : ""}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {meeting.action_items.length} action{meeting.action_items.length !== 1 ? "s" : ""}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      {meeting.decisions.length} decision{meeting.decisions.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-ks-faint text-xs">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-ks-hair p-4">
                  {/* Attendees */}
                  <div className="mb-3">
                    <div className="text-[10px] text-ks-faint uppercase tracking-wider mb-1">Attendees</div>
                    <div className="text-sm text-ks-muted">{meeting.attendees.join(", ")}</div>
                  </div>

                  {/* Summary */}
                  {meeting.summary && (
                    <div className="mb-3">
                      <div className="text-[10px] text-ks-faint uppercase tracking-wider mb-1">Summary</div>
                      <p className="text-sm text-ks-ink2 leading-relaxed">{meeting.summary}</p>
                    </div>
                  )}

                  {/* Decisions */}
                  {meeting.decisions.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] text-ks-faint uppercase tracking-wider mb-1">Decisions</div>
                      <ul className="flex flex-col gap-1">
                        {meeting.decisions.map((d) => (
                          <li key={d.id} className="flex items-start gap-2 text-sm">
                            <span className="text-emerald-600 mt-0.5 shrink-0">&bull;</span>
                            <span>{d.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action items */}
                  {meeting.action_items.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] text-ks-faint uppercase tracking-wider mb-1">Action Items</div>
                      <div className="flex flex-col gap-1">
                        {meeting.action_items.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between text-sm py-1 ${
                              item.status === "overdue" ? "text-red-600" : ""
                            }`}
                          >
                            <span className={item.status === "done" ? "line-through text-ks-faint" : ""}>
                              {item.description}
                            </span>
                            <span className="text-xs text-ks-muted ml-2 shrink-0">
                              {item.owner} &middot; {item.deadline}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Open questions */}
                  {meeting.open_questions.length > 0 && (
                    <div>
                      <div className="text-[10px] text-ks-faint uppercase tracking-wider mb-1">Open Questions</div>
                      <ul className="flex flex-col gap-1">
                        {meeting.open_questions.map((q, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-amber-600 mt-0.5 shrink-0">?</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center text-ks-faint py-8 text-sm">No meetings yet</div>
        )}
      </div>
    </AppShell>
  );
}
