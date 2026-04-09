export function TriangleMark({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size * 0.9}
      viewBox="0 0 24 22"
      className={className}
      aria-hidden
    >
      <path d="M12 0 L24 22 L0 22 Z" fill="currentColor" />
    </svg>
  );
}
