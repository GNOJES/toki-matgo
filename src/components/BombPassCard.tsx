/** A visual pass token; it never enters the game's physical deck. */
export function BombPassCard() {
  return (
    <span className="hwatu bomb-pass-face">
      <svg viewBox="0 0 64 100" role="img" aria-label="폭탄 뒤집기 패">
        <rect width="64" height="100" rx="5" fill="#af342a" />
        <rect x="4" y="4" width="56" height="92" rx="3" fill="#f7edd7" />
        <path
          d="M39 34c3-14 15-9 11-19"
          fill="none"
          stroke="#302e28"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="m48 9 3 5 6-2-3 5 4 4-6-1-2 6-1-6-6 1 4-4-3-5 5 2z" fill="#d84b30" />
        <path d="m34 32 9 4-3 10-11-4z" fill="#484c40" />
        <circle cx="29" cy="55" r="21" fill="#292f28" />
        <path
          d="M17 49c1-5 5-9 10-10"
          fill="none"
          stroke="#a8b299"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="m19 79 4-2m21-2 4 3m-19 3v3"
          stroke="#c44531"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <text x="32" y="92" textAnchor="middle" fill="#6a5140" fontSize="8" fontWeight="700">
          뒤집기
        </text>
      </svg>
    </span>
  );
}
