'use client';

import { useGame } from '@/lib/store';

const PIECES: Array<{ key: 'q' | 'r' | 'b' | 'n'; glyph: string; name: string }> = [
  { key: 'q', glyph: '♛', name: 'Queen' },
  { key: 'r', glyph: '♜', name: 'Rook' },
  { key: 'b', glyph: '♝', name: 'Bishop' },
  { key: 'n', glyph: '♞', name: 'Knight' },
];

export default function PromotionPicker({ onPick }: { onPick: (piece: 'q' | 'r' | 'b' | 'n') => void }) {
  const pending = useGame((s) => s.pendingPromotion);
  const setPromotion = useGame((s) => s.setPromotion);
  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="rounded-xl border border-border bg-panel p-4 shadow-xl sm:p-6">
        <div className="mb-3 text-sm text-muted">Promote to</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {PIECES.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                onPick(p.key);
                setPromotion(null);
              }}
              className="flex h-20 w-full flex-col items-center justify-center rounded-lg bg-panel2 text-4xl hover:bg-border"
              aria-label={p.name}
            >
              <span>{p.glyph}</span>
              <span className="mt-1 text-xs text-muted">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
