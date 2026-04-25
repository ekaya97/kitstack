import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, statSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

// Mock homedir to use a temp directory so we don't touch the real ~/.kitstack/
const TEST_HOME = resolve(tmpdir(), `kitstack-creds-test-${Date.now()}`);

vi.mock("node:os", async () => {
  const actual = await vi.importActual("node:os");
  return { ...actual, homedir: () => TEST_HOME };
});

// Import after mock setup
const { loadCredentials, saveCredentials, clearCredentials } = await import(
  "../src/cli/credentials"
);

beforeEach(() => {
  mkdirSync(TEST_HOME, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(TEST_HOME, { recursive: true, force: true });
  } catch {}
});

const CREDS_PATH = resolve(TEST_HOME, ".kitstack", "credentials.json");

describe("saveCredentials", () => {
  it("writes credentials to ~/.kitstack/credentials.json", () => {
    saveCredentials({
      token: "kst_abc123",
      email: "dev@example.com",
      authenticatedAt: "2026-04-25T12:00:00Z",
    });
    expect(existsSync(CREDS_PATH)).toBe(true);
    const data = JSON.parse(readFileSync(CREDS_PATH, "utf-8"));
    expect(data.token).toBe("kst_abc123");
    expect(data.email).toBe("dev@example.com");
  });

  it("creates .kitstack directory if missing", () => {
    saveCredentials({
      token: "kst_xyz",
      email: "a@b.com",
      authenticatedAt: "2026-01-01T00:00:00Z",
    });
    expect(existsSync(resolve(TEST_HOME, ".kitstack"))).toBe(true);
  });

  it("sets file permissions to 0600", () => {
    saveCredentials({
      token: "kst_secret",
      email: "a@b.com",
      authenticatedAt: "2026-01-01T00:00:00Z",
    });
    const stat = statSync(CREDS_PATH);
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

describe("loadCredentials", () => {
  it("returns credentials when file exists", () => {
    saveCredentials({
      token: "kst_load_test",
      email: "load@test.com",
      authenticatedAt: "2026-04-25T12:00:00Z",
    });
    const creds = loadCredentials();
    expect(creds).not.toBeNull();
    expect(creds!.token).toBe("kst_load_test");
    expect(creds!.email).toBe("load@test.com");
  });

  it("returns null when file does not exist", () => {
    expect(loadCredentials()).toBeNull();
  });

  it("returns null when file is malformed JSON", () => {
    mkdirSync(resolve(TEST_HOME, ".kitstack"), { recursive: true });
    writeFileSync(CREDS_PATH, "not json{{{");
    expect(loadCredentials()).toBeNull();
  });

  it("returns null when token is missing", () => {
    mkdirSync(resolve(TEST_HOME, ".kitstack"), { recursive: true });
    writeFileSync(CREDS_PATH, JSON.stringify({ email: "a@b.com" }));
    expect(loadCredentials()).toBeNull();
  });

  it("returns null when email is missing", () => {
    mkdirSync(resolve(TEST_HOME, ".kitstack"), { recursive: true });
    writeFileSync(CREDS_PATH, JSON.stringify({ token: "kst_x" }));
    expect(loadCredentials()).toBeNull();
  });
});

describe("clearCredentials", () => {
  it("clears credentials by writing empty object", () => {
    saveCredentials({
      token: "kst_to_clear",
      email: "clear@test.com",
      authenticatedAt: "2026-01-01T00:00:00Z",
    });
    clearCredentials();
    const creds = loadCredentials();
    expect(creds).toBeNull();
  });

  it("does nothing when file does not exist", () => {
    expect(() => clearCredentials()).not.toThrow();
  });
});
