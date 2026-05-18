'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '@/lib/store';
import { labelColor, type MoveLabel } from '@/lib/classify';

const BAD_LABELS: MoveLabel[] = ['inaccuracy', 'mistake', 'blunder'];

export default function MoveHistory({ maxHeight }: { maxHeight?: string }) {
  const history = useGame((s) => s.history);
  const viewIndex = useGame((s) => s.viewIndex);
  const setViewIndex = useGame((s) => s.setViewIndex);
  const status = useGame((s) => s.status);
  const userColor = useGame((s) => s.settings.userColor);
  const [filter, setFilter] = useState<'all' | 'bad' | 'mine'>('all');
  const listRef = useRef<HTMLOListElement>(null);

  const pairs = useMemo(() => {
    const arr: Array<{ n: number; white?: typeof history[number]; black?: typeof history[number] }> = [];
    for (let i = 0; i < history.length; i += 2) {
      arr.push({ n: Math.floor(i / 2) + 1, white: history[i], black: history[i + 1] });
    }
    return arr;
  }, [history]);

  // Auto-scroll to active.
  useEffect(() => {
    if (!listRef.current) return;
    const idx = viewIndex ?? history.length - 1;
    if (idx < 0) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-ply="${idx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [viewIndex, history.length]);

  const blunderIdxs = useMemo(
    () => history.map((m, i) => (BAD_LABELS.includes(m.classification?.label as MoveLabel) ? i : -1)).filter((i) => i >= 0),
    [history],
  );

  const jumpToNextBlunder = () => {
    const cur = viewIndex ?? -1;
    const next = blunderIdxs.find((i) => i > cur);
    if (next != null) setViewIndex(next);
    else if (blunderIdxs[0] != null) setViewIndex(blunderIdxs[0]);
  };

  const matches = (m?: typeof history[number]) => {
    if (!m) return false;
    if (filter === 'bad') return BAD_LABELS.includes(m.classification?.label as MoveLabel);
    if (filter === 'mine') return m.by === userColor;
    return true;
  };

  return (
    <div className="card flex flex-col overflow-hidden" style={{ maxHeight: maxHeight ?? '380px' }}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Moves · {history.length}</div>
        <div className="flex items-center gap-1">
          {(['all', 'bad', 'mine'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                'rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ' +
                (filter === f ? 'bg-accent/20 text-accent' : 'text-muted hover:text-text')
              }
            >
              {f}
            </button>
          ))}
          {status === 'ended' && blunderIdxs.length > 0 && (
            <button
              onClick={jumpToNextBlunder}
              className="ml-1 rounded-md bg-bad/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-bad hover:bg-bad/25"
              title="Jump to next blunder"
            >
              ⚠ {blunderIdxs.length}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        {pairs.length === 0 && <div className="px-2 py-4 text-sm text-muted">No moves yet.</div>}
        <ol ref={listRef} className="space-y-0.5 font-mono text-sm">
          {pairs.map((p) => {
            const wIdx = p.n * 2 - 2;
            const bIdx = p.n * 2 - 1;
            return (
              <li key={p.n} className="grid grid-cols-[1.8rem_1fr_1fr] items-center gap-1.5">
                <span className="text-right text-xs text-muted">{p.n}.</span>
                <MoveCell move={p.white} idx={wIdx} currentIdx={viewIndex} onClick={setViewIndex} dim={!matches(p.white)} />
                <MoveCell move={p.black} idx={bIdx} currentIdx={viewIndex} onClick={setViewIndex} dim={!matches(p.black)} />
              </li>
            );
          })}
        </ol>
      </div>

      {history.length > 0 && (
        <footer className="border-t border-border px-3 py-1.5 text-[10px] text-muted">
          <kbd>←</kbd> <kbd>→</kbd> step · <kbd>Home</kbd> first · <kbd>End</kbd> live
        </footer>
      )}
    </div>
  );
}

function MoveCell({ move, idx, currentIdx, onClick, dim }: {
  move: ReturnType<typeof useGame.getState>['history'][number] | undefined;
  idx: number;
  currentIdx: number | null;
  onClick: (i: number | null) => void;
  dim?: boolean;
}) {
  if (!move) return <span />;
  const c = move.classification;
  const isActive = currentIdx === idx;
  return (
    <button
      data-ply={idx}
      onClick={() => onClick(isActive ? null : idx)}
      className={
        'flex items-center gap-1.5 rounded px-2 py-1 text-left transition ' +
        (isActive ? 'bg-accent/20 ring-1 ring-accent/50 ' : 'hover:bg-panel2 ') +
        (dim ? 'opacity-35 ' : '')
      }
    >
      <span className="text-text">{move.san}</span>
      {c && (
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: labelColor(c.label) }}
          title={c.label}
        />
      )}
    </button>
  );
}
