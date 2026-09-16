import { useKit } from "@kitstackco/sdk/view";
import type { PlatformSnapshot } from "../../plugins/platform-data.js";
import { Empty, Header, Table, Cell } from "../shared.js";

export function RegistryView() {
  const { data } = useKit<PlatformSnapshot>();
  if (!data) return <Empty>Registry data unavailable.</Empty>;
  return <div style={{ display: "grid", gap: 12, padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827" }}>
    <div><h1 style={{ margin: 0, fontSize: 24 }}>Apps and plugin registry</h1><p style={{ color: "#6b7280", fontSize: 13 }}>The same registered runtime state used to attribute proxy and kit activity.</p></div>
    <Table><thead><tr><Header>Apps</Header><Header>Kits</Header><Header>Plugins</Header><Header>Providers</Header></tr></thead><tbody><tr><Cell>{data.apps.length === 0 ? "None" : data.apps.map((app) => <div key={app.id}><strong>{app.name}</strong><br /><small><code>{app.id}</code> · {app.org}</small></div>)}</Cell><Cell>{data.kits.length === 0 ? "None" : data.kits.map((kit) => <div key={kit.id}><strong>{kit.id}</strong><br /><small>{kit.version} · {kit.status}</small></div>)}</Cell><Cell>{data.plugins.length === 0 ? "None" : data.plugins.map((plugin) => <div key={plugin.id}><strong>{plugin.id}</strong><br /><small>{plugin.kind} · {plugin.version} · {plugin.status}</small></div>)}</Cell><Cell>{data.providerHealth.length === 0 ? "None" : data.providerHealth.map((provider) => <div key={provider.provider}><strong>{provider.provider}</strong><br /><small>{provider.status} · {provider.eventCount} events · {provider.errorCount} errors</small></div>)}</Cell></tr></tbody></Table>
  </div>;
}
