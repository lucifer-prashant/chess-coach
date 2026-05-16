'use client';

import { useGame } from '@/lib/store';
import { labelColor, labelText, type MoveLabel } from '@/lib/classify';
import type { PatternFlag } from '@/lib/detectors';

/**
 * Single most-relevant-flag → terse one-liner. We don't show all flags;
 * the LLM (when invoked) gets the full set as context.
 */
const FLAG_SUMMARY: Partial<Record<PatternFlag, string>> = {
  delivered_mate: 'Checkmate.',
  missed_mate: 'There was a forced mate.',
  hung_piece: 'A piece was hanging after this.',
  missed_capture: 'You missed free material.',
  allowed_fork: 'This let them fork your pieces.',
  king_exposed: "Your king is now more exposed.",
  early_queen: 'Queen out too early.',
  lost_tempo: 'Lost a tempo here.',
  ignored_development: 'A piece on the back rank still needs to move.',
  captured_piece: 'Good capture.',
  gave_check: 'Forced their king to react.',
  castled: 'King tucked away. Solid.',
};

// Priority: bad-news first.
const FLAG_PRIORITY: PatternFlag[] = [
  'delivered_mate',
  'missed_mate',
  'hung_piece',
  'missed_capture',
  'allowed_fork',
  'king_exposed',
  'early_queen',
  'lost_tempo',
  'ignored_development',
  'castled',
  'gave_check',
  'captured_piece',
];

function pickHeadline(flags: PatternFlag[]): string | null {
  for (const f of FLAG_PRIORITY) {
    if (flags.includes(f) && FLAG_SUMMARY[f]) return FLAG_SUMMARY[f]!;
  }
  return null;
}

export default function CoachPanel() {
  const history = useGame((s) => s.history);
  const settings = useGame((s) => s.settings);
  const requestExplanation = useGame((s) => s.requestExplanation);
  const lastUserMove = [...history].reverse().find((m) => m.by === settings.userColor);

  if (!lastUserMove) {
    return (
      <aside className="card flex h-full flex-col p-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Coach</h2>
        <div className="mt-6 text-sm text-muted">Make a move. I'll review it.</div>
        <div className="mt-auto pt-6 text-xs text-muted">
          {!settings.llmEnabled && <span>AI is off · Stockfish runs regardless.</span>}
          {settings.llmEnabled && !settings.nimKey && <span>Add NIM key in Settings to enable explanations.</span>}
        </div>
      </aside>
    );
  }

  const c = lastUserMove.classification;
  const flags = lastUserMove.flags ?? [];
  const labelHue = c ? labelColor(c.label) : '#3a3f55';
  const headline = pickHeadline(flags);
  const exp = lastUserMove.explanation;
  const canAsk = settings.llmEnabled && settings.nimKey && !exp;

  return (
    <aside className="card flex h-full flex-col p-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Coach</h2>
        <span className="font-mono text-xs text-muted">move {lastUserMove.ply}</span>
      </header>

      {/* Label + SAN */}
      <div className="mt-4 flex items-baseline gap-3">
        <span
          className="rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: `${labelHue}22`, color: labelHue, border: `1px solid ${labelHue}55` }}
        >
          {c ? labelText(c.label) : 'analyzing'}
        </span>
        <span className="font-mono text-3xl font-medium tracking-tight">{lastUserMove.san}</span>
        {c && c.cpLoss > 25 && (
          <span className="ml-auto font-mono text-xs text-muted">
            −{(c.cpLoss / 100).toFixed(2)}
          </span>
        )}
      </div>

      {/* Best move pill */}
      {lastUserMove.bestMoveSan && lastUserMove.bestMoveSan !== lastUserMove.san && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-muted">Best:</span>
          <span className="font-mono font-semibold text-good">{lastUserMove.bestMoveSan}</span>
        </div>
      )}

      {/* One-line headline derived from top flag */}
      {headline && (
        <div className={'mt-3 text-sm ' + (isPositiveHeadline(c?.label) ? 'text-good/90' : 'text-text/85')}>
          {headline}
        </div>
      )}

      {/* Explanation area */}
      <div className="mt-4 flex flex-1 flex-col gap-3 overflow-hidden">
        {exp ? (
          <div className="rounded-lg bg-panel2 p-3 text-sm leading-relaxed text-text/90 whitespace-pre-wrap">
            {exp}
          </div>
        ) : canAsk ? (
          <button
            onClick={requestExplanation}
            className="btn btn-primary w-full justify-center"
          >
            Ask coach why
          </button>
        ) : !settings.llmEnabled ? (
          <div className="text-xs text-muted">
            AI explanations off. Enable in Settings.
          </div>
        ) : !settings.nimKey ? (
          <div className="text-xs text-muted">
            Add a NIM key in Settings for in-depth explanations.
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function isPositiveHeadline(label?: MoveLabel): boolean {
  return label === 'best' || label === 'great' || label === 'good' || label === 'brilliant';
}
