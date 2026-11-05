export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M20 4v8" />
      <path d="M6 10l6 6" />
      <path d="M34 10l-6 6" />
    </svg>
  );
}