import { describe, expect, it } from "vitest";
import {
  createAppRegistry,
  issueAppToken,
  registerApp,
} from "../auth/index.js";
import type { TelemetryEventInput } from "../../plugins/telemetry/index.js";
import { handleProxyRequest } from "./index.js";

const SECRET = "demo-secret-that-is-at-least-32-bytes-long";

function makeTelemetry() {
  const events: TelemetryEventInput[] = [];
  return {
    events,
    append: async (event: TelemetryEventInput) => {
      events.push(event);
      return event;
    },
  };
}

async function setup(scopes = ["inference"]) {
  const registry = createAppRegistry({ secret: SECRET, now: () => 1_700_000_000_000 });
  const app = registerApp(registry, { id: "app-sales", name: "Sales", org: "org-demo", scopes });
  return { registry, token: await issueAppToken(registry, app.id) };
}

function request(token: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://demo.test/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("OpenAI-compatible demo proxy", () => {
  it("authenticates, attaches app identity, forwards the request, and meters usage/cost", async () => {
    const { registry, token } = await setup();
    const telemetry = makeTelemetry();
    const clock = [1_700_000_000_000, 1_700_000_000_125];
    let received: Request | undefined;
    const result = await handleProxyRequest(request(token, {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "prepare the debrief" }],
    }, { "x-kitstack-session-id": "session-1", "x-kitstack-parent-id": "voice-1" }), {
      registry,
      telemetry,
      now: () => clock.shift() ?? 1_700_000_000_125,
      upstream: async (upstreamRequest) => {
        received = upstreamRequest;
        return new Response(JSON.stringify({ choices: [{ message: { content: "ready" } }], usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        } }), { headers: { "content-type": "application/json" } });
      },
    });

    expect(result.response.status).toBe(200);
    expect(received?.headers.get("authorization")).toBeNull();
    expect(received?.headers.get("x-kitstack-app-id")).toBe("app-sales");
    expect(received?.headers.get("x-kitstack-org")).toBe("org-demo");
    expect(received?.headers.get("x-kitstack-scopes")).toBe("inference");
    expect(telemetry.events).toHaveLength(1);
    expect(telemetry.events[0]).toMatchObject({
      type: "inference",
      appId: "app-sales",
      orgId: "org-demo",
      sessionId: "session-1",
      parentId: "voice-1",
      requestTokens: 100,
      responseTokens: 50,
      estimatedCostUsd: 0.000045,
      latencyMs: 125,
      outcome: "success",
    });
  });

  it("rejects invalid, expired, and under-scoped tokens before calling upstream", async () => {
    let now = 1_700_000_000_000;
    const registry = createAppRegistry({ secret: SECRET, tokenTtlSeconds: 1, now: () => now });
    const app = registerApp(registry, { id: "app-sales", name: "Sales", org: "org-demo", scopes: ["observability"] });
    const token = await issueAppToken(registry, app.id);
    const telemetry = makeTelemetry();
    let calls = 0;
    const options = { registry, telemetry, upstream: async () => { calls += 1; return new Response("ok"); } };

    expect((await handleProxyRequest(request("not-a-token", {}), options)).response.status).toBe(401);
    expect((await handleProxyRequest(request(token, {}), options)).response.status).toBe(403);
    now += 2_000;
    expect((await handleProxyRequest(request(token, {}), options)).response.status).toBe(401);
    expect(calls).toBe(0);
    expect(telemetry.events).toHaveLength(0);
  });

  it("isolates app identity in upstream headers and telemetry", async () => {
    const registry = createAppRegistry({ secret: SECRET });
    const first = registerApp(registry, { id: "app-first", name: "First", org: "org-one" });
    const second = registerApp(registry, { id: "app-second", name: "Second", org: "org-two" });
    const firstToken = await issueAppToken(registry, first.id);
    const secondToken = await issueAppToken(registry, second.id);
    const telemetry = makeTelemetry();
    const identities: string[] = [];
    const options = {
      registry,
      telemetry,
      upstream: async (upstreamRequest: Request) => {
        identities.push(`${upstreamRequest.headers.get("x-kitstack-app-id")}:${upstreamRequest.headers.get("x-kitstack-org")}`);
        return new Response(JSON.stringify({ usage: { prompt_tokens: 1, completion_tokens: 1 } }), { headers: { "content-type": "application/json" } });
      },
    };
    await handleProxyRequest(request(firstToken, { model: "gpt-4o-mini", messages: [] }), options);
    await handleProxyRequest(request(secondToken, { model: "gpt-4o-mini", messages: [] }), options);

    expect(identities).toEqual(["app-first:org-one", "app-second:org-two"]);
    expect(telemetry.events.map((event) => `${event.appId}:${event.orgId}`)).toEqual([
      "app-first:org-one",
      "app-second:org-two",
    ]);
  });

  it("passes streaming responses unchanged and uses final SSE usage", async () => {
    const { registry, token } = await setup();
    const telemetry = makeTelemetry();
    const stream = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "hello" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 } })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");
    const result = await handleProxyRequest(request(token, { model: "gpt-4o-mini", messages: [] }), {
      registry,
      telemetry,
      upstream: async () => new Response(stream, { headers: { "content-type": "text/event-stream" } }),
    });

    expect(result.response.headers.get("content-type")).toContain("text/event-stream");
    expect(await result.response.text()).toBe(stream);
    for (let attempt = 0; attempt < 20 && telemetry.events.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(telemetry.events[0]).toMatchObject({ requestTokens: 12, responseTokens: 7, estimatedCostUsd: 0.000006,
      outcome: "success" });
  });

  it("never includes request or response bodies in inference telemetry", async () => {
    const { registry, token } = await setup();
    const telemetry = makeTelemetry();
    await handleProxyRequest(request(token, { model: "gpt-4o-mini", messages: [{ content: "secret prompt" }] }), {
      registry,
      telemetry,
      upstream: async () => new Response(JSON.stringify({ choices: [{ message: { content: "secret completion" } }] }), { headers: { "content-type": "application/json" } }),
    });
    const serialized = JSON.stringify(telemetry.events[0]);
    expect(serialized).not.toContain("secret prompt");
    expect(serialized).not.toContain("secret completion");
    expect(telemetry.events[0]).not.toHaveProperty("prompt");
    expect(telemetry.events[0]).not.toHaveProperty("completion");
  });
});
