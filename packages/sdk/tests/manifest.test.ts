import { describe, expect, it } from "vitest";
import {
  McpManifestError,
  parseMcpServerManifest,
  resolveMcpPassthrough,
} from "../src/server/manifest";

const manifest = parseMcpServerManifest({
  apiVersion: "kitstack.dev/v1alpha1",
  kind: "McpServer",
  id: "salesforce",
  name: "Salesforce MCP",
  version: "1.2.0",
  namespace: "crm",
  tools: [{
    name: "get_customer",
    description: "Fetch one customer by name.",
    inputSchema: { type: "object", properties: { name: { type: "string" } } },
    permissionClass: "read",
    locked: true,
    memoryNamespaces: ["crm/customer"],
  }],
});

describe("MCP server manifest", () => {
  it("validates a data-only manifest and maps a kit command to tools/call", () => {
    expect(manifest.tools[0]).toMatchObject({ name: "get_customer", locked: true });
    expect(resolveMcpPassthrough(manifest, "get_customer", { name: "Acme" })).toEqual({
      serverId: "salesforce",
      request: {
        method: "tools/call",
        params: { name: "get_customer", arguments: { name: "Acme" } },
      },
    });
  });

  it("rejects duplicate tools and unknown passthrough commands", () => {
    expect(() => parseMcpServerManifest({
      ...manifest,
      tools: [...manifest.tools, manifest.tools[0]],
    })).toThrowError(McpManifestError);
    expect(() => resolveMcpPassthrough(manifest, "delete_customer")).toThrowError(
      /Unknown tool "delete_customer"/,
    );
  });

  it("preserves the real input schema for partial-call discovery", () => {
    expect(manifest.tools[0]?.inputSchema).toEqual({
      type: "object",
      properties: { name: { type: "string" } },
    });
  });
});
