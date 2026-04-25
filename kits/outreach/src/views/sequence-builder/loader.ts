import { defineLoader } from "../../sdk";
import { eq, asc, desc } from "drizzle-orm";
import { sequences, emails, prospects } from "../../schema";

export const loader = defineLoader(async (db, ctx) => {
  const allSequences = await db
    .select()
    .from(sequences)
    .orderBy(desc(sequences.createdAt));

  const result = await Promise.all(
    allSequences.map(async (seq) => {
      const seqEmails = await db
        .select()
        .from(emails)
        .where(eq(emails.sequenceId, seq.id))
        .orderBy(asc(emails.position));

      const prospectCount = await db
        .select()
        .from(prospects)
        .where(eq(prospects.sequenceId, seq.id))
        .then((r) => r.length);

      return { ...seq, emails: seqEmails, prospectCount };
    })
  );

  return result;
});
