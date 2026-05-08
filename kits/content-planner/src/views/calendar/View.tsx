import { useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type ContentItem = {
  id: string;
  title: string;
  channel: string;
  format: string | null;
  status: string | null;
  scheduledDate: string | null;
  publishedDate: string | null;
};

type Data = {
  items: ContentItem[];
  month: number;
  year: number;
  monthStart: string;
  monthEnd: string;
  lastDay: number;
};

const CHANNEL_COLORS: Record<string, { bg: string; text: string }> = {
  linkedin: { bg: "bg-blue-100", text: "text-blue-700" },
  blog: { bg: "bg-emerald-100", text: "text-emerald-700" },
  newsletter: { bg: "bg-purple-100", text: "text-purple-700" },
  twitter: { bg: "bg-gray-100", text: "text-gray-700" },
  instagram: { bg: "bg-pink-100", text: "text-pink-700" },
  other: { bg: "bg-ks-paper-deep", text: "text-ks-ink" },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView() {
  const { data } = useKit<Data>();
  const d = data ?? { items: [], month: 0, year: 2026, monthStart: "", monthEnd: "", lastDay: 30 };

  const grid = useMemo(() => {
    const firstDow = new Date(d.year, d.month, 1).getDay();
    const offset = (firstDow + 6) % 7; // Monday-based

    const days: { day: number | null; items: ContentItem[] }[] = [];
    // Leading empty cells
    for (let i = 0; i < offset; i++) days.push({ day: null, items: [] });
    // Actual days
    for (let day = 1; day <= d.lastDay; day++) {
      const dateStr = `${d.year}-${String(d.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayItems = d.items.filter(
        (it) => it.scheduledDate === dateStr || it.publishedDate === dateStr
      );
      days.push({ day, items: dayItems });
    }
    return days;
  }, [d]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">
          {MONTH_NAMES[d.month]} {d.year}
        </h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {["draft", "scheduled", "published", "review"].map((status) => {
          const count = d.items.filter((it) => it.status === status).length;
          return (
            <div key={status} className="bg-ks-paper-warm rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] text-ks-faint uppercase tracking-wider">{status}</div>
              <div className="font-mono text-lg font-semibold mt-0.5">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="border border-ks-hair rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-ks-paper-warm border-b border-ks-hair">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="text-[10px] font-medium text-ks-muted uppercase tracking-wider text-center py-1.5"
            >
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell, i) => {
            const dateStr = cell.day
              ? `${d.year}-${String(d.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`
              : "";
            const isToday = dateStr === todayStr;

            return (
              <div
                key={i}
                className={`min-h-[72px] border-b border-r border-ks-hair/50 p-1 ${
                  cell.day === null ? "bg-ks-paper-warm/30" : ""
                } ${isToday ? "bg-ks-accent-soft/30" : ""}`}
              >
                {cell.day !== null && (
                  <>
                    <div
                      className={`text-[10px] mb-0.5 ${
                        isToday ? "font-bold text-ks-accent" : "text-ks-muted"
                      }`}
                    >
                      {cell.day}
                    </div>
                    {cell.items.map((it) => {
                      const colors = CHANNEL_COLORS[it.channel] ?? CHANNEL_COLORS.other;
                      return (
                        <div
                          key={it.id}
                          className={`${colors.bg} ${colors.text} text-[9px] leading-tight px-1 py-0.5 rounded mb-0.5 truncate`}
                          title={`${it.title} (${it.channel})`}
                        >
                          {it.status === "published" ? "✓ " : ""}
                          {it.title}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Channel legend */}
      <div className="flex gap-3 mt-2 flex-wrap">
        {Object.entries(CHANNEL_COLORS)
          .filter(([ch]) => ch !== "other")
          .map(([ch, colors]) => (
            <div key={ch} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${colors.bg}`} />
              <span className="text-[10px] text-ks-faint">{ch}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
