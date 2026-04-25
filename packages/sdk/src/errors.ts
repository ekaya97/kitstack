// --- KitStack SDK Error Hierarchy ---
// These errors are thrown during kit definition, build, or validation — not tool results.
// Tool results use kit.error() / kit.notFound() etc. from result.ts.

/**
 * Base error for all KitStack SDK errors.
 * Every error has a machine-readable code and a link to documentation.
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
 * Thrown when a kit definition is invalid (defineKit validation failures).
 * Examples: duplicate tool names, duplicate view slugs, missing required fields.
 */
export class KitValidationError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "KitValidationError";
  }
}

/**
 * Thrown when a tool definition is invalid.
 * Examples: non-snake_case name, missing/short description, missing load+handler.
 */
export class ToolValidationError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ToolValidationError";
  }
}

/**
 * Thrown when migration SQL fails to execute or validate.
 * Examples: syntax errors in SQL, conflicting table definitions.
 */
export class MigrationError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "MigrationError";
  }
}

/**
 * Thrown when a Drizzle schema definition is invalid.
 * Examples: schema/migration mismatch, missing tables referenced by tools.
 */
export class SchemaError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "SchemaError";
  }
}
