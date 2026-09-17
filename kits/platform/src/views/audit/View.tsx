import { useKit } from "@kitstackco/sdk/view";
import type { PlatformAuditStatus } from "../../plugins/platform-data.js";
import { Empty, Metric } from "../shared.js";

export function AuditStatusView() {
  const { data } = useKit<PlatformAuditStatus>();
  if (!data) return <Empty>Audit status unavailable.</Empty>;

  return <div style={{ display: "grid", gap: 12, padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827" }}>
    <div>
      <h1 style={{ margin: 0, fontSize: 24 }}>Audit status</h1>
      <p style={{ color: "#6b7280", fontSize: 13 }}>Metadata-only evidence for the selected organization.</p>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      <Metric label="Status" value={data.status} />
      <Metric label="Events covered" value={data.eventCount} />
      <Metric label="Evidence mode" value={data.mode} />
      <Metric label="External export" value={data.externalExport} />
    </div>
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
      <strong>Latest evidence</strong>
      <div style={{ marginTop: 6, color: "#4b5563", fontSize: 13 }}>
        {data.lastEventAt ? new Date(data.lastEventAt).toLocaleString() : "No metadata events reported."}
      </div>
      <small style={{ display: "block", marginTop: 8, color: "#6b7280" }}>
        Prompts, completions, transcripts, audio, and tool payloads are excluded. External export is not reported by this host.
      </small>
    </div>
  </div>;
}
