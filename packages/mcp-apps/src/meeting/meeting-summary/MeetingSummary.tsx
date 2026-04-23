import { useState, useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData, getParam } from "@shared/use-app-data";
import { ACTION_STATUS_COLORS, type Meeting, type ActionItem } from "@shared/types";

export function MeetingSummary() {
  const { data: meetings, loading, error, refetch } = useAppData<Meeting>("meetings");
  const meetingId = getParam("meetingId");

  const meeting = useMemo(() => {
    if (!meetings) return null;
    if (meetingId) return meetings.find((m) => m.id === meetingId) ?? meetings[0] ?? null;
    return meetings[0] ?? null;
  }, [meetings, meetingId]);

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatus = (item: ActionItem): ActionItem["status"] => {
    if (checkedItems.has(item.id) || item.status === "done") return "done";
    return item.status;
  };

  return (
    <AppShell title="Meeting Summary" loading={loading} error={error} onRetry={refetch}>
      {meeting ? (
        <div className="max-w-2xl">
          {/* Meeting header */}
          <div className="bg-ks-paper-warm rounded-lg p-4 mb-4">
            <h2 className="font-serif text-lg text-ks-ink">{meeting.title}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-ks-muted">
              <span className="font-mono">{meeting.date}</span>
              <span>&middot;</span>
              <span>{meeting.attendees.join(", ")}</span>
            </div>
            {meeting.summary && (
              <p className="text-sm text-ks-ink2 mt-2 leading-relaxed">{meeting.summary}</p>
            )}
          </div>

          {/* Decisions */}
          {meeting.decisions.length > 0 && (
            <div className="mb-4">
              <h3 className="font-serif text-base mb-2">Decisions</h3>
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3">
                <ul className="flex flex-col gap-1.5">
                  {meeting.decisions.map((d) => (
                    <li key={d.id} className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-600 mt-0.5 shrink-0">&bull;</span>
                      <span>{d.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Action items */}
          {meeting.action_items.length > 0 && (
            <div className="mb-4">
              <h3 className="font-serif text-base mb-2">Action Items</h3>
              <div className="border border-ks-hair rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-ks-paper-warm border-b border-ks-hair">
                    <tr>
                      <th className="w-8 px-3 py-2"></th>
                      <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Action</th>
                      <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Owner</th>
                      <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Deadline</th>
                      <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meeting.action_items.map((item) => {
                      const status = getStatus(item);
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-ks-hair/50 transition-colors ${
                            status === "overdue" ? "bg-red-50/40" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={status === "done"}
                              onChange={() => toggleItem(item.id)}
                              className="w-3.5 h-3.5 rounded border-ks-hair text-ks-accent focus:ring-ks-accent cursor-pointer"
                            />
                          </td>
                          <td className={`px-3 py-2.5 ${status === "done" ? "line-through text-ks-faint" : ""}`}>
                            {item.description}
                          </td>
                          <td className="px-3 py-2.5 text-ks-muted text-xs">{item.owner}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-ks-muted">{item.deadline}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ACTION_STATUS_COLORS[status]}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Open questions */}
          {meeting.open_questions.length > 0 && (
            <div>
              <h3 className="font-serif text-base mb-2">Open Questions</h3>
              <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3">
                <ul className="flex flex-col gap-1.5">
                  {meeting.open_questions.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-600 mt-0.5 shrink-0">?</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-ks-faint py-8 text-sm">No meeting selected</div>
      )}
    </AppShell>
  );
}
