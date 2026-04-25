import type { KitToolResult } from "./types";

export const kit = {
  text: (text: string): KitToolResult => ({
    content: [{ type: "text", text }],
  }),

  error: (text: string): KitToolResult => ({
    content: [{ type: "text", text }],
    isError: true,
  }),

  json: (data: unknown): KitToolResult => ({
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  }),

  notFound: (entity: string, id: string): KitToolResult => ({
    content: [{ type: "text", text: `${entity} with id "${id}" not found` }],
    isError: true,
  }),

  validationError: (message: string): KitToolResult => ({
    content: [{ type: "text", text: `Validation error: ${message}` }],
    isError: true,
  }),

  conflict: (message: string): KitToolResult => ({
    content: [{ type: "text", text: `Conflict: ${message}` }],
    isError: true,
  }),
};
