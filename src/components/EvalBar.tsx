'use client';

import { useMemo } from 'react';
import type { Score } from '@/lib/engine';
import { evalDisplay } from '@/lib/classify';

interface Props {
  score: Score | null;
  whiteToMove: boolean;
  orientation: 'white' | 'black';
}

export default function EvalBar({ score, whiteToMove, orientation }: Props) {
  const { fillWhite, text } = useMemo(() => {
    if (!score) return { fillWhite: 0.5, text: '0.0' };
    return evalDisplay(score, whiteToMove);
  }, [score, whiteToMove]);

  const whiteHeight = (fillWhite * 100).toFixed(2);
  const blackHeight = ((1 - fillWhite) * 100).toFixed(2);
  const advantage = fillWhite > 0.55 ? 'white' : fillWhite < 0.45 ? 'black' : 'even';

  return (
    <div className="relative flex h-full w-10 flex-col overflow-hidden rounded-md ring-1 ring-border">
      {orientation === 'white' ? (
        <>
          <div className="bg-[#0e1018] transition-[height] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]" style={{ height: `${blackHeight}%` }} />
          <div className="bg-[#eef0f5] transition-[height] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]" style={{ height: `${whiteHeight}%` }} />
        </>
      ) : (
        <>
          <div className="bg-[#eef0f5] transition-[height] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]" style={{ height: `${whiteHeight}%` }} />
          <div className="bg-[#0e1018] transition-[height] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]" style={{ height: `${blackHeight}%` }} />
        </>
      )}
      <div className={
        'absolute inset-x-0 ' + (advantage === 'white' ? 'bottom-2 text-bg' : advantage === 'black' ? 'top-2 text-text' : 'top-1/2 -translate-y-1/2 text-text')
      }>
        <div className="text-center font-mono text-[11px] font-semibold">{text}</div>
      </div>
    </div>
  );
}
