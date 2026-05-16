import type { Score } from './engine';

export type MoveLabel =
  | 'best'
  | 'great'
  | 'good'
  | 'decent'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'brilliant';

export interface Classification {
  label: MoveLabel;
  cpLoss: number;       // centipawn loss from mover's POV (>= 0)
  evalBefore: number;   // normalized to mover's POV, centipawns
  evalAfter: number;    // normalized to mover's POV, centipawns
  matePivot: 'none' | 'lost-mate' | 'allowed-mate' | 'kept-mate' | 'changed-mate';
}

const MATE_CP = 100000;

/** Convert a Score (white-relative from UCI) to centipawns from the mover's POV. */
export function scoreToCp(score: Score, moverIsWhite: boolean): number {
  // Stockfish info scores are from side-to-move POV when UCI_AnalyseMode default.
  // After `position fen X` and `go`, scores are from side-to-move POV.
  // We will normalize so the mover (who just moved or is about to move) sees positive = good.
  if (score.type === 'mate') {
    const sign = score.value >= 0 ? 1 : -1;
    return sign * (MATE_CP - Math.abs(score.value));
  }
  return score.value;
}

/**
 * Classify a played move.
 * - evalBeforeStm: score from STM-to-move POV BEFORE the move was played (side = mover)
 * - evalAfterStm:  score from STM-to-move POV AFTER  the move (side = opponent now)
 *
 * Convention: pass both in centipawns from the MOVER's perspective (positive = mover better).
 * Caller is responsible for flipping the after-eval sign.
 */
export function classify(
  evalBeforeMover: number,
  evalAfterMover: number,
  opts: { wasOnlyMove?: boolean; isCapture?: boolean } = {},
): Classification {
  const cpLoss = Math.max(0, evalBeforeMover - evalAfterMover);

  // Mate transitions dominate.
  const beforeIsMate = Math.abs(evalBeforeMover) >= MATE_CP - 1000;
  const afterIsMate = Math.abs(evalAfterMover) >= MATE_CP - 1000;
  let matePivot: Classification['matePivot'] = 'none';
  let label: MoveLabel;

  if (beforeIsMate && evalBeforeMover > 0 && (!afterIsMate || evalAfterMover < 0)) {
    matePivot = 'lost-mate';
    label = 'blunder';
  } else if (!beforeIsMate && afterIsMate && evalAfterMover < 0) {
    matePivot = 'allowed-mate';
    label = 'blunder';
  } else if (beforeIsMate && afterIsMate && evalAfterMover > 0) {
    matePivot = 'kept-mate';
    label = 'best';
  } else if (beforeIsMate && afterIsMate && evalBeforeMover > 0 && evalAfterMover > 0
             && Math.abs(evalAfterMover - evalBeforeMover) > 0) {
    matePivot = 'changed-mate';
    label = cpLoss > 50 ? 'good' : 'best';
  } else {
    label = labelFromCpLoss(cpLoss, evalBeforeMover, evalAfterMover);
  }

  if (opts.wasOnlyMove && (label === 'mistake' || label === 'blunder' || label === 'inaccuracy')) {
    // Forced move: don't punish.
    label = 'good';
  }

  return {
    label,
    cpLoss,
    evalBefore: evalBeforeMover,
    evalAfter: evalAfterMover,
    matePivot,
  };
}

function labelFromCpLoss(loss: number, before: number, after: number): MoveLabel {
  // Adjust thresholds when already lost: an extra 100cp drop matters less when you're -800.
  const absBefore = Math.abs(before);
  const swing = before - after;

  // If you were winning and threw it away to losing, force blunder.
  if (before > 100 && after < -100 && swing > 200) return 'blunder';
  if (before > 0 && after < -200) return 'blunder';

  if (loss <= 10) return 'best';
  if (loss <= 25) return 'great';
  if (loss <= 50) return 'good';
  if (loss <= 100) return 'decent';
  if (loss <= 200) return 'inaccuracy';
  if (loss <= 400) return 'mistake';
  // Damp threshold when already lost.
  if (absBefore > 600 && loss < 600) return 'mistake';
  return 'blunder';
}

export function labelColor(label: MoveLabel): string {
  switch (label) {
    case 'brilliant': return '#36c5d6';
    case 'best': return '#5fd97a';
    case 'great': return '#7adb6f';
    case 'good': return '#a6d96a';
    case 'decent': return '#cbd16a';
    case 'inaccuracy': return '#f5b14a';
    case 'mistake': return '#ee7b3a';
    case 'blunder': return '#e8553b';
  }
}

export function labelText(label: MoveLabel): string {
  return label[0].toUpperCase() + label.slice(1);
}

/** Map score → eval bar fill ratio (0..1) and display string. */
export function evalDisplay(score: Score, whiteToMove: boolean): { fillWhite: number; text: string } {
  if (score.type === 'mate') {
    const absoluteFromWhite = whiteToMove ? score.value : -score.value;
    const winningForWhite = absoluteFromWhite > 0;
    return {
      fillWhite: winningForWhite ? 1 : 0,
      text: `M${Math.abs(score.value)}`,
    };
  }
  const cpAbs = whiteToMove ? score.value : -score.value;
  // Gentler sigmoid → bar moves less dramatically for small evals.
  const k = 0.0028;
  const clamped = Math.max(-1500, Math.min(1500, cpAbs));
  const fillWhite = 1 / (1 + Math.exp(-k * clamped));
  const pawns = (cpAbs / 100);
  const text = (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
  return { fillWhite, text };
}
