'use client';

import { useMemo, useState } from 'react';
import { useGame } from '@/lib/store';
import { analyzeGame } from '@/lib/analysis';
import { labelColor, labelText } from '@/lib/classify';
import { useToast } from './Toast';
import { Chess } from 'chess.js';

export default function GameSummary({ onJump }: { onJump: (ply: number) => void }) {
  const status = useGame((s) => s.status);
  const history = useGame((s) => s.history);
  const settings = useGame((s) => s.settings);
  const endReason = useGame((s) => s.endReason);
  const endResult = useGame((s) => s.endResult);
  const reviewMode = useGame((s) => s.reviewMode);
  const [open, setOpen] = useState(!reviewMode);
  const toast = useToast();

  // Only compute when game is ended — analyzeGame is O(n) and runs on every move otherwise
  const a = useMemo(
    () => status === 'ended' ? analyzeGame(history, settings.userColor) : null,
    [status, history, settings.userColor],
  );

  if (status !== 'ended') return null;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-sm fixed bottom-20 right-3 z-40 shadow-xl sm:bottom-4 sm:right-4">
        📊 Summary
      </button>
    );
  }

  const userColorName = settings.userColor === 'w' ? 'white' : 'black';
  const userWon = endResult === userColorName;
  const verdict = endResult === 'draw' ? 'Draw' : userWon ? 'You won!' : 'You lost';
  const verdictCls = endResult === 'draw' ? 'text-muted' : userWon ? 'text-good' : 'text-bad';

  const copyPgn = async () => {
    const chess = new Chess();
    for (const m of history) { try { chess.move(m.san); } catch {} }
    try {
      await navigator.clipboard.writeText(chess.pgn());
      toast.push('PGN copied to clipboard', 'success');
    } catch {
      toast.push('Clipboard blocked', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
    >
      <div className="card pop max-h-[90vh] w-full max-w-lg overflow-y-auto p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <header className="mb-4 flex items-start justify-between">
          <div>
            <div className={'text-2xl font-bold ' + verdictCls}>{verdict}</div>
            <div className="text-xs text-muted">by {endReason} · {history.length} moves</div>
          </div>
          <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">✕</button>
        </header>

        {/* Accuracy */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <AccuracyCard label="Your accuracy" value={a!.userAccuracy} />
          <AccuracyCard label="Stockfish accuracy" value={a!.oppAccuracy} />
        </div>

        {/* Move breakdown */}
        <div className="mb-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Your moves</div>
          <div className="flex flex-wrap gap-2">
            {(['best', 'great', 'good', 'decent', 'inaccuracy', 'mistake', 'blunder'] as const).map((l) => {
              const n = a!.counts[l] ?? 0;
              if (n === 0) return null;
              return (
                <span
                  key={l}
                  className="rounded-md border px-2.5 py-1 text-xs font-semibold"
                  style={{
                    borderColor: labelColor(l) + '55',
                    background: labelColor(l) + '15',
                    color: labelColor(l),
                  }}
                >
                  {labelText(l)} · {n}
                </span>
              );
            })}
          </div>
        </div>

        {/* Worst move */}
        {a!.worst && (
          <div className="mb-3 rounded-lg border border-bad/30 bg-bad/5 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bad">Biggest mistake</div>
            <div className="mt-1 flex items-center justify-between">
              <div>
                <span className="font-mono text-lg">{a!.worst!.san}</span>
                <span className="ml-2 text-xs text-muted">
                  move {a!.worst!.ply} · −{(a!.worst!.classification!.cpLoss / 100).toFixed(2)}
                </span>
              </div>
              <button onClick={() => { onJump(a!.worst!.ply - 1); setOpen(false); }} className="btn btn-sm">
                Jump →
              </button>
            </div>
          </div>
        )}

        {/* Best move */}
        {a!.best && (
          <div className="mb-3 rounded-lg border border-good/30 bg-good/5 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-good">Best move</div>
            <div className="mt-1 flex items-center justify-between">
              <div>
                <span className="font-mono text-lg">{a!.best!.san}</span>
                <span className="ml-2 text-xs text-muted">move {a!.best!.ply}</span>
              </div>
              <button onClick={() => { onJump(a!.best!.ply - 1); setOpen(false); }} className="btn btn-sm">
                Jump →
              </button>
            </div>
          </div>
        )}

        {/* Blunders list */}
        {a!.blunders.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Blunders ({a!.blunders.length})
            </div>
            <ul className="space-y-1">
              {a!.blunders.slice(0, 6).map((b) => (
                <li
                  key={b.ply}
                  onClick={() => { onJump(b.ply - 1); setOpen(false); }}
                  className="flex cursor-pointer items-center justify-between rounded-md bg-panel2 px-3 py-1.5 text-sm hover:bg-bad/10"
                >
                  <span>
                    <span className="text-xs text-muted">{Math.ceil(b.ply / 2)}.</span>{' '}
                    <span className="font-mono">{b.san}</span>
                    {b.bestMoveSan && <span className="ml-2 text-xs text-muted">→ best: <span className="text-good">{b.bestMoveSan}</span></span>}
                  </span>
                  <span className="font-mono text-xs text-bad">−{(b.classification!.cpLoss / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 border-t border-border pt-4">
          <button onClick={copyPgn} className="btn btn-sm flex-1">📋 Copy PGN</button>
          <button onClick={() => setOpen(false)} className="btn btn-sm btn-primary flex-1">Analyze →</button>
        </div>
      </div>
    </div>
  );
}

function AccuracyCard({ label, value }: { label: string; value: number }) {
  const tone = value >= 90 ? 'text-good' : value >= 75 ? 'text-brill' : value >= 60 ? 'text-warn' : 'text-bad';
  return (
    <div className="card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className={'mt-1 font-mono text-3xl font-bold ' + tone}>{value}%</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: value >= 90 ? '#5fd97a' : value >= 75 ? '#36c5d6' : value >= 60 ? '#f5b14a' : '#e8553b',
          }}
        />
      </div>
    </div>
  );
}
