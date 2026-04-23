export function ContribGrid({
  w = 14,
  h = 7,
  cell = 11,
  seed = 3,
}: {
  w?: number;
  h?: number;
  cell?: number;
  seed?: number;
}) {
  const cells: { x: number; y: number; level: number }[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = rand();
      const level =
        v < 0.35 ? 0 : v < 0.6 ? 1 : v < 0.82 ? 2 : v < 0.95 ? 3 : 4;
      cells.push({ x, y, level });
    }
  }
  const tones = ["#ece3d1", "#f7d9c8", "#f0a57f", "#e6784b", "#d65a2f"];

  return (
    <svg width={w * (cell + 2)} height={h * (cell + 2)}>
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x * (cell + 2)}
          y={c.y * (cell + 2)}
          width={cell}
          height={cell}
          rx="2"
          fill={tones[c.level]}
        />
      ))}
    </svg>
  );
}
