'use client';

import { useMemo } from 'react';
import { Chess, type PieceSymbol } from 'chess.js';
import { useGame } from '@/lib/store';

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const GLYPH: Record<PieceSymbol, { white: string; black: string }> = {
  p: { white: '♙', black: '♟' },
  n: { white: '♘', black: '♞' },
  b: { white: '♗', black: '♝' },
  r: { white: '♖', black: '♜' },
  q: { white: '♕', black: '♛' },
  k: { white: '♔', black: '♚' },
};

const ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

/** Show pieces captured BY the given color (so opponent's pieces taken). */
export default function Captures({ by }: { by: 'white' | 'black' }) {
  const history = useGame((s) => s.history);
  const { byWhite, byBlack, lead } = useMemo(() => computeCaptures(history), [history]);
  const list = by === 'white' ? byWhite : byBlack;
  const oppColor = by === 'white' ? 'black' : 'white';
  // Aggregate counts.
  const counts: Partial<Record<PieceSymbol, number>> = {};
  for (const p of list) counts[p] = (counts[p] ?? 0) + 1;

  const sideLead = by === 'white' ? lead : -lead;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center text-2xl leading-none">
        {ORDER.map((sym) => {
          const n = counts[sym] ?? 0;
          if (!n) return null;
          return (
            <span key={sym} className="flex items-center text-text" title={`${n}× ${sym}`}>
              {Array.from({ length: n }).map((_, i) => (
                <span key={i} style={{ marginLeft: i ? '-10px' : 0, opacity: 0.95 }}>
                  {GLYPH[sym][oppColor]}
                </span>
              ))}
            </span>
          );
        })}
      </div>
      {sideLead > 0 && (
        <span className="rounded-md bg-good/15 px-2 py-0.5 font-mono text-sm font-semibold text-good">
          +{sideLead}
        </span>
      )}
    </div>
  );
}

function computeCaptures(history: ReturnType<typeof useGame.getState>['history']) {
  const game = new Chess();
  const byWhite: PieceSymbol[] = [];
  const byBlack: PieceSymbol[] = [];
  for (const m of history) {
    try {
      const move = game.move(m.san);
      if (move?.captured) {
        if (move.color === 'w') byWhite.push(move.captured);
        else byBlack.push(move.captured);
      }
    } catch { /* ignore */ }
  }
  const whiteMat = byWhite.reduce((s, p) => s + VALUE[p], 0);
  const blackMat = byBlack.reduce((s, p) => s + VALUE[p], 0);
  return { byWhite, byBlack, lead: whiteMat - blackMat };
}
