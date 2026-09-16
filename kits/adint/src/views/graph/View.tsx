import { useKit } from "@kitstackco/sdk/view";
import type { ViewComponentProps } from "@kitstackco/sdk";

// Mirrors AdGraphViewModel from ../../domain/ad-graph. Kept local so the view is self-contained.
type Node = {
  id: string;
  type: string;
  label: string;
  stroeer?: boolean;
  demo?: boolean;
  reach?: number;
  notOnStroeer?: boolean;
  meta: Record<string, string>;
};
type Stats = {
  publishers: number;
  slots: number;
  fillRate: number;
  creativesWithBrand: number;
  crossPublisher: number;
  notOnStroeer: number;
};
type Data = { nodes: readonly Node[]; edges: readonly { source: string; target: string }[]; stats: Stats; truncated: boolean };

// Draft styling (inline) — a coding agent should restyle with the SDK's ks-* design tokens.
const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", padding: 16 };
const chip = (accent: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "3px 10px",
  margin: "0 6px 6px 0",
  borderRadius: 999,
  fontSize: 12,
  border: `1px solid ${accent}`,
  color: accent,
});

export function GraphView({ data: initialData, host }: ViewComponentProps<Data>) {
  const { data: liveData } = useKit<Data>();
  const data = liveData ?? initialData;
  if (!data || data.stats.slots === 0) {
    return <div style={{ padding: 16, color: "#6b7280", fontSize: 14 }}>No captured ad slots yet.</div>;
  }
  const s = data.stats;
  const brands = data.nodes.filter((n) => n.type === "brand");
  const opportunities = brands
    .filter((n) => n.notOnStroeer)
    .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0));
  const onStroeer = brands.filter((n) => n.stroeer);

  return (
    <div data-kitstack-host={host.kind} style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ ...card, flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#b91c1c" }}>{s.notOnStroeer}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>brands on competitors, not on Ströer</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{s.crossPublisher}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>cross-publisher brands (≥2)</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{s.creativesWithBrand}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>resolved brands · {s.publishers} publishers</div>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>Opportunities — not on Ströer</h2>
        {opportunities.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>None in this scope.</div>
        ) : (
          <div>
            {opportunities.map((n) => (
              <span key={n.id} style={chip("#b91c1c")} title={n.meta.brandId}>
                {n.label}
                {n.reach && n.reach >= 2 ? ` · ${n.reach} pubs` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {onStroeer.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>Already on Ströer</h2>
          {onStroeer.map((n) => (
            <span key={n.id} style={chip("#15803d")}>
              {n.label}
            </span>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#9ca3af" }}>
        Machine-derived brands (status "auto"), not verified. {data.truncated ? "Graph truncated at node cap. " : ""}
        Snapshot from the standalone adint product.
      </div>
    </div>
  );
}
