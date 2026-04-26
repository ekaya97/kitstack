export function Avatar({
  name,
  src,
  size = 36,
  tone = "#d65a2f",
}: {
  name: string;
  src?: string;
  size?: number;
  tone?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="shrink-0 border-[1.5px] border-ks-line object-cover"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
      />
    );
  }

  const initial = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="inline-flex items-center justify-center border-[1.5px] border-ks-line font-sans font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: tone,
        fontSize: size * 0.38,
      }}
    >
      {initial}
    </div>
  );
}
