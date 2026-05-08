import { z } from "zod";
import { like } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { categories } from "../schema";

export const addCategory = defineTool({
  name: "add_category",
  description: "Add a custom expense category with optional SKR03 account mapping",
  args: z.object({
    name: z.string().describe("Category name in snake_case (e.g. coworking_space)"),
    skr03_account: z.string().optional().describe("SKR03 account number (e.g. 4930)"),
    parent_category: z.string().optional().describe("Parent category if this is a subcategory"),
  }),
  handler: async (db, args) => {
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(like(categories.name, args.name))
      .limit(1);

    if (existing.length > 0) {
      return kit.conflict(`Category "${args.name}" already exists.`);
    }

    const categoryId = `cat_${nanoid()}`;
    await db.insert(categories).values({
      id: categoryId,
      name: args.name,
      skr03Account: args.skr03_account ?? null,
      parentCategory: args.parent_category ?? null,
      isDefault: 0,
    });

    return kit.result(
      kit.created(categoryId, "category", `Category "${args.name}" added.${args.skr03_account ? ` SKR03: ${args.skr03_account}.` : ""}`)
    );
  },
});
