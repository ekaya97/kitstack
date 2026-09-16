import type { z } from "zod";
import type { ToolBase, ToolDefinition, KitToolResult, KitContext, AuthzRequirement } from "./types";
import { kit } from "./result";

/**
 * The typed shape returned by `defineTool` when `load()` is provided.
 * This is NOT stored in `KitDefinition` — it's the call-site return type
 * that gives callers typed access to `.load()`.
 *
 * @example
 * ```typescript
 * // The loader can call tool.load() with full type safety
 * import { listContacts } from "../tools/list-contacts";
 * import type { Infer } from "@kitstack/sdk";
 *
 * // loadContacts is the extracted load function
 * type ContactData = Infer<typeof listContacts.load>;
 * ```
 */
export interface TypedToolWithLoad<T extends z.ZodType, TData> extends ToolBase {
  load: (ctx: KitContext, args: z.infer<T>) => Promise<TData>;
  handler: (ctx: KitContext, args: z.infer<T>) => Promise<KitToolResult>;
}

/**
 * Define a tool for the kit. Tools are the primary interface between the
 * LLM and the kit's data.
 *
 * Tools have two faces:
 * - `load(ctx, args)` — returns typed data (for views and loaders)
 * - `handler(ctx, args)` — returns text/markdown (for the LLM)
 *
 * If `handler` is omitted, the framework auto-wraps `load()` with
 * `kit.json()`. This means the laziest possible tool is just
 * `name + args + load`.
 *
 * @example
 * ```typescript
 * // Read tool with both load and handler (CRM kit)
 * async function loadContacts(ctx, args) {
 *   return ctx.db.select().from(contacts).limit(args.limit);
 * }
 *
 * export const listContacts = defineTool({
 *   name: "list_contacts",
 *   description: "List all contacts in the CRM",
 *   args: z.object({ limit: z.number().optional().describe("Max results") }),
 *   load: loadContacts,
 *   handler: async (ctx, args) => {
 *     const data = await loadContacts(ctx, args);
 *     return kit.text(formatMarkdownTable(data));
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Write tool — handler only, no data layer
 * export const addContact = defineTool({
 *   name: "add_contact",
 *   description: "Add a new contact to the CRM",
 *   args: z.object({
 *     name: z.string().describe("Contact's full name"),
 *     company: z.string().optional().describe("Company name"),
 *   }),
 *   handler: async (ctx, args) => {
 *     const id = nanoid();
 *     await ctx.db.insert(contacts).values({ id, name: args.name });
 *     return kit.text(`Contact "${args.name}" added (ID: ${id}).`);
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Load-only tool — handler auto-generated with kit.json()
 * export const listProposals = defineTool({
 *   name: "list_proposals",
 *   description: "List proposals with optional deal filter",
 *   args: z.object({ dealId: z.string().optional() }),
 *   load: async (ctx, args) => {
 *     return ctx.db.select().from(proposals);
 *   },
 * });
 * ```
 */
// Overload 1: with load()
export function defineTool<T extends z.ZodType, TData>(config: {
  name: string;
  description: string;
  args: T;
  authorize?: (args: z.infer<T>, ctx: KitContext) => AuthzRequirement[];
  load: (ctx: KitContext, args: z.infer<T>) => Promise<TData>;
  handler?: (ctx: KitContext, args: z.infer<T>) => Promise<KitToolResult>;
}): TypedToolWithLoad<T, TData>;

// Overload 2: handler only (no load)
export function defineTool<T extends z.ZodType>(config: {
  name: string;
  description: string;
  args: T;
  authorize?: (args: z.infer<T>, ctx: KitContext) => AuthzRequirement[];
  handler: (ctx: KitContext, args: z.infer<T>) => Promise<KitToolResult>;
}): ToolDefinition;

// Implementation
export function defineTool(config: any): any {
  if (config.load && !config.handler) {
    config.handler = async (ctx: KitContext, args: any) => {
      const data = await config.load(ctx, args);
      return kit.json(data);
    };
  }
  return config;
}
