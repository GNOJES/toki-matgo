import Image from 'next/image';
import type { Card as HwatuCard } from '../game-engine/types';
export function Card({
  card,
  back = false,
  className = '',
}: {
  card?: HwatuCard;
  back?: boolean;
  className?: string;
}) {
  return (
    <span className={`hwatu ${className}`}>
      <Image
        src={`/cards/${back ? 'back' : (card?.id ?? 'back')}.${back || !card || card.isBonus ? 'svg' : 'webp'}`}
        alt={back ? '화투 뒷면' : (card?.name ?? '화투 뒷면')}
        width={64}
        height={100}
        unoptimized
        loading="eager"
        draggable={false}
      />
    </span>
  );
}
