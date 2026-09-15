import { useKit } from "@kitstackco/sdk/view";
import type { CustomerTimelineEvent, CustomerTimelineViewData } from "./loader";

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 16,
};

const badgeColors: Record<CustomerTimelineEvent["type"], { background: string; color: string }> = {
  prebrief: { background: "#eef2ff", color: "#3730a3" },
  call_completed: { background: "#ecfeff", color: "#155e75" },
  note: { background: "#fef3c7", color: "#92400e" },
  address_discovered: { background: "#ecfdf5", color: "#166534" },
  debrief_confirmed: { background: "#dcfce7", color: "#166534" },
};

export function CustomerTimelineView() {
  const { data } = useKit<CustomerTimelineViewData>();
  if (!data) return <div style={{ padding: 16, color: "#6b7280" }}>Customer timeline unavailable.</div>;

  return (
    <div style={{ display: "grid", gap: 12, padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827" }}>
      <div style={{ ...card, display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>Customer timeline</div>
        <h1 style={{ margin: 0, fontSize: 22 }}>{data.customer.company}</h1>
        <div>{data.customer.contactName} · {data.customer.location}</div>
        <div style={{ color: "#4b5563", fontSize: 13 }}>Session {data.sessionId}</div>
      </div>

      <div style={{ ...card, display: "grid", gap: 12 }}>
        {data.events.length === 0 && <div style={{ color: "#6b7280", fontSize: 13 }}>No customer events recorded yet.</div>}
        {data.events.map((event) => (
          <div key={event.eventId} style={{ display: "grid", gap: 6, borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ ...badgeColors[event.type], borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 700 }}>{event.type}</span>
              <time dateTime={event.occurredAt} style={{ color: "#6b7280", fontSize: 12 }}>{new Date(event.occurredAt).toLocaleString()}</time>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{event.summary}</div>
            {Object.entries(event.details).map(([key, value]) => (
              <div key={key} style={{ color: "#4b5563", fontSize: 13 }}><strong>{label(key)}:</strong> {value}</div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "#4b5563" }}>
        <span>Provider: {data.providerMetadata.providers.join(", ") || "not recorded"} · Cost: ${data.providerMetadata.estimatedCostUsd.toFixed(4)}</span>
        <span>Transcript/audio {data.privacy.transcript}/{data.privacy.audio}</span>
      </div>
    </div>
  );
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
