export function Stars({
  v = 4.8,
  size = 14,
  showValue = true,
}: {
  v?: number;
  size?: number;
  showValue?: boolean;
}) {
  const full = Math.floor(v);
  const half = v - full >= 0.5;

  return (
    <span className="inline-flex items-center gap-1.5 font-sans text-[13px] text-ks-ink">
      <span className="inline-flex gap-px">
        {[0, 1, 2, 3, 4].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 16 16">
            <path
              d="M8 1 L10 6 L15 6 L11 9 L12.5 14 L8 11 L3.5 14 L5 9 L1 6 L6 6 Z"
              fill={
                i < full || (i === full && half) ? "#d65a2f" : "none"
              }
              stroke="#d65a2f"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        ))}
      </span>
      {showValue && (
        <span className="text-ks-muted font-medium">{v}</span>
      )}
    </span>
  );
}
