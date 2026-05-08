import { useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type TopContent = {
  id: string;
  title: string;
  channel: string;
  publishedDate: string | null;
  impressions: number;
  engagements: number;
  clicks: number;
};

type ChannelBreakdown = {
  channel: string;
  count: number;
  impressions: number;
  engagements: number;
};

type TrendItem = {
  month: string;
  published: number;
  engagements: number;
};

type Data = {
  totals: {
    published: number;
    impressions: number;
    engagements: number;
    clicks: number;
  };
  topContent: TopContent[];
  byChannel: ChannelBreakdown[];
  trend: TrendItem[];
};

const CHANNEL_COLORS: Record<string, string> = {
  linkedin: "bg-blue-400",
  blog: "bg-emerald-400",
  newsletter: "bg-purple-400",
  twitter: "bg-gray-400",
  instagram: "bg-pink-400",
  other: "bg-ks-faint",
};

function fmtNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export function PerformanceDashboardView() {
  const { data } = useKit<Data>();
  const d = data ?? {
    totals: { published: 0, impressions: 0, engagements: 0, clicks: 0 },
    topContent: [],
    byChannel: [],
    trend: [],
  };

  const avgEngRate =
    d.totals.impressions > 0
      ? ((d.totals.engagements / d.totals.impressions) * 100).toFixed(1)
      : "0";

  const maxEngagement = useMemo(
    () => Math.max(...d.trend.map((t) => t.engagements), 1),
    [d.trend]
  );

  const maxChannelEng = useMemo(
    () => Math.max(...d.byChannel.map((c) => c.engagements), 1),
    [d.byChannel]
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Performance</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Top-line metrics */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { label: "Published", value: d.totals.published },
          { label: "Impressions", value: fmtNum(d.totals.impressions) },
          { label: "Engagements", value: fmtNum(d.totals.engagements) },
          { label: "Eng. Rate", value: `${avgEngRate}%` },
        ].map((m) => (
          <div key={m.label} className="bg-ks-paper-warm rounded-lg p-3 text-center">
            <div className="text-[10px] text-ks-faint uppercase tracking-wider">{m.label}</div>
            <div className="font-mono text-lg font-semibold mt-0.5">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Engagement trend chart */}
      {d.trend.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] font-medium text-ks-muted uppercase tracking-wider mb-2">
            Engagement Trend (6 months)
          </div>
          <div className="flex items-end gap-2 h-20 bg-ks-paper-warm/50 rounded-lg p-2">
            {d.trend.map((t, i) => {
              const h = (t.engagements / maxEngagement) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="text-[8px] text-ks-faint font-mono">{fmtNum(t.engagements)}</div>
                  <div
                    className="w-full bg-ks-accent rounded-t"
                    style={{ height: `${Math.max(h, 2)}%` }}
                  />
                  <div className="text-[9px] text-ks-muted">{t.month}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Channel breakdown */}
      {d.byChannel.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] font-medium text-ks-muted uppercase tracking-wider mb-2">
            By Channel
          </div>
          <div className="space-y-1.5">
            {d.byChannel.map((ch) => {
              const pct = (ch.engagements / maxChannelEng) * 100;
              return (
                <div key={ch.channel} className="flex items-center gap-2">
                  <span className="text-[11px] text-ks-ink w-20 truncate">{ch.channel}</span>
                  <div className="flex-1 h-4 bg-ks-paper-warm rounded overflow-hidden">
                    <div
                      className={`h-full rounded ${CHANNEL_COLORS[ch.channel] || "bg-ks-faint"}`}
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-ks-muted w-12 text-right">
                    {fmtNum(ch.engagements)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top content table */}
      {d.topContent.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-ks-muted uppercase tracking-wider mb-2">
            Top Content
          </div>
          <div className="border border-ks-hair rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ks-paper-warm border-b border-ks-hair">
                <tr>
                  <th className="text-left px-2 py-1.5 text-[10px] font-medium text-ks-muted uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-medium text-ks-muted uppercase tracking-wider">
                    Channel
                  </th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-medium text-ks-muted uppercase tracking-wider">
                    Impr.
                  </th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-medium text-ks-muted uppercase tracking-wider">
                    Eng.
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.topContent.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/40 transition-colors"
                  >
                    <td className="px-2 py-2 font-medium truncate max-w-[200px]">{c.title}</td>
                    <td className="px-2 py-2 text-ks-muted">{c.channel}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-ks-muted">
                      {fmtNum(c.impressions)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-ks-muted">
                      {fmtNum(c.engagements)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {d.topContent.length === 0 && (
        <div className="text-center py-8 text-[11px] text-ks-faint border border-dashed border-ks-hair rounded-lg">
          No performance data yet. Publish content and log metrics to see analytics.
        </div>
      )}
    </div>
  );
}
