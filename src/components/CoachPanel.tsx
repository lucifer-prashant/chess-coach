'use client';

import { useState } from 'react';
import { useGame } from '@/lib/store';
import { labelColor, labelText, type MoveLabel } from '@/lib/classify';
import type { PatternFlag } from '@/lib/detectors';

const FLAG_SUMMARY: Partial<Record<PatternFlag, string>> = {
  delivered_mate: 'Checkmate.',
  missed_mate: 'There was a forced mate.',
  hung_piece: 'A piece was hanging after this.',
  missed_capture: 'You missed free material.',
  allowed_fork: 'This let them fork your pieces.',
  king_exposed: 'Your king is now more exposed.',
  early_queen: 'Queen out too early.',
  lost_tempo: 'Lost a tempo here.',
  ignored_development: 'A piece on the back rank still needs to move.',
  captured_piece: 'Good capture.',
  gave_check: 'Forced their king to react.',
  castled: 'King tucked away. Solid.',
};

const FLAG_PRIORITY: PatternFlag[] = [
  'delivered_mate', 'missed_mate', 'hung_piece', 'missed_capture',
  'allowed_fork', 'king_exposed', 'early_queen', 'lost_tempo',
  'ignored_development', 'castled', 'gave_check', 'captured_piece',
];

function pickHeadline(flags: PatternFlag[]): string | null {
  for (const f of FLAG_PRIORITY) if (flags.includes(f) && FLAG_SUMMARY[f]) return FLAG_SUMMARY[f]!;
  return null;
}

export default function CoachPanel() {
  const history = useGame((s) => s.history);
  const settings = useGame((s) => s.settings);
  const requestExplanation = useGame((s) => s.requestExplanation);
  const lastUserMove = [...history].reverse().find((m) => m.by === settings.userColor);
  const [open, setOpen] = useState(false);

  const c = lastUserMove?.classification;
  const flags = lastUserMove?.flags ?? [];
  const labelHue = c ? labelColor(c.label) : '#3a3f55';
  const headline = pickHeadline(flags);
  const exp = lastUserMove?.explanation;
  const canAsk = settings.llmEnabled && settings.nimKey && !exp;

  return (
    <aside className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-panel2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Coach</h2>
          {lastUserMove && c && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: `${labelHue}22`, color: labelHue, border: `1px solid ${labelHue}55` }}
            >
              {labelText(c.label as MoveLabel)}
            </span>
          )}
          {lastUserMove && <span className="truncate font-mono text-sm text-text/80">{lastUserMove.san}</span>}
        </div>
        <span className="shrink-0 text-xs text-muted">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="fade-in border-t border-border p-4">
          {!lastUserMove && (
            <div className="text-sm text-muted">Make a move. I&apos;ll review it.</div>
          )}

          {lastUserMove && (
            <>
              {lastUserMove.bestMoveSan && lastUserMove.bestMoveSan !== lastUserMove.san && (
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="text-muted">Best:</span>
                  <span className="font-mono font-semibold text-good">{lastUserMove.bestMoveSan}</span>
                  {c && c.cpLoss > 25 && (
                    <span className="ml-auto font-mono text-xs text-bad">
                      −{(c.cpLoss / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              )}

              {headline && (
                <div className={'mb-3 text-sm ' + (isPositiveHeadline(c?.label) ? 'text-good/90' : 'text-text/85')}>
                  {headline}
                </div>
              )}

              {exp ? (
                <div className="rounded-lg bg-panel2 p-3 text-sm leading-relaxed text-text/90 whitespace-pre-wrap">
                  {exp}
                </div>
              ) : canAsk ? (
                <button onClick={requestExplanation} className="btn btn-sm btn-primary w-full">
                  Ask coach why
                </button>
              ) : !settings.llmEnabled ? (
                <div className="text-xs text-muted">AI explanations off. Enable in Settings.</div>
              ) : !settings.nimKey ? (
                <div className="text-xs text-muted">Add a NIM key in Settings for in-depth explanations.</div>
              ) : null}
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function isPositiveHeadline(label?: MoveLabel): boolean {
  return label === 'best' || label === 'great' || label === 'good' || label === 'brilliant';
}
