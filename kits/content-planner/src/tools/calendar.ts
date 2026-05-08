import { z } from "zod";
import { isNull, and, gte, lte, or, SQL } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import type { KitContext } from "@kitstackco/sdk";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { content } from "../schema";

const calendarArgs = z.object({
  period: z
    .enum(["this_week", "next_week", "this_month"])
    .optional()
    .default("this_week")
    .describe("Time period to show"),
});

function getRange(period: string): { start: string; end: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "this_week": {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        start: monday.toISOString().split("T")[0],
        end: sunday.toISOString().split("T")[0],
        label: `This week (${monday.toISOString().split("T")[0]} – ${sunday.toISOString().split("T")[0]})`,
      };
    }
    case "next_week": {
      const dayOfWeek = now.getDay();
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + 7);
      const nextSun = new Date(nextMon);
      nextSun.setDate(nextMon.getDate() + 6);
      return {
        start: nextMon.toISOString().split("T")[0],
        end: nextSun.toISOString().split("T")[0],
        label: `Next week (${nextMon.toISOString().split("T")[0]} – ${nextSun.toISOString().split("T")[0]})`,
      };
    }
    case "this_month": {
      const lastDay = new Date(y, m + 1, 0).getDate();
      return {
        start: `${y}-${String(m + 1).padStart(2, "0")}-01`,
        end: `${y}-${String(m + 1).padStart(2, "0")}-${lastDay}`,
        label: `${now.toLocaleString("en", { month: "long" })} ${y}`,
      };
    }
    default:
      return getRange("this_week");
  }
}

async function loadCalendar(
  db: LibSQLDatabase,
  args: z.infer<typeof calendarArgs>,
  ctx: KitContext
) {
  const { start, end, label } = getRange(args.period);

  const rows = await db
    .select()
    .from(content)
    .where(
      and(
        isNull(content.archivedAt),
        or(
          and(gte(content.scheduledDate, start), lte(content.scheduledDate, end)),
          and(gte(content.publishedDate, start), lte(content.publishedDate, end))
        )
      )
    );

  return { rows, label, start, end };
}

export const calendar = defineTool({
  name: "calendar",
  description:
    "Show publishing schedule for a period — what's scheduled, what's been published. TRIGGER: user asks about their content schedule or calendar.",
  args: calendarArgs,
  handler: async (db, args, ctx) => {
    const { rows, label, start, end } = await loadCalendar(db, args, ctx);

    if (rows.length === 0) return kit.text(`No content scheduled or published for ${label}.`);

    // Group by date
    const byDate = new Map<string, typeof rows>();
    for (const r of rows) {
      const date = r.scheduledDate || r.publishedDate || "unscheduled";
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(r);
    }

    const sortedDates = [...byDate.keys()].sort();
    let text = `**${label}** — ${rows.length} piece(s)\n\n`;

    for (const date of sortedDates) {
      const items = byDate.get(date)!;
      const dayName = new Date(date + "T12:00:00").toLocaleDateString("en", { weekday: "short" });
      text += `**${dayName} ${date}**\n`;
      for (const item of items) {
        const icon = channelIcon(item.channel);
        const badge = item.status === "published" ? "✓" : "◦";
        text += `${badge} ${icon} ${item.title} (${item.format || item.channel})\n`;
      }
      text += "\n";
    }

    return kit.text(text);
  },
});

function channelIcon(channel: string): string {
  switch (channel) {
    case "linkedin":
      return "[LI]";
    case "blog":
      return "[Blog]";
    case "newsletter":
      return "[NL]";
    case "twitter":
      return "[X]";
    case "instagram":
      return "[IG]";
    default:
      return `[${channel}]`;
  }
}
