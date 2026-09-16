import { useKit } from "@kitstackco/sdk/view";
import type { PlatformSnapshot } from "../../plugins/platform-data.js";
import { Empty, Header, Metric, Table, Cell } from "../shared.js";

export function UsageFinopsView() {
  const { data } = useKit<PlatformSnapshot>();
  if (!data) return <Empty>Usage data unavailable.</Empty>;
  const proxy = data.events.filter((event) => event.channel === "proxy").length;
  return <div style={{ display: "grid", gap: 12, padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827" }}>
    <div><h1 style={{ margin: 0, fontSize: 24 }}>Usage / observability / FinOps</h1><p style={{ color: "#6b7280", fontSize: 13 }}>Proxy and runtime evidence, with content deliberately excluded.</p></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}><Metric label="Proxy requests" value={proxy} /><Metric label="Tokens" value={(data.aggregate.totalRequestTokens + data.aggregate.totalResponseTokens).toLocaleString()} /><Metric label="Latency" value={`${data.aggregate.totalLatencyMs} ms`} /><Metric label="Est. cost" value={`$${data.aggregate.totalEstimatedCostUsd.toFixed(4)}`} /></div>
    {data.events.length === 0 ? <Empty>No matching platform events.</Empty> : <Table><thead><tr><Header>Time</Header><Header>Operation</Header><Header>Channel</Header><Header>Identity</Header><Header>Usage</Header><Header>Outcome</Header></tr></thead><tbody>{data.events.map((event) => <tr key={event.id}><Cell>{new Date(event.timestamp).toLocaleString()}</Cell><Cell><strong>{event.operation}</strong><br /><small>{event.type}</small></Cell><Cell>{event.channel}</Cell><Cell><code>{event.appId ?? "boot"}</code><br /><small>{event.sessionId ?? "no session"}</small></Cell><Cell><code>{(event.requestTokens ?? 0) + (event.responseTokens ?? 0)} tokens</code><br /><small>{event.latencyMs ?? "—"} ms · ${event.estimatedCostUsd?.toFixed(4) ?? "—"}</small></Cell><Cell>{event.outcome}</Cell></tr>)}</tbody></Table>}
  </div>;
}
