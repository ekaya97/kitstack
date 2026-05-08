import { describe, it, expect, afterEach } from "vitest";
import { createTestKit } from "@kitstackco/sdk/testing";
import kit from "../kit.config";

describe("content-planner tools", async () => {
  const testKit = await createTestKit(kit);

  afterEach(async () => {
    await testKit.reset();
  });

  it("lists ideas (empty)", async () => {
    const result = await testKit.call("list_ideas", {});
    expect(result.isError).toBeUndefined();
  });

  it("captures an idea", async () => {
    const result = await testKit.call("capture_idea", {
      title: "Write about AI workflows",
      topic: "AI",
      target_channel: "linkedin",
    });
    expect(result.isError).toBeUndefined();

    const listResult = await testKit.call("list_ideas", {});
    expect(listResult.isError).toBeUndefined();
  });

  it("creates content from idea", async () => {
    await testKit.call("capture_idea", {
      title: "Pricing strategies",
      topic: "freelancing",
    });

    const result = await testKit.call("create_content", {
      title: "How I Price My Consulting",
      channel: "blog",
      format: "article",
      idea: "Pricing",
    });
    expect(result.isError).toBeUndefined();
  });

  it("lists content (empty)", async () => {
    const result = await testKit.call("list_content", {});
    expect(result.isError).toBeUndefined();
  });

  it("adds a topic", async () => {
    const result = await testKit.call("add_topic", {
      name: "AI",
      description: "Artificial intelligence tools and workflows",
    });
    expect(result.isError).toBeUndefined();
  });
});
