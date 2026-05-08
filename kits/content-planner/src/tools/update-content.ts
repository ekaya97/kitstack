import { z } from "zod";
import { eq, like } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { content } from "../schema";

export const updateContent = defineTool({
  name: "update_content",
  description:
    "Update a content piece — change status, body, scheduled date, or mark as published. TRIGGER: user wants to edit, reschedule, or publish content.",
  args: z.object({
    content: z.string().describe("Content ID (cnt_xxx) or title for fuzzy match"),
    status: z
      .enum(["draft", "review", "scheduled", "published", "repurposed"])
      .optional()
      .describe("New status"),
    body: z.string().optional().describe("Updated body text"),
    title: z.string().optional().describe("Updated title"),
    scheduled_date: z.string().optional().describe("Updated scheduled date (YYYY-MM-DD)"),
    published_date: z.string().optional().describe("Actual publication date (YYYY-MM-DD)"),
    published_url: z.string().optional().describe("Link to the published piece"),
    notes: z.string().optional().describe("Additional notes or context"),
    tags: z.string().optional().describe("Updated comma-separated tags"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();

    // Resolve content by ID or fuzzy title match
    let contentId: string;
    if (args.content.startsWith("cnt_")) {
      const exists = await db
        .select({ id: content.id })
        .from(content)
        .where(eq(content.id, args.content))
        .limit(1);
      if (exists.length === 0) return kit.error(`Content "${args.content}" not found.`);
      contentId = args.content;
    } else {
      const matches = await db
        .select({ id: content.id, title: content.title })
        .from(content)
        .where(like(content.title, `%${args.content}%`))
        .limit(5);

      if (matches.length === 0) return kit.error(`No content found matching "${args.content}".`);
      if (matches.length > 1) {
        const list = matches.map((c) => `• ${c.title} (${c.id})`).join("\n");
        return kit.text(`Multiple pieces match. Please specify:\n${list}`);
      }
      contentId = matches[0].id;
    }

    const updates: Record<string, unknown> = { updatedAt: now };
    if (args.status !== undefined) updates.status = args.status;
    if (args.body !== undefined) updates.body = args.body;
    if (args.title !== undefined) updates.title = args.title;
    if (args.scheduled_date !== undefined) updates.scheduledDate = args.scheduled_date;
    if (args.published_date !== undefined) updates.publishedDate = args.published_date;
    if (args.published_url !== undefined) updates.publishedUrl = args.published_url;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.tags !== undefined) updates.tags = args.tags;

    // Auto-set published_date when status moves to published
    if (args.status === "published" && !args.published_date) {
      updates.publishedDate = now.split("T")[0];
    }

    await db.update(content).set(updates).where(eq(content.id, contentId));

    const changes = Object.keys(updates)
      .filter((k) => k !== "updatedAt")
      .join(", ");
    return kit.result(kit.updated(contentId, "content", `Content updated: ${changes}.`));
  },
});
