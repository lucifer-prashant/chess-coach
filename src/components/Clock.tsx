'use client';

import { useEffect } from 'react';
import { useGame } from '@/lib/store';
import clsx from 'clsx';

interface Props {
  side: 'white' | 'black';
}

export default function Clock({ side }: Props) {
  const ms = useGame((s) => (side === 'white' ? s.whiteMs : s.blackMs));
  const toMove = useGame((s) => s.toMove);
  const status = useGame((s) => s.status);
  const initial = useGame((s) => s.settings.timeControl.initialMs);
  const tick = useGame((s) => s.tickClocks);
  const active = status === 'playing' && ((toMove === 'w') === (side === 'white'));

  useEffect(() => {
    if (!active || initial === 0) return;
    const id = setInterval(() => tick(), 100);
    return () => clearInterval(id);
  }, [active, initial, tick]);

  if (initial === 0) {
    return (
      <div className={clsx(
        'rounded-md px-3 py-1.5 font-mono text-sm',
        active ? 'bg-accent text-white shadow-[0_0_24px_-6px_rgba(124,92,255,0.6)]' : 'bg-panel2 text-muted',
      )}>
        ∞
      </div>
    );
  }
  const low = ms < 10_000;
  return (
    <div className={clsx(
      'rounded-md px-4 py-1.5 font-mono text-lg tabular-nums tracking-tight',
      active && !low && 'bg-accent text-white shadow-[0_0_24px_-6px_rgba(124,92,255,0.6)]',
      active && low && 'bg-bad text-white animate-pulse',
      !active && 'bg-panel2 text-text',
    )}>
      {formatMs(ms)}
    </div>
  );
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0 && ms < 10000) {
    const tenths = Math.floor((ms % 1000) / 100);
    return `${s}.${tenths}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
