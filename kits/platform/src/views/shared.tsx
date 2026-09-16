export const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fff",
  padding: 16,
};

export function Metric({ label, value }: { label: string; value: string | number }) {
  return <div style={card}><div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div><div style={{ marginTop: 4, fontSize: 25, fontWeight: 700 }}>{value}</div></div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ ...card, color: "#6b7280", fontSize: 13 }}>{children}</div>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return <div style={{ ...card, overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>{children}</table></div>;
}

export function Cell({ children }: { children: React.ReactNode }) {
  return <td style={{ borderBottom: "1px solid #f0ede8", padding: "9px 8px", textAlign: "left", verticalAlign: "top" }}>{children}</td>;
}

export function Header({ children }: { children: React.ReactNode }) {
  return <th style={{ borderBottom: "1px solid #e5e7eb", padding: "8px", textAlign: "left", color: "#6b7280", fontWeight: 500 }}>{children}</th>;
}
