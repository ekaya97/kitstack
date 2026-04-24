import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
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
  handler: async (db, args) => {
    const existing = await db.select().from(emails).where(eq(emails.id, args.emailId)).then((r: any[]) => r[0]);
    if (!existing) {
      return { content: [{ type: "text" as const, text: `Email not found. Use export_sequence to see email IDs.` }], isError: true };
    }

    const updates: Record<string, unknown> = {};
    if (args.subject !== undefined) updates.subject = args.subject;
    if (args.body !== undefined) updates.body = args.body;
    if (args.delayDays !== undefined) updates.delayDays = args.delayDays;

    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text" as const, text: "No changes specified." }] };
    }

    await db.update(emails).set(updates).where(eq(emails.id, args.emailId));

    const changes = Object.entries(updates).map(([k, v]) => {
      if (k === "body") return "body: (updated)";
      return `${k}: ${v}`;
    }).join(", ");

    return {
      content: [{ type: "text" as const, text: `Email #${existing.position} (\`${existing.id}\`) updated — ${changes}.` }],
    };
  },
});
