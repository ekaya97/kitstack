import { useKit } from "@kitstackco/sdk/view";

type Trigger = {
  id: string;
  brandName: string;
  agencyName: string;
  agencyStatus: string;
  score: number;
  publishers: string[];
};

// Draft styling (inline) — restyle with the SDK's ks-* tokens later.
export function TriggersView() {
  const { data, callTool } = useKit<Trigger[]>();
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#6b7280", fontSize: 14 }}>
        No scored triggers yet — the campaign/insight layer has not run on this snapshot. Ask for the
        <strong style={{ color: "#111827" }}> ad graph</strong> to see brands running on competitors but not on Ströer.
      </div>
    );
  }
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827" }}>
      <h1 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Opportunities — call this agency</h1>
      <div style={{ display: "grid", gap: 8 }}>
        {data.map((t, i) => (
          <button
            key={t.id}
            onClick={() => callTool("get_trigger", { id: t.id })}
            style={{
              textAlign: "left",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              background: "#fff",
              padding: "10px 12px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>
                {i + 1}. {t.brandName}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "#b91c1c", fontWeight: 700 }}>
                {t.score.toFixed(2)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              Agency: {t.agencyName} ({t.agencyStatus}) · on {t.publishers.join(", ")}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
