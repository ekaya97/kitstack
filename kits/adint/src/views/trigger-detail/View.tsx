import { useKit } from "@kitstackco/sdk/view";
import type { ViewComponentProps } from "@kitstackco/sdk";

type Trigger = {
  id: string;
  brandName: string;
  agencyName: string;
  agencyStatus: string;
  score: number;
  scoreComponents: Record<string, number>;
  publishers: readonly string[];
  live: { lastObservedAt: string; windowDays: number };
  evidence: readonly { label: string; href: string; kind: string }[];
} | null;

export function TriggerDetailView({ data: initialData, host }: ViewComponentProps<Trigger>) {
  const { data: liveData } = useKit<Trigger>();
  const data = liveData ?? initialData;
  if (!data) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#6b7280", fontSize: 14 }}>
        No trigger selected (or none scored yet on this snapshot).
      </div>
    );
  }
  const t = data;
  return (
    <div data-kitstack-host={host.kind} style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827", display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t.brandName}</h1>
          <span style={{ fontVariantNumeric: "tabular-nums", color: "#b91c1c", fontWeight: 700 }}>{t.score.toFixed(2)}</span>
        </div>
        <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>
          Call <strong>{t.agencyName}</strong> ({t.agencyStatus})
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Running on: {t.publishers.join(", ")} · live since {t.live.lastObservedAt} (window {t.live.windowDays}d)
        </div>
      </div>

      {Object.keys(t.scoreComponents).length > 0 && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", padding: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>Score breakdown</h2>
          {Object.entries(t.scoreComponents).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151" }}>
              <span>{k}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#9ca3af" }}>
        Evidence: {t.evidence.length} item(s). /blob/ links do not resolve in this Stage-A snapshot.
        To act, hand this to the debrief kit's initiate_call.
      </div>
    </div>
  );
}
