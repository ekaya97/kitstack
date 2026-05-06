import { describe, it, expect, afterEach } from "vitest";
import { createTestKit } from "@kitstackco/sdk/testing";
import kit from "../kit.config";

describe("tools", () => {
  const testKit = await createTestKit(kit);

  afterEach(async () => {
    await testKit.reset();
  });

  it("lists items (empty)", async () => {
    const result = await testKit.call("list_items", {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No items yet");
  });
});
