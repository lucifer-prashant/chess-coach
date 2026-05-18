import type { MoveRecord } from './store';
import type { MoveLabel } from './classify';

/** Lichess-style accuracy from a single cpLoss. */
function accuracyFromCpLoss(cpLoss: number): number {
  // Lichess formula: 103.1668 * exp(-0.04354 * cpLoss) - 3.1669, clamped 0..100.
  const acc = 103.1668 * Math.exp(-0.04354 * Math.max(0, cpLoss)) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

export interface GameAnalysis {
  totalMoves: number;
  userAccuracy: number;     // 0-100, average across user moves
  oppAccuracy: number;
  counts: Partial<Record<MoveLabel, number>>;
  blunders: MoveRecord[];
  mistakes: MoveRecord[];
  best?: MoveRecord;        // user's lowest cpLoss move (excluding only-forced)
  worst?: MoveRecord;       // user's highest cpLoss move
  biggestSwing: number;     // max single-move cpLoss for user
}

export function analyzeGame(history: MoveRecord[], userColor: 'w' | 'b'): GameAnalysis {
  let userAccSum = 0, userN = 0;
  let oppAccSum = 0, oppN = 0;
  const counts: Partial<Record<MoveLabel, number>> = {};
  const blunders: MoveRecord[] = [];
  const mistakes: MoveRecord[] = [];
  let best: MoveRecord | undefined;
  let worst: MoveRecord | undefined;
  let biggestSwing = 0;

  for (const m of history) {
    if (!m.classification) continue;
    const cp = m.classification.cpLoss;
    const acc = accuracyFromCpLoss(cp);
    if (m.by === userColor) {
      userAccSum += acc; userN++;
      counts[m.classification.label] = (counts[m.classification.label] ?? 0) + 1;
      if (m.classification.label === 'blunder') blunders.push(m);
      if (m.classification.label === 'mistake') mistakes.push(m);
      if (cp > biggestSwing) { biggestSwing = cp; worst = m; }
      if (cp < (best?.classification?.cpLoss ?? Infinity) && (m.classification.label === 'best' || m.classification.label === 'great' || m.classification.label === 'brilliant')) {
        best = m;
      }
    } else {
      oppAccSum += acc; oppN++;
    }
  }
  return {
    totalMoves: history.length,
    userAccuracy: userN > 0 ? +(userAccSum / userN).toFixed(1) : 0,
    oppAccuracy: oppN > 0 ? +(oppAccSum / oppN).toFixed(1) : 0,
    counts,
    blunders, mistakes,
    best, worst,
    biggestSwing,
  };
}
