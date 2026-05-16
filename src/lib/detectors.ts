import { Chess, type Square, type PieceSymbol, type Color, type Move } from 'chess.js';

export type Phase = 'opening' | 'middlegame' | 'endgame';

export type PatternFlag =
  | 'hung_piece'
  | 'missed_capture'
  | 'missed_mate'
  | 'allowed_fork'
  | 'early_queen'
  | 'king_exposed'
  | 'ignored_development'
  | 'lost_tempo'
  | 'gave_check'
  | 'captured_piece'
  | 'delivered_mate'
  | 'castled';

export interface DetectorContext {
  fenBefore: string;       // position before the played move
  fenAfter: string;        // position after the played move
  movePlayedUci: string;   // e2e4 (UCI)
  movePlayedSan: string;   // e4 (SAN)
  bestMoveUci?: string;    // SF's best from fenBefore (UCI)
  /** SF's best reply from fenAfter (UCI). Used to evaluate hang/fork. */
  bestReplyUci?: string;
  /** Best reply, parsed as Move object on fenAfter, if available. */
  bestReplyMove?: Move | null;
  /** Was there a forced mate available before? Mate-in-N. */
  hadMateBefore?: boolean;
  /** Move number (full move) from chess.js — for opening heuristics. */
  fullMoveNumber: number;
  /** Phase derived from material. */
  phase: Phase;
}

export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

export function detectFlags(ctx: DetectorContext): PatternFlag[] {
  const flags = new Set<PatternFlag>();

  const before = new Chess(ctx.fenBefore);
  const after = new Chess(ctx.fenAfter);
  const moverColor: Color = before.turn();

  const moveObj = parseMoveOnPosition(before, ctx.movePlayedUci);
  if (!moveObj) return [];

  if (moveObj.captured) flags.add('captured_piece');
  if (after.isCheck()) flags.add('gave_check');
  if (after.isCheckmate()) flags.add('delivered_mate');
  if (moveObj.san === 'O-O' || moveObj.san === 'O-O-O') flags.add('castled');

  // Missed mate: a forced mate was available, you didn't play the mating sequence.
  if (ctx.hadMateBefore && !after.isCheckmate() && ctx.bestMoveUci !== ctx.movePlayedUci) {
    flags.add('missed_mate');
  }

  // Missed capture: did the best move capture something worth >= a minor?
  if (ctx.bestMoveUci && ctx.bestMoveUci !== ctx.movePlayedUci) {
    const bestMove = parseMoveOnPosition(before, ctx.bestMoveUci);
    if (bestMove?.captured && PIECE_VALUE[bestMove.captured] >= 300 && !moveObj.captured) {
      flags.add('missed_capture');
    }
  }

  // Hung piece: after your move, opponent's best reply is a capture of the moved piece
  // (or any of your pieces) with no adequate defense (SEE-positive for them).
  if (ctx.bestReplyMove && ctx.bestReplyMove.captured) {
    const target = ctx.bestReplyMove.to;
    const see = seeAt(after, target, oppositeColor(moverColor));
    if (see >= 200) {
      flags.add('hung_piece');
      // Fork: replier's capture also attacks a second piece worth >= minor.
      if (createsFork(after, ctx.bestReplyMove)) {
        flags.add('allowed_fork');
      }
    }
  } else if (ctx.bestReplyMove) {
    // Even non-capture replies may fork (e.g. knight check + queen attack).
    if (createsFork(after, ctx.bestReplyMove)) {
      flags.add('allowed_fork');
    }
  }

  // Opening heuristics (phase == opening AND fullMoveNumber <= 10).
  if (ctx.phase === 'opening' && ctx.fullMoveNumber <= 10) {
    if (moveObj.piece === 'q' && ctx.fullMoveNumber <= 5 && !moveObj.captured) {
      flags.add('early_queen');
    }
    if (movedPieceAlreadyDeveloped(before, moveObj) && backRankMinorsExist(before, moverColor)) {
      flags.add('ignored_development');
    }
    if (movedPieceMovedBefore(before, moveObj) && !moveObj.captured && !after.isCheck()) {
      flags.add('lost_tempo');
    }
  }

  // King exposed: lost castling rights without castling, or king has moved
  // outside the opening castling pattern.
  if (kingExposed(before, after, moverColor, moveObj)) {
    flags.add('king_exposed');
  }

  return [...flags];
}

function oppositeColor(c: Color): Color {
  return c === 'w' ? 'b' : 'w';
}

function parseMoveOnPosition(game: Chess, uci: string): Move | null {
  try {
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promo = uci.length > 4 ? uci.slice(4, 5) : undefined;
    const move = game.move({ from, to, promotion: promo as any });
    // Roll it back so caller's chess.js stays at the pre-move position.
    game.undo();
    return move;
  } catch {
    return null;
  }
}

/**
 * Static Exchange Evaluation at a square, in centipawns, from the perspective of `attacker`.
 * Positive = attacker wins material by trading on this square.
 */
function seeAt(game: Chess, square: Square, attacker: Color): number {
  const board = game.board();
  const occupant = pieceAt(board, square);
  if (!occupant) return 0;

  const attackers = findAttackers(game, square, attacker);
  const defenders = findAttackers(game, square, oppositeColor(attacker));
  if (attackers.length === 0) return 0;

  attackers.sort((a, b) => PIECE_VALUE[a.type] - PIECE_VALUE[b.type]);
  defenders.sort((a, b) => PIECE_VALUE[a.type] - PIECE_VALUE[b.type]);

  let gain = PIECE_VALUE[occupant.type];
  let onSquareValue = PIECE_VALUE[attackers[0].type];
  let side = oppositeColor(attacker);
  const atks = attackers.slice(1);
  const defs = defenders.slice();

  const seq: number[] = [gain];
  while (true) {
    const list = side === attacker ? atks : defs;
    if (list.length === 0) break;
    const next = list.shift()!;
    gain = onSquareValue - gain;
    seq.push(gain);
    onSquareValue = PIECE_VALUE[next.type];
    side = oppositeColor(side);
  }
  // Negamax back.
  for (let i = seq.length - 2; i >= 0; i--) {
    seq[i] = Math.max(-seq[i + 1], seq[i]);
  }
  return seq[0];
}

interface BoardPiece { type: PieceSymbol; color: Color; square: Square; }

function pieceAt(board: ReturnType<Chess['board']>, sq: Square): BoardPiece | null {
  const file = sq.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = 8 - parseInt(sq[1], 10);
  const cell = board[rank]?.[file];
  if (!cell) return null;
  return { type: cell.type, color: cell.color, square: sq };
}

function findAttackers(game: Chess, square: Square, byColor: Color): BoardPiece[] {
  const result: BoardPiece[] = [];
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r]?.[f];
      if (!cell || cell.color !== byColor) continue;
      const file = String.fromCharCode('a'.charCodeAt(0) + f);
      const rank = String(8 - r);
      const from = (file + rank) as Square;
      // chess.js exposes attackers via `attackers` method on newer versions
      const attackedSquares = (game as any).attackers
        ? (game as any).attackers(square, byColor)
        : null;
      if (attackedSquares && attackedSquares.includes(from)) {
        result.push({ type: cell.type, color: cell.color, square: from });
      }
    }
  }
  // Dedup; attackers list may produce per-square already, so this loop is conservative.
  const seen = new Set<string>();
  return result.filter((p) => {
    if (seen.has(p.square)) return false;
    seen.add(p.square);
    return true;
  });
}

function createsFork(positionAfterReply: Chess, replyMove: Move): boolean {
  // Apply the reply, count squares of own piece on `to` attacking
  // enemy pieces worth >= minor. Fork = >= 2 such attacks.
  const game = new Chess(positionAfterReply.fen());
  try {
    game.move({ from: replyMove.from, to: replyMove.to, promotion: (replyMove.promotion as any) });
  } catch {
    return false;
  }
  const movedPieceColor = replyMove.color;
  const enemyColor = oppositeColor(movedPieceColor);
  // Get squares attacked by the moved piece from its new location.
  const attacks = squaresAttackedFrom(game, replyMove.to as Square);
  let valuableTargets = 0;
  const board = game.board();
  for (const sq of attacks) {
    const p = pieceAt(board, sq);
    if (p && p.color === enemyColor && PIECE_VALUE[p.type] >= 300) {
      valuableTargets++;
    }
  }
  return valuableTargets >= 2;
}

function squaresAttackedFrom(game: Chess, from: Square): Square[] {
  // Use chess.js moves with verbose to find pseudo-legal targets; for non-captures we still
  // want attack squares, so we approximate via `moves` from that square.
  try {
    const moves = game.moves({ square: from, verbose: true }) as Move[];
    return moves.map((m) => m.to as Square);
  } catch {
    return [];
  }
}

function movedPieceAlreadyDeveloped(before: Chess, move: Move): boolean {
  // Did the moved piece originate from a non-starting square?
  const startingMap: Record<PieceSymbol, Square[]> = {
    p: [], n: ['b1','g1','b8','g8'] as Square[],
    b: ['c1','f1','c8','f8'] as Square[],
    r: ['a1','h1','a8','h8'] as Square[],
    q: ['d1','d8'] as Square[],
    k: ['e1','e8'] as Square[],
  };
  return !startingMap[move.piece]?.includes(move.from as Square);
}

function backRankMinorsExist(game: Chess, color: Color): boolean {
  const minorSquares: Square[] = color === 'w'
    ? ['b1','g1','c1','f1'] as Square[]
    : ['b8','g8','c8','f8'] as Square[];
  const board = game.board();
  return minorSquares.some((sq) => {
    const p = pieceAt(board, sq);
    return p && p.color === color && (p.type === 'n' || p.type === 'b');
  });
}

function movedPieceMovedBefore(before: Chess, move: Move): boolean {
  const history = before.history({ verbose: true }) as Move[];
  return history.some((h) => h.to === move.from && h.color === move.color);
}

function kingExposed(before: Chess, after: Chess, color: Color, move: Move): boolean {
  if (move.san === 'O-O' || move.san === 'O-O-O') return false;
  const beforeFen = before.fen().split(' ')[2];
  const afterFen = after.fen().split(' ')[2];
  const hadRight = color === 'w'
    ? /[KQ]/.test(beforeFen)
    : /[kq]/.test(beforeFen);
  const stillHasRight = color === 'w'
    ? /[KQ]/.test(afterFen)
    : /[kq]/.test(afterFen);
  if (hadRight && !stillHasRight && move.piece === 'k') return true;

  // Pawn shield broken: moved a pawn from f/g/h or a/b/c in front of own (uncastled) king.
  if (move.piece === 'p') {
    const kingSq = findKing(after, color);
    if (!kingSq) return false;
    const kingFile = kingSq.charCodeAt(0);
    const movedFile = (move.from as string).charCodeAt(0);
    if (Math.abs(kingFile - movedFile) <= 1) {
      const fromRank = parseInt((move.from as string)[1], 10);
      const startRank = color === 'w' ? 2 : 7;
      if (fromRank === startRank) return true;
    }
  }
  return false;
}

function findKing(game: Chess, color: Color): Square | null {
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r]?.[f];
      if (cell && cell.color === color && cell.type === 'k') {
        const file = String.fromCharCode('a'.charCodeAt(0) + f);
        const rank = String(8 - r);
        return (file + rank) as Square;
      }
    }
  }
  return null;
}

export function detectPhase(fen: string): Phase {
  const board = fen.split(' ')[0];
  let majorMinor = 0;
  for (const ch of board) {
    if ('nbrqNBRQ'.includes(ch)) majorMinor++;
  }
  if (majorMinor >= 12) return 'opening';
  if (majorMinor >= 6) return 'middlegame';
  return 'endgame';
}
