import { useKit } from "@kitstackco/sdk/view";
import type { PrebriefViewData } from "./loader";

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 16,
};

export function PrebriefView() {
  const { data } = useKit<PrebriefViewData>();
  if (!data) return <div style={{ padding: 16, color: "#6b7280" }}>Prebrief unavailable.</div>;

  return (
    <div style={{ display: "grid", gap: 12, padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827" }}>
      <div style={{ ...card, display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>Sales prebrief</div>
        <h1 style={{ margin: 0, fontSize: 22 }}>{data.customer.company}</h1>
        <div>{data.customer.contactName} · {data.customer.location}</div>
        <div style={{ color: "#4b5563", fontSize: 13 }}>Call scheduled for {new Date(data.scheduledCallAt).toLocaleString()}</div>
      </div>

      <div style={card}>
        <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Known</h2>
        {data.known.map((item) => <div key={item} style={{ fontSize: 13, marginTop: 4 }}>{item}</div>)}
        <h2 style={{ margin: "16px 0 8px", fontSize: 15 }}>Last interaction</h2>
        <div style={{ fontSize: 13, color: "#4b5563" }}>{data.lastInteraction}</div>
        <h2 style={{ margin: "16px 0 8px", fontSize: 15 }}>Open items</h2>
        {data.openItems.map((item) => <div key={item} style={{ fontSize: 13, marginTop: 4 }}>{item}</div>)}
        <h2 style={{ margin: "16px 0 8px", fontSize: 15 }}>Call objective</h2>
        <div style={{ fontSize: 13 }}>{data.objective}</div>
      </div>

      <div style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "#4b5563" }}>
        <span>Provider: {data.provider.name} · {data.provider.status}</span>
        <span>Phone {data.destinationMasked}; transcript/audio {data.privacy.transcript}/{data.privacy.audio}</span>
      </div>
    </div>
  );
}
