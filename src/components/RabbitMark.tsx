/** A small ink-like silhouette that stays legible beside the product name. */
export function RabbitMark() {
  return (
    <svg className="rabbit-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M10 15C5 5 7 1 10 4L15 14M17 13C17 2 22 1 22 6L21 15" fill="currentColor" />
      <path
        d="M6 22C6 15 11 12 17 13C24 14 28 20 25 25C22 30 10 30 6 26L3 24L6 22Z"
        fill="currentColor"
      />
      <path
        d="M21 20L22 20M18 23L20 24"
        stroke="var(--surface, #f4eedb)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
