/**
 * KitStack SDK error hierarchy.
 *
 * These are SDK-level errors (thrown during kit definition, build, or validation),
 * NOT tool result errors. Tool results use `kit.error()` / `kit.notFound()` etc.
 *
 * Each error carries a machine-readable `code` and a `docUrl` linking to the
 * relevant docs page. Catch specific subclasses to handle different failure modes.
 *
 * @example
 * ```typescript
 * import { KitStackError, ToolValidationError } from "@kitstackdev/kit";
 *
 * try {
 *   const kit = defineKit({ ... });
 * } catch (err) {
 *   if (err instanceof ToolValidationError) {
 *     console.error(`Tool problem [${err.code}]: ${err.message}`);
 *     console.error(`See: ${err.docUrl}`);
 *   } else if (err instanceof KitStackError) {
 *     console.error(`SDK error [${err.code}]: ${err.message}`);
 *   }
 * }
 * ```
 */

/**
 * Base class for all KitStack SDK errors.
 *
 * Every SDK error carries a machine-readable `code` (e.g. `"TOOL_MISSING_IMPL"`)
 * and a `docUrl` pointing to `https://docs.kitstack.dev/errors/{code}`. Catch
 * this class to handle any SDK error generically, or catch a subclass for
 * specific failure categories.
 *
 * This is never thrown for tool-execution problems visible to the LLM — those
 * use `kit.error()` and return a `KitToolResult` with `isError: true`.
 *
 * @example
 * ```typescript
 * import { KitStackError } from "@kitstackdev/kit";
 *
 * try {
 *   const myKit = defineKit(config);
 * } catch (err) {
 *   if (err instanceof KitStackError) {
 *     // err.code  — e.g. "KIT_DUPLICATE_TOOLS"
 *     // err.docUrl — e.g. "https://docs.kitstack.dev/errors/KIT_DUPLICATE_TOOLS"
 *     console.error(`[${err.code}] ${err.message}`);
 *   }
 * }
 * ```
 */
export class KitStackError extends Error {
  readonly code: string;
  readonly docUrl: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "KitStackError";
    this.code = code;
    this.docUrl = `https://docs.kitstack.dev/errors/${code}`;
  }
}

/**
 * Thrown when a kit definition has structural problems detected by `defineKit()`.
 *
 * Common codes:
 * - `KIT_DUPLICATE_TOOLS` — two tools share the same name
 * - `KIT_DUPLICATE_VIEWS` — two views share the same slug
 * - `KIT_INVALID_VIEW_SLUG` — a view slug is not kebab-case
 *
 * @example
 * ```typescript
 * import { defineKit, KitValidationError } from "@kitstackdev/kit";
 *
 * // This throws KitValidationError with code "KIT_DUPLICATE_TOOLS"
 * // because addContact is listed twice.
 * defineKit({
 *   id: "crm",
 *   version: "1.0.0",
 *   name: "CRM Kit",
 *   description: "Full CRM with contacts, deals, pipeline, and proposals",
 *   schema,
 *   migrationSql,
 *   instructions: crmInstructions,
 *   tools: [addContact, addContact, listContacts],
 *   //      ^^^^^^^^^^  ^^^^^^^^^^ duplicate name "add_contact"
 * });
 * ```
 */
export class KitValidationError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "KitValidationError";
  }
}

/**
 * Thrown when a tool definition has problems detected by `defineKit()` validation.
 *
 * Common codes:
 * - `TOOL_MISSING_IMPL` — tool has neither `load()` nor `handler()`
 * - `TOOL_INVALID_NAME` — tool name is not snake_case
 * - `TOOL_SHORT_DESCRIPTION` — tool description is under 10 characters
 *
 * @example
 * ```typescript
 * import { defineTool, defineKit, ToolValidationError } from "@kitstackdev/kit";
 * import { z } from "zod";
 *
 * // This tool has a camelCase name, which is invalid.
 * const badTool = defineTool({
 *   name: "addContact",  // should be "add_contact"
 *   description: "Add a new contact to the CRM",
 *   args: z.object({ name: z.string() }),
 *   handler: async (db, args) => kit.text(`Added ${args.name}`),
 * });
 *
 * // defineKit() throws ToolValidationError with code "TOOL_INVALID_NAME"
 * // and suggests "add_contact" as the correct name.
 * defineKit({ ..., tools: [badTool] });
 * ```
 */
export class ToolValidationError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ToolValidationError";
  }
}

/**
 * Thrown when SQL migration statements fail during `createTestKit()` setup
 * or production database provisioning.
 *
 * The error message includes the failing SQL statement (truncated to 80 chars)
 * and the underlying SQLite error.
 *
 * Common code:
 * - `MIGRATION_FAILED` — a SQL statement in `migrationSql` could not be executed
 *
 * @example
 * ```typescript
 * import { createTestKit } from "@kitstackdev/kit/testing";
 * import { MigrationError } from "@kitstackdev/kit";
 * import myKit from "./kit.config";
 *
 * try {
 *   const testKit = await createTestKit(myKit);
 * } catch (err) {
 *   if (err instanceof MigrationError) {
 *     // err.code    — "MIGRATION_FAILED"
 *     // err.message — includes the failing SQL + SQLite error
 *     console.error("Migration broke:", err.message);
 *   }
 * }
 * ```
 */
export class MigrationError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "MigrationError";
  }
}

/**
 * Thrown when the Drizzle schema definition has structural problems.
 *
 * This surfaces during build or validation when the schema object passed
 * to `defineKit()` cannot be reconciled with the migration SQL or has
 * missing/invalid table definitions.
 *
 * @example
 * ```typescript
 * import { SchemaError } from "@kitstackdev/kit";
 *
 * // SchemaError is thrown during build when the Drizzle schema
 * // references tables that don't exist in the migration SQL.
 * // For example, if schema.ts exports a `contacts` table but
 * // migrationSql only creates an `expenses` table:
 * //
 * // SchemaError { code: "SCHEMA_TABLE_MISMATCH", message: "..." }
 * ```
 */
export class SchemaError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "SchemaError";
  }
}

/**
 * Thrown when CLI authentication fails.
 *
 * This covers expired tokens, invalid credentials, and network failures
 * during `kitstack login` or any command that requires an authenticated
 * session with the KitStack platform.
 *
 * @example
 * ```typescript
 * import { AuthError } from "@kitstackdev/kit";
 *
 * // AuthError is thrown by CLI commands when the session is invalid:
 * //
 * // AuthError { code: "AUTH_TOKEN_EXPIRED", message: "..." }
 * //
 * // Re-authenticate with: kitstack login
 * ```
 */
export class AuthError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "AuthError";
  }
}
