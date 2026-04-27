import type { KitToolResult } from "./types";

/**
 * A composable mutation fragment. Create with {@link kit.created},
 * {@link kit.updated}, or {@link kit.deleted}, then pass to
 * {@link kit.result} to produce a {@link KitToolResult}.
 *
 * You can also construct fragments manually for custom operation types.
 *
 * @example
 * ```typescript
 * // Using helpers
 * kit.created(id, "contact", "Contact added")
 *
 * // Manual construction
 * const fragment: KitResultFragment = {
 *   op: "created", id, entityType: "contact", message: "Contact added"
 * };
 * ```
 */
export interface KitResultFragment {
  op: string;
  id: string;
  entityType: string;
  message: string;
}

/**
 * Result helpers for tool handlers. Use these instead of constructing
 * `KitToolResult` objects manually — they ensure the correct MCP content
 * block format and set `isError` appropriately.
 *
 * For **mutations** (create, update, delete), use the composable pattern:
 * ```typescript
 * import { kit } from "@kitstack/sdk";
 *
 * // Single mutation — most tools
 * return kit.result(
 *   kit.created(id, "deal", `Deal "${name}" created — €${value}`)
 * );
 *
 * // Multiple mutations in one tool
 * return kit.result([
 *   kit.created(contactId, "contact", `Contact "${name}" added`),
 *   kit.created(dealId, "deal", `Deal "${dealName}" created`),
 *   kit.created(activityId, "activity", `Call logged`),
 * ]);
 * ```
 *
 * Mutation results include the operation, entity type, and ID in a
 * consistent format that LLMs can parse for workflow chaining. Without
 * IDs, the LLM cannot pass a created entity into a subsequent action.
 *
 * For **reads** and other non-mutation responses, use the escape hatches:
 * ```typescript
 * // Read — plain text
 * return kit.text("No contacts found.");
 *
 * // Read — structured JSON
 * return kit.json({ contacts: [...] });
 *
 * // Errors
 * return kit.notFound("contact", args.contactId);
 * return kit.validationError("Email is required");
 * return kit.conflict("Deal is archived");
 * ```
 */
export const kit = {
  // --- Mutation helpers (composable) ---

  /**
   * Create a "created" mutation fragment. Compose with {@link kit.result}.
   *
   * LLMs need entity IDs to chain multi-step workflows. Always use this
   * (not `kit.text()`) when your tool creates data.
   *
   * @param id - The created entity's ID
   * @param entityType - Entity label (e.g. "contact", "deal", "invoice")
   * @param message - Human-readable description of what was created
   */
  created: (id: string, entityType: string, message: string): KitResultFragment => ({
    op: "created", id, entityType, message,
  }),

  /**
   * Create an "updated" mutation fragment. Compose with {@link kit.result}.
   *
   * @param id - The updated entity's ID
   * @param entityType - Entity label (e.g. "contact", "deal")
   * @param message - Human-readable description of what changed
   */
  updated: (id: string, entityType: string, message: string): KitResultFragment => ({
    op: "updated", id, entityType, message,
  }),

  /**
   * Create a "deleted" mutation fragment. Compose with {@link kit.result}.
   *
   * @param id - The deleted entity's ID
   * @param entityType - Entity label (e.g. "contact", "deal")
   * @param message - Human-readable description of what was removed
   */
  deleted: (id: string, entityType: string, message: string): KitResultFragment => ({
    op: "deleted", id, entityType, message,
  }),

  /**
   * Compose one or more mutation fragments into a {@link KitToolResult}.
   *
   * The output includes a structured header per mutation (`✓ created contact abc123`)
   * followed by the developer's message. This format gives LLMs a reliable
   * way to extract entity IDs for workflow chaining.
   *
   * @param fragments - A single fragment or array of fragments
   *
   * @example
   * ```typescript
   * // Single
   * return kit.result(kit.created(id, "deal", "Deal created"));
   *
   * // Batch
   * return kit.result([
   *   kit.created(id1, "contact", "Alice added"),
   *   kit.created(id2, "deal", "Acme created"),
   * ]);
   * ```
   */
  result: (fragments: KitResultFragment | KitResultFragment[]): KitToolResult => {
    const list = Array.isArray(fragments) ? fragments : [fragments];
    const text = list
      .map((f) => `✓ ${f.op} ${f.entityType} ${f.id}\n${f.message}`)
      .join("\n\n");
    return { content: [{ type: "text", text }] };
  },

  // --- Escape hatches (return KitToolResult directly) ---

  /**
   * Return plain text. Use for read-only responses (lists, searches,
   * dashboards, descriptions).
   *
   * For mutations, use `kit.result(kit.created(...))` instead — LLMs
   * need entity IDs to chain multi-step workflows.
   */
  text: (text: string): KitToolResult => ({
    content: [{ type: "text", text }],
  }),

  /** Return an error result. Sets `isError: true`. */
  error: (text: string): KitToolResult => ({
    content: [{ type: "text", text }],
    isError: true,
  }),

  /** Return structured data as pretty-printed JSON. */
  json: (data: unknown): KitToolResult => ({
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  }),

  /** Return a "not found" error for a given entity type and ID. */
  notFound: (entity: string, id: string): KitToolResult => ({
    content: [{ type: "text", text: `${entity} with id "${id}" not found` }],
    isError: true,
  }),

  /** Return a validation error with an actionable message. */
  validationError: (message: string): KitToolResult => ({
    content: [{ type: "text", text: `Validation error: ${message}` }],
    isError: true,
  }),

  /** Return a conflict error (e.g. archived entity, duplicate name). */
  conflict: (message: string): KitToolResult => ({
    content: [{ type: "text", text: `Conflict: ${message}` }],
    isError: true,
  }),
};
