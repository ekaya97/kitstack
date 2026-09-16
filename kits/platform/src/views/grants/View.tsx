import { useKit } from "@kitstackco/sdk/view";
import type { PlatformGrant } from "../../plugins/platform-data.js";
import { Empty, Header, Table, Cell } from "../shared.js";

export function GrantsView() {
  const { data } = useKit<PlatformGrant[]>();
  if (!data) return <Empty>Grant data unavailable.</Empty>;
  return <div style={{ display: "grid", gap: 12, padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827" }}><div><h1 style={{ margin: 0, fontSize: 24 }}>Platform grants</h1><p style={{ color: "#6b7280", fontSize: 13 }}>Visible only to identities with telemetry and platform administration grants.</p></div>{data.length === 0 ? <Empty>No grants in this organization.</Empty> : <Table><thead><tr><Header>Subject</Header><Header>Relation</Header><Header>Resource</Header></tr></thead><tbody>{data.map((grant, index) => <tr key={`${grant.subjectType}:${grant.subjectId}:${grant.relation}:${grant.objectId}:${index}`}><Cell><strong>{grant.subjectId}</strong><br /><small>{grant.subjectType}</small></Cell><Cell><code>{grant.relation}</code></Cell><Cell><code>{grant.objectType}:{grant.objectId}</code></Cell></tr>)}</tbody></Table>}</div>;
}
