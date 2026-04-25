import { describe, it, expect } from "vitest";
import {
  KitStackError,
  KitValidationError,
  ToolValidationError,
  MigrationError,
  SchemaError,
  AuthError,
} from "../src/errors";

describe("KitStackError", () => {
  it("sets code, message, and docUrl", () => {
    const err = new KitStackError("TEST_CODE", "something broke");
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("something broke");
    expect(err.docUrl).toBe("https://docs.kitstack.dev/errors/TEST_CODE");
  });

  it("has name KitStackError", () => {
    const err = new KitStackError("X", "y");
    expect(err.name).toBe("KitStackError");
  });

  it("is instanceof Error", () => {
    const err = new KitStackError("X", "y");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("KitValidationError", () => {
  it("is instanceof KitStackError", () => {
    const err = new KitValidationError("KIT_DUPLICATE_TOOLS", "dupe");
    expect(err).toBeInstanceOf(KitStackError);
    expect(err).toBeInstanceOf(KitValidationError);
  });

  it("has name KitValidationError", () => {
    const err = new KitValidationError("X", "y");
    expect(err.name).toBe("KitValidationError");
  });

  it("inherits code and docUrl from base", () => {
    const err = new KitValidationError("KIT_DUPLICATE_VIEWS", "msg");
    expect(err.code).toBe("KIT_DUPLICATE_VIEWS");
    expect(err.docUrl).toBe("https://docs.kitstack.dev/errors/KIT_DUPLICATE_VIEWS");
  });
});

describe("ToolValidationError", () => {
  it("is instanceof KitStackError but not KitValidationError", () => {
    const err = new ToolValidationError("TOOL_INVALID_NAME", "bad name");
    expect(err).toBeInstanceOf(KitStackError);
    expect(err).not.toBeInstanceOf(KitValidationError);
  });

  it("has name ToolValidationError", () => {
    const err = new ToolValidationError("X", "y");
    expect(err.name).toBe("ToolValidationError");
  });
});

describe("MigrationError", () => {
  it("is instanceof KitStackError", () => {
    const err = new MigrationError("MIGRATION_FAILED", "bad sql");
    expect(err).toBeInstanceOf(KitStackError);
  });

  it("has name MigrationError", () => {
    expect(new MigrationError("X", "y").name).toBe("MigrationError");
  });
});

describe("SchemaError", () => {
  it("is instanceof KitStackError", () => {
    const err = new SchemaError("SCHEMA_TABLE_MISMATCH", "mismatch");
    expect(err).toBeInstanceOf(KitStackError);
  });

  it("has name SchemaError", () => {
    expect(new SchemaError("X", "y").name).toBe("SchemaError");
  });
});

describe("AuthError", () => {
  it("is instanceof KitStackError", () => {
    const err = new AuthError("AUTH_TOKEN_EXPIRED", "expired");
    expect(err).toBeInstanceOf(KitStackError);
  });

  it("has name AuthError", () => {
    expect(new AuthError("X", "y").name).toBe("AuthError");
  });
});
