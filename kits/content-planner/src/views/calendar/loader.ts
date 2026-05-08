import { defineLoader } from "@kitstackco/sdk";
import { isNull, and, gte, lte, or } from "drizzle-orm";
import { content } from "../../schema";

export const loader = defineLoader(async (db) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // Load current month
  const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const monthEnd = `${y}-${String(m + 1).padStart(2, "0")}-${lastDay}`;

  const rows = await db
    .select({
      id: content.id,
      title: content.title,
      channel: content.channel,
      format: content.format,
      status: content.status,
      scheduledDate: content.scheduledDate,
      publishedDate: content.publishedDate,
    })
    .from(content)
    .where(
      and(
        isNull(content.archivedAt),
        or(
          and(gte(content.scheduledDate, monthStart), lte(content.scheduledDate, monthEnd)),
          and(gte(content.publishedDate, monthStart), lte(content.publishedDate, monthEnd))
        )
      )
    );

  return {
    items: rows,
    month: m,
    year: y,
    monthStart,
    monthEnd,
    lastDay,
  };
});
