import { useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type Idea = {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  targetChannel: string | null;
  priority: string | null;
  status: string | null;
  createdAt: string;
};

type Data = Idea[];

const STATUSES = ["captured", "developing", "ready"] as const;

const STATUS_LABELS: Record<string, string> = {
  captured: "Captured",
  developing: "Developing",
  ready: "Ready",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

const CHANNEL_LABELS: Record<string, string> = {
  linkedin: "LI",
  blog: "Blog",
  newsletter: "NL",
  twitter: "X",
  instagram: "IG",
  other: "Other",
};

export function IdeasBoardView() {
  const { data } = useKit<Data>();
  const ideas = data ?? [];

  const columns = useMemo(() => {
    const grouped: Record<string, Idea[]> = { captured: [], developing: [], ready: [] };
    for (const idea of ideas) {
      const status = idea.status || "captured";
      if (grouped[status]) grouped[status].push(idea);
    }
    return grouped;
  }, [ideas]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Ideas Board</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {STATUSES.map((status) => (
          <div key={status}>
            {/* Column header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-ks-muted uppercase tracking-wider">
                {STATUS_LABELS[status]}
              </span>
              <span className="text-[10px] font-mono text-ks-faint">
                {columns[status]?.length || 0}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {(columns[status] || []).map((idea) => (
                <div
                  key={idea.id}
                  className="bg-white border border-ks-hair rounded-lg p-2.5 hover:border-ks-accent/40 transition-colors"
                >
                  <div className="font-medium text-sm text-ks-ink leading-snug mb-1.5">
                    {idea.title}
                  </div>

                  {idea.description && (
                    <div className="text-[11px] text-ks-muted leading-relaxed mb-2 line-clamp-2">
                      {idea.description}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {idea.topic && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-ks-paper-deep text-ks-ink">
                        {idea.topic}
                      </span>
                    )}
                    {idea.targetChannel && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {CHANNEL_LABELS[idea.targetChannel] || idea.targetChannel}
                      </span>
                    )}
                    {idea.priority && idea.priority !== "medium" && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full ${PRIORITY_STYLES[idea.priority] || ""}`}
                      >
                        {idea.priority}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {(columns[status] || []).length === 0 && (
                <div className="text-center py-6 text-[11px] text-ks-faint border border-dashed border-ks-hair rounded-lg">
                  No ideas yet
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-ks-faint">{ideas.length} idea(s) total</div>
    </div>
  );
}
