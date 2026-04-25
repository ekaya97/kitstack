/**
 * KitStack SDK error hierarchy.
 *
 * These are SDK-level errors (thrown during kit definition, build, or validation),
 * NOT tool result errors. Tool results use kit.error() / kit.notFound() etc.
 *
 * Each error carries a machine-readable code and a link to the relevant docs page.
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

/** Kit definition problems (duplicate tools, invalid view slugs, etc.) */
export class KitValidationError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "KitValidationError";
  }
}

/** Tool definition problems (missing impl, bad name, short description, etc.) */
export class ToolValidationError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ToolValidationError";
  }
}

/** SQL migration failures (invalid SQL, table conflicts, etc.) */
export class MigrationError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "MigrationError";
  }
}

/** Schema definition problems (invalid Drizzle schema, missing tables, etc.) */
export class SchemaError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "SchemaError";
  }
}

/** CLI authentication failures (expired token, invalid credentials, etc.) */
export class AuthError extends KitStackError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "AuthError";
  }
}
