import { describe, expect, it } from "vitest";
import type { ViewHost } from "@kitstackco/sdk";
import kit from "../kit.config";

const host = (kind: ViewHost["kind"]): ViewHost => ({
  kind,
  size: { width: 1024, height: 720 },
  navigate: () => undefined,
  identity: { principal: "adint-user", actor: "adint-user" },
  theme: { mode: "dark" },
});

describe("adint View host compatibility", () => {
  for (const kind of ["chat", "shell"] as const) {
    it(`renders every View with the ${kind} host contract`, () => {
      for (const view of kit.views ?? []) {
        const rendered = view.render(view.placeholder as never, host(kind)) as { props?: { host?: ViewHost } };
        expect(rendered.props?.host?.kind).toBe(kind);
        expect(rendered.props?.host?.theme.mode).toBe("dark");
      }
    });
  }
});
