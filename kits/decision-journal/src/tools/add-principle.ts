import { z } from "zod";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { principles } from "../schema";

export const addPrinciple = defineTool({
  name: "add_principle",
  description: "Extract and save a personal decision-making principle — a reusable lesson learned from past decisions",
  args: z.object({
    title: z.string().describe("The principle in one sentence (e.g., \"Don't make financial decisions when tired\")"),
    description: z.string().optional().describe("Longer explanation of the principle and when it applies"),
    derived_from: z.string().optional().describe("Decision ID (dec_xxx) that led to this principle"),
  }),
  handler: async (db, args) => {
    const id = `pri_${nanoid()}`;
    const now = new Date().toISOString();

    await db.insert(principles).values({
      id,
      title: args.title,
      description: args.description ?? null,
      derivedFrom: args.derived_from ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return kit.result(kit.created(id, "principle", `Principle saved: "${args.title}"`));
  },
});
