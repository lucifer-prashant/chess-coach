'use client';

import dynamic from 'next/dynamic';

// Chessground touches DOM; client-only.
const PlayScreen = dynamic(() => import('@/components/PlayScreen'), { ssr: false });

export default function PlayPage() {
  return <PlayScreen />;
}
