import { describe, expect, it } from "vitest";
import kit from "../kit.config";

describe("debrief kit boundary", () => {
  it("preserves the existing kit identity and tool contract", () => {
    expect(kit.id).toBe("debrief");
    expect(kit.tools.map((tool) => tool.name)).toEqual([
      "prepare_debrief",
      "get_session",
      "get_debrief",
      "confirm_debrief",
      "teach_from_correction",
    ]);
  });

  it("keeps an unbound kit visibly unbound", async () => {
    const prepare = kit.tools.find((tool) => tool.name === "prepare_debrief");
    if (!prepare?.handler) throw new Error("prepare_debrief handler was not registered");

    const result = await prepare.handler({} as never, { goal: "test" }, {
      userId: "test-user",
      kitId: "debrief",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ type: "text" });
  });
});
