import type { KitToolResult } from "./types";

/**
 * Result helpers for tool handlers. Use these instead of constructing
 * `KitToolResult` objects manually — they ensure the correct MCP content
 * block format and set `isError` appropriately.
 *
 * @example
 * ```typescript
 * import { kit } from "@kitstack/sdk";
 *
 * // Success — plain text for the LLM
 * return kit.text(`Contact "${args.name}" added (ID: ${id}).`);
 *
 * // Success — structured JSON (auto-stringified)
 * return kit.json({ id, name, deals: 3 });
 *
 * // Error — entity not found
 * return kit.notFound("contact", args.contactId);
 *
 * // Error — validation failure
 * return kit.validationError("Email is required when source is 'inbound'");
 *
 * // Error — conflict
 * return kit.conflict("Deal is archived and cannot be modified");
 * ```
 */
export const kit = {
  /** Return a plain text result for the LLM to read. */
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
