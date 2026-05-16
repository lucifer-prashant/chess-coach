'use client';

import { useGame } from '@/lib/store';
import { labelColor } from '@/lib/classify';

export default function MoveHistory() {
  const history = useGame((s) => s.history);
  const pairs: Array<{ n: number; white?: typeof history[number]; black?: typeof history[number] }> = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      n: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    });
  }
  return (
    <div className="card max-h-[260px] overflow-y-auto p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Moves</div>
      {pairs.length === 0 && <div className="text-sm text-muted">No moves yet.</div>}
      <ol className="space-y-0.5 font-mono text-sm">
        {pairs.map((p) => (
          <li key={p.n} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2">
            <span className="text-xs text-muted">{p.n}.</span>
            <MoveCell move={p.white} />
            <MoveCell move={p.black} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function MoveCell({ move }: { move: ReturnType<typeof useGame.getState>['history'][number] | undefined }) {
  if (!move) return <span />;
  const c = move.classification;
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-text">{move.san}</span>
      {c && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: labelColor(c.label) }}
          title={c.label}
        />
      )}
    </span>
  );
}
