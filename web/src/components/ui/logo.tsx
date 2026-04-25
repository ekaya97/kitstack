export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect
        x="2.5"
        y="11.5"
        width="23"
        height="13"
        rx="2.5"
        stroke="#1a1814"
        strokeWidth="1.5"
        fill="#faf7f1"
      />
      <rect
        x="5.5"
        y="7.5"
        width="17"
        height="4"
        rx="1.5"
        stroke="#1a1814"
        strokeWidth="1.3"
        fill="#f7d9c8"
      />
      <rect
        x="8.5"
        y="3.5"
        width="11"
        height="4"
        rx="1.5"
        stroke="#1a1814"
        strokeWidth="1.3"
        fill="#d65a2f"
      />
    </svg>
  );
}
