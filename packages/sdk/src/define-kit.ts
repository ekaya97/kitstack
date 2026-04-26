import type { z } from "zod";
import type { KitDefinition, ToolDefinition, ViewDefinition } from "./types";
import { KitValidationError, ToolValidationError } from "./errors";

/**
 * Matches valid snake_case identifiers: starts with a lowercase letter,
 * followed by any number of lowercase-alphanumeric segments separated
 * by single underscores (e.g. `add_contact`, `list_deals`).
 *
 * Does NOT allow leading/trailing underscores, consecutive underscores,
 * or uppercase letters.
 */
const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/**
 * Matches valid kebab-case identifiers: starts with a lowercase letter,
 * followed by any number of lowercase-alphanumeric segments separated
 * by single hyphens (e.g. `pipeline`, `contact-detail`).
 */
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Emits a console warning for each top-level field in a ZodObject schema
 * that is missing a `.describe()` call. Only inspects the immediate shape —
 * nested objects are not traversed.
 *
 * @internal
 */
function warnMissingDescribe(toolName: string, schema: z.ZodType): void {
  const def = (schema as any)?._def;
  if (!def) return;

  // Only inspect ZodObject shapes
  const shape =
    typeof def.shape === "function" ? def.shape() : def.shape;
  if (!shape || typeof shape !== "object") return;

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    if (!(fieldSchema as any)?.description) {
      console.warn(
        `[kitstack] Warning: Tool "${toolName}" arg "${fieldName}" has no description. Add .describe() to help the LLM fill this field correctly.`
      );
    }
  }
}

/**
 * Validates and registers a kit definition. This is the top-level entry point
 * for every kit — it takes the kit's metadata, tools, and views, runs
 * validation on all of them, and returns a frozen {@link KitDefinition}.
 *
 * **Validations performed:**
 *
 * | Check | Error code | Scope |
 * |-------|-----------|-------|
 * | Every tool has `load()` or `handler()` | `TOOL_MISSING_IMPL` | per tool |
 * | Tool name is `snake_case` | `TOOL_INVALID_NAME` | per tool |
 * | Tool description >= 10 chars | `TOOL_SHORT_DESCRIPTION` | per tool |
 * | No duplicate tool names | `KIT_DUPLICATE_TOOLS` | kit-wide |
 * | View slug is `kebab-case` | `KIT_INVALID_VIEW_SLUG` | per view |
 * | No duplicate view slugs | `KIT_DUPLICATE_VIEWS` | kit-wide |
 *
 * **Warnings (console.warn, non-throwing):**
 * - Tool description longer than 200 chars
 * - Tool args missing `.describe()` on Zod fields
 * - Tool name includes the kit ID as a prefix (prefix is added automatically)
 *
 * @param config - The full kit configuration including tools, views, schema, and migrations.
 * @returns The validated {@link KitDefinition}, ready for use with `createKitHandler()` or `createTestKit()`.
 *
 * @throws {ToolValidationError} When a tool fails name, description, or implementation checks.
 * @throws {KitValidationError} When kit-level checks fail (duplicate names, invalid view slugs).
 *
 * @example
 * ```typescript
 * // From kits/crm/kit.config.ts
 * import { defineKit } from "@kitstack/sdk";
 * import * as schema from "./src/schema";
 * import { migrationSql } from "./src/migrations";
 * import { crmInstructions } from "./src/instructions";
 * import { addContact } from "./src/tools/add-contact";
 * import { listContacts } from "./src/tools/list-contacts";
 * import contactsView from "./src/views/contacts";
 * import pipelineView from "./src/views/pipeline";
 *
 * export default defineKit({
 *   id: "crm",
 *   version: "1.0.0",
 *   name: "CRM Kit",
 *   description: "Full CRM with contacts, deals, pipeline, and proposals",
 *   schema,
 *   migrationSql,
 *   instructions: crmInstructions,
 *   tools: [addContact, listContacts],
 *   views: [contactsView, pipelineView],
 * });
 * ```
 */
export function defineKit(config: {
  id: string;
  version: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  migrationSql?: string;
  migrationsDir?: string;
  instructions: string;
  tools: ToolDefinition[];
  views?: ViewDefinition[];
}): KitDefinition {
  for (const tool of config.tools) {
    // Validate every tool has at least load() or handler()
    if (!tool.load && !tool.handler) {
      throw new ToolValidationError(
        "TOOL_MISSING_IMPL",
        `Tool "${tool.name}" must have at least a load() or handler() function. Add load() for data-fetching tools or handler() for mutation tools.`
      );
    }

    // Validate tool name is snake_case
    if (!SNAKE_CASE_RE.test(tool.name)) {
      const suggested = tool.name
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[-\s]+/g, "_")
        .toLowerCase();
      throw new ToolValidationError(
        "TOOL_INVALID_NAME",
        `Tool name "${tool.name}" must be snake_case. Use "${suggested}" instead.`
      );
    }

    // Validate tool description min length
    if (!tool.description || tool.description.length < 10) {
      throw new ToolValidationError(
        "TOOL_SHORT_DESCRIPTION",
        `Tool "${tool.name}" description is too short (${tool.description?.length ?? 0} chars, minimum 10). Descriptions help the LLM understand when and how to use the tool.`
      );
    }

    // Warn: tool description too long
    if (tool.description.length > 200) {
      console.warn(
        `[kitstack] Warning: Tool "${tool.name}" description is long (${tool.description.length} chars). Consider being more concise.`
      );
    }

    // Warn: missing .describe() on Zod args fields
    if (tool.args) {
      warnMissingDescribe(tool.name, tool.args);
    }

    // Warn: tool name contains kit ID prefix
    if (tool.name.startsWith(`${config.id}_`)) {
      const unprefixed = tool.name.slice(config.id.length + 1);
      console.warn(
        `[kitstack] Warning: Tool "${tool.name}" should not include the kit prefix. Use "${unprefixed}" — the kit context is added automatically.`
      );
    }
  }

  // Validate unique tool names
  const toolNames = config.tools.map((t) => t.name);
  const uniqueToolNames = new Set(toolNames);
  if (uniqueToolNames.size !== toolNames.length) {
    const dupes = toolNames.filter((n, i) => toolNames.indexOf(n) !== i);
    throw new KitValidationError(
      "KIT_DUPLICATE_TOOLS",
      `Kit "${config.id}" has duplicate tool names: ${dupes.join(", ")}. Each tool name must be unique within a kit.`
    );
  }

  // Validate views
  if (config.views) {
    const slugs = config.views.map((v) => v.slug);

    // Validate unique view slugs
    const uniqueSlugs = new Set(slugs);
    if (uniqueSlugs.size !== slugs.length) {
      const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
      throw new KitValidationError(
        "KIT_DUPLICATE_VIEWS",
        `Kit "${config.id}" has duplicate view slugs: ${dupes.join(", ")}. Each view slug must be unique within a kit.`
      );
    }

    // Validate view slugs are kebab-case
    for (const view of config.views) {
      if (!KEBAB_CASE_RE.test(view.slug)) {
        const suggested = view.slug
          .replace(/([a-z])([A-Z])/g, "$1-$2")
          .replace(/[_\s]+/g, "-")
          .toLowerCase();
        throw new KitValidationError(
          "KIT_INVALID_VIEW_SLUG",
          `View slug "${view.slug}" must be kebab-case. Use "${suggested}" instead.`
        );
      }
    }
  }

  // Extract placeholder data from views so it's available to the devkit
  // server but stripped from the view definitions (keeps prod bundles lean).
  const placeholders: Record<string, unknown> = {};
  if (config.views) {
    for (const view of config.views) {
      if (view.placeholder !== undefined) {
        placeholders[view.slug] = view.placeholder;
        delete view.placeholder;
      }
    }
  }

  return {
    ...config,
    _placeholders: Object.keys(placeholders).length > 0 ? placeholders : undefined,
  };
}
