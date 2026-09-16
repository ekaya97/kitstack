import { describe, expect, it, vi } from "vitest";
import { CliApiClient, CliApiError } from "../src/cli/api-client";
import { parseEvalArgs } from "../src/cli/commands/eval";
import { parseGrantArgs } from "../src/cli/commands/grants";
import { parseConnectorBindArgs } from "../src/cli/commands/connectors";
import { parseSkillSpecifier, safeSkillRelativePath } from "../src/cli/commands/add";

describe("CLI operations", () => {
  it("adds auth and JSON headers through the shared API client", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toBeInstanceOf(Headers);
      const headers = init?.headers as Headers;
      expect(headers.get("authorization")).toBe("Bearer cli-token");
      expect(headers.get("content-type")).toBe("application/json");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const client = new CliApiClient({ baseUrl: "https://example.test/", token: "cli-token", fetch: fetcher });
    await expect(client.request("api/cli/grants", { method: "POST", body: "{}" })).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith("https://example.test/api/cli/grants", expect.anything());
  });

  it("normalizes API errors without leaking request bodies", async () => {
    const client = new CliApiClient({
      baseUrl: "https://example.test",
      token: "cli-token",
      fetch: async () => new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
    });
    await expect(client.request("/api/cli/grants")).rejects.toMatchObject({ status: 403, message: "forbidden" } satisfies Partial<CliApiError>);
  });

  it("parses the operation grammar and requires explicit mutation confirmation elsewhere", () => {
    expect(parseEvalArgs(["--config", "./kit", "--promote", "--json"])).toMatchObject({ json: true, promote: true });
    expect(parseGrantArgs(["list", "sales", "--subject-type", "team"])).toMatchObject({ action: "list", subjectType: "team", positional: ["sales"] });
    expect(parseConnectorBindArgs(["twilio", "--config", '{"from":"+100"}', "--secret-ref", "auth=org/twilio", "--yes"]).secretRefs).toEqual({ auth: "org/twilio" });
    expect(() => parseConnectorBindArgs(["twilio", "--config", '{"apiKey":"plaintext"}'])).toThrow(/secret-shaped/);
  });

  it("does not require credentials just to show operation help", async () => {
    const { runGrants } = await import("../src/cli/commands/grants");
    const { bindConnectorCommand } = await import("../src/cli/commands/connectors");
    const { addSkill } = await import("../src/cli/commands/add");
    await expect(runGrants(["--help"])).resolves.toBeNull();
    await expect(bindConnectorCommand(["--help"])).resolves.toBeNull();
    await expect(addSkill(["--help"])).resolves.toBeNull();
  });

  it("accepts versioned skill specifiers and rejects traversal", () => {
    expect(parseSkillSpecifier("acme/sales@1.2.0")).toEqual({ org: "acme", name: "sales", version: "1.2.0" });
    expect(() => parseSkillSpecifier("acme/sales")).toThrow(/org\/name/);
    expect(safeSkillRelativePath("references/example.md")).toBe("references/example.md");
    expect(() => safeSkillRelativePath("../outside.md")).toThrow(/escapes/);
    expect(() => safeSkillRelativePath("/absolute.md")).toThrow(/Invalid/);
  });
});
