'use client';
import { useSyncExternalStore } from 'react';
import { subscribeCardAssets, getCardAssets, getServerCardAssets } from '../lib/card-assets';
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
  const assets = useSyncExternalStore(subscribeCardAssets, getCardAssets, getServerCardAssets);
  const id = back ? 'back' : (card?.id ?? 'back');
  return (
    <span className={`hwatu ${className}`}>
      <Image
        src={assets[id]}
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
