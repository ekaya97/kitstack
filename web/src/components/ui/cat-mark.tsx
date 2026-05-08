const marks: Record<string, string> = {
  Revenue: "\u20ac",
  Legal: "\u00a7",
  Finance: "\u2211",
  Sales: "\u2197",
  Marketing: "\u2726",
  Ops: "\u25ca",
  Operations: "\u25ca",
  Career: "\u219f",
  Developer: "\u2318",
  Dev: "\u2318",
};

const tones: Record<string, string> = {
  Revenue: "#3b7a3b",
  Legal: "#6b4ea8",
  Finance: "#2b6cb0",
  Sales: "#d65a2f",
  Marketing: "#c94080",
  Ops: "#7a6a3b",
  Operations: "#7a6a3b",
  Career: "#3b8a8a",
  Developer: "#1a8a6e",
  Dev: "#1a8a6e",
};

export function CatMark({
  cat,
  size = 18,
}: {
  cat: string;
  size?: number;
}) {
  const color = tones[cat] || "#171512";
  return (
    <span
      className="inline-flex items-center justify-center font-serif font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: color + "18",
        color,
        fontSize: size * 0.7,
      }}
    >
      {marks[cat] || "\u2022"}
    </span>
  );
}
