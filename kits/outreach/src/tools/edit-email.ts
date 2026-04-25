import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { emails } from "../schema";

export const editEmail = defineTool({
  name: "edit_email",
  description: "Edit an email in a sequence — update subject, body, or delay",
  args: z.object({
    emailId: z.string().describe("Email ID (use export_sequence to find email IDs)"),
    subject: z.string().optional().describe("New subject line"),
    body: z.string().optional().describe("New email body (plain text or markdown)"),
    delayDays: z.number().optional().describe("New delay in days after the previous email in the sequence"),
  }),
  handler: async (db, args, ctx) => {
    const existing = await db.select().from(emails).where(eq(emails.id, args.emailId)).then((r) => r[0] ?? null);
    if (!existing) return kit.notFound("Email", args.emailId);

    const updates: Record<string, unknown> = {};
    if (args.subject !== undefined) updates.subject = args.subject;
    if (args.body !== undefined) updates.body = args.body;
    if (args.delayDays !== undefined) updates.delayDays = args.delayDays;

    if (Object.keys(updates).length === 0) {
      return kit.text("No changes specified.");
    }

    await db.update(emails).set(updates).where(eq(emails.id, args.emailId));

    const changes = Object.entries(updates).map(([k, v]) => {
      if (k === "body") return "body: (updated)";
      return `${k}: ${v}`;
    }).join(", ");

    return kit.text(`Email #${existing.position} (\`${existing.id}\`) updated — ${changes}.`);
  },
});
