import { useKit } from "@kitstackco/sdk/view";
import type { PlatformSnapshot } from "../../plugins/platform-data.js";
import { card, Empty, Metric } from "../shared.js";

export function OverviewView() {
  const { data } = useKit<PlatformSnapshot>();
  if (!data) return <Empty>Platform data unavailable.</Empty>;
  return <div style={{ display: "grid", gap: 12, padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827" }}>
    <div><div style={{ color: "#b45309", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>KitStack platform kit</div><h1 style={{ margin: "4px 0 0", fontSize: 24 }}>Runtime overview</h1></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
      <Metric label="Sessions" value={data.sessions.length} /><Metric label="Events" value={data.aggregate.totalEvents} /><Metric label="Est. cost" value={`$${data.aggregate.totalEstimatedCostUsd.toFixed(4)}`} /><Metric label="Errors" value={data.aggregate.errorCount} />
    </div>
    <div style={{ ...card, display: "grid", gap: 7 }}><strong>Registry</strong><div>{data.apps.length} apps · {data.kits.length} kits · {data.plugins.length} plugins · {data.providerHealth.length} providers</div><small style={{ color: "#6b7280" }}>Metadata-only platform state; payloads and call content are excluded.</small></div>
  </div>;
}
