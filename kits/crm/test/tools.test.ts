import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createTestKit } from "@kitstackco/sdk/testing";
import kit from "../kit.config";

describe("tools", () => {
  let testKit: Awaited<ReturnType<typeof createTestKit>>;

  beforeAll(async () => {
    testKit = await createTestKit(kit);
  });

  afterEach(async () => {
    await testKit.reset();
  });

  it("lists items (empty)", async () => {
    const result = await testKit.call("list_contacts", {});
    expect(result.isError).toBeUndefined();
    const block = result.content[0];
    expect(block.type).toBe("text");
    if (block.type === "text") expect(block.text).toContain("No contacts found");
  });
});
