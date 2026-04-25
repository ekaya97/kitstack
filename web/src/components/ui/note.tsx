export function Note({
  children,
  angle = -2,
  className = "",
}: {
  children: React.ReactNode;
  angle?: number;
  className?: string;
}) {
  return (
    <div
      className={`font-hand text-lg text-ks-accent leading-none ${className}`}
      style={{ transform: `rotate(${angle}deg)` }}
    >
      {children}
    </div>
  );
}
