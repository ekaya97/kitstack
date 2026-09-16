import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { defineLoader } from "../src/define-loader";
import { defineView } from "../src/define-view";
import type { ViewHost } from "../src/types";

const loader = defineLoader(async () => ({ title: "hello" }));

function host(kind: ViewHost["kind"]): ViewHost {
  return {
    kind,
    size: { width: 640, height: 480 },
    navigate: vi.fn(),
    identity: { principal: "test-user", actor: "test-user" },
    theme: { mode: "light" },
  };
}

describe("defineView host contract", () => {
  it("passes a typed chat host to the public renderer", () => {
    const view = defineView({
      id: "chat-view",
      name: "Chat View",
      description: "renders in chat",
      loaders: [loader],
      render: (data, viewHost) =>
        createElement("output", { "data-host-kind": viewHost.kind }, data.title),
    });

    const rendered = view.render({ title: "hello" }, host("chat")) as any;
    expect(view.id).toBe("chat-view");
    expect(view.slug).toBe("chat-view");
    expect(view.loaders[0]).toBe(loader);
    expect(rendered.props["data-host-kind"]).toBe("chat");
  });

  it("passes a typed shell host through the generated component adapter", () => {
    const view = defineView({
      id: "shell-view",
      name: "Shell View",
      description: "renders in the dashboard shell",
      loaders: [loader],
      render: (_data, viewHost) =>
        createElement("output", {
          "data-host-kind": viewHost.kind,
          "data-width": viewHost.size.width,
          "data-theme": viewHost.theme.mode,
        }),
    });

    const Component = view.component as (props: { data: { title: string }; host: ViewHost }) => any;
    const rendered = Component({ data: { title: "hello" }, host: host("shell") });
    expect(rendered.props["data-host-kind"]).toBe("shell");
    expect(rendered.props["data-width"]).toBe(640);
    expect(rendered.props["data-theme"]).toBe("light");
  });

  it("normalizes the legacy shape without changing router-facing fields", () => {
    const view = defineView({
      slug: "legacy-view",
      name: "Legacy View",
      description: "kept for existing kits during migration",
      loader,
      component: ((props: { data: { title: string } }) =>
        createElement("output", null, props.data.title)) as any,
    });

    expect(view.id).toBe("legacy-view");
    expect(view.loaders).toEqual([loader]);
    expect(view.render({ title: "hello" }, host("chat"))).toBeTruthy();
  });
});
