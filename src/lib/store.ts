import { create } from 'zustand';
import { Chess, type Color, type Move } from 'chess.js';
import type { Classification } from './classify';
import type { PatternFlag } from './detectors';
import type { Score, AnalysisLine } from './engine';

export type GameStatus = 'idle' | 'playing' | 'ended';
export type EndReason =
  | 'checkmate' | 'stalemate' | 'insufficient' | 'threefold'
  | 'fifty' | 'resign' | 'timeout' | 'draw-agreed' | null;

export interface MoveRecord {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  by: Color;
  classification?: Classification;
  flags?: PatternFlag[];
  bestMoveUci?: string;
  bestMoveSan?: string;
  evalBefore?: Score;
  evalAfter?: Score;
  topLines?: AnalysisLine[];
  explanation?: string;
}

export interface TimeControl {
  initialMs: number;     // 0 = unlimited
  incrementMs: number;
}

export type LlmStrategy = 'always' | 'auto' | 'manual';

export interface GameSettings {
  userColor: Color;            // which color the human plays
  elo: number;                 // opponent strength
  depth: number;               // analysis depth for coach
  hintMode: boolean;
  timeControl: TimeControl;
  nimKey?: string;
  nimModel: string;
  llmEnabled: boolean;
  llmStrategy: LlmStrategy;    // when to auto-call the LLM
  audioEnabled: boolean;
}

interface GameState {
  status: GameStatus;
  endReason: EndReason;
  endResult: 'white' | 'black' | 'draw' | null;
  chess: Chess;                // authoritative game state
  fen: string;                 // mirrored for reactivity
  history: MoveRecord[];
  cursor: number;              // for undo/redo navigation; equals history.length when live
  whiteMs: number;
  blackMs: number;
  lastTickAt: number | null;
  toMove: Color;
  pendingPromotion: { from: string; to: string } | null;
  pendingHint: AnalysisLine[] | null;
  /** Bump to trigger an on-demand explanation request for the most recent user move. */
  explainNonce: number;
  /** When non-null, board shows history[viewIndex].fenAfter — read-only review. */
  viewIndex: number | null;
  /** Explore (branch) mode — free-play sandbox. */
  exploreActive: boolean;
  exploreFen: string;
  exploreEntryFen: string;
  exploreLast: { from: string; to: string } | null;
  settings: GameSettings;

  // actions
  newGame: (overrides?: Partial<GameSettings>) => void;
  applyMove: (san: string | { from: string; to: string; promotion?: string }) => MoveRecord | null;
  setPromotion: (m: { from: string; to: string } | null) => void;
  attachAnalysisToLastMove: (data: Partial<MoveRecord>) => void;
  attachExplanation: (text: string) => void;
  requestExplanation: () => void;
  setViewIndex: (i: number | null) => void;
  /** Load a saved game (from Firestore) into the store for review/analysis. */
  loadSavedGame: (g: { history: MoveRecord[]; result: 'white' | 'black' | 'draw'; endReason: string; settings: GameSettings }) => void;
  startExplore: (fromFen?: string) => void;
  exploreMove: (m: { from: string; to: string; promotion?: string }) => boolean;
  resetExplore: () => void;
  exitExplore: () => void;
  setHint: (lines: AnalysisLine[] | null) => void;
  undo: () => void;
  redo: () => void;
  resign: () => void;
  setSettings: (patch: Partial<GameSettings>) => void;
  tickClocks: () => void;
  finalize: () => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  userColor: 'w',
  elo: 1600,
  depth: 17,
  hintMode: false,
  timeControl: { initialMs: 10 * 60 * 1000, incrementMs: 5 * 1000 },
  nimModel: 'openai/gpt-oss-120b',
  llmEnabled: false,
  llmStrategy: 'auto',
  audioEnabled: true,
};

const STORAGE_KEY = 'chess-coach:settings';

function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: GameSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export const useGame = create<GameState>((set, get) => ({
  status: 'idle',
  endReason: null,
  endResult: null,
  chess: new Chess(),
  fen: new Chess().fen(),
  history: [],
  cursor: 0,
  whiteMs: DEFAULT_SETTINGS.timeControl.initialMs,
  blackMs: DEFAULT_SETTINGS.timeControl.initialMs,
  lastTickAt: null,
  toMove: 'w',
  pendingPromotion: null,
  pendingHint: null,
  explainNonce: 0,
  viewIndex: null,
  exploreActive: false,
  exploreFen: new Chess().fen(),
  exploreEntryFen: new Chess().fen(),
  exploreLast: null,
  settings: typeof window === 'undefined' ? DEFAULT_SETTINGS : loadSettings(),

  newGame: (overrides) => {
    const settings = { ...get().settings, ...(overrides ?? {}) };
    saveSettings(settings);
    const chess = new Chess();
    set({
      status: 'playing',
      endReason: null,
      endResult: null,
      chess,
      fen: chess.fen(),
      history: [],
      cursor: 0,
      whiteMs: settings.timeControl.initialMs || 0,
      blackMs: settings.timeControl.initialMs || 0,
      lastTickAt: settings.timeControl.initialMs ? Date.now() : null,
      toMove: 'w',
      pendingHint: null,
      pendingPromotion: null,
      viewIndex: null,
      settings,
    });
  },

  applyMove: (input) => {
    const { chess, history, settings } = get();
    let move: Move | null = null;
    try {
      if (typeof input === 'string') move = chess.move(input);
      else move = chess.move(input as any);
    } catch {
      move = null;
    }
    if (!move) return null;

    const fenBefore = chess.history({ verbose: true }).length > 1
      ? rebuildFenBefore(chess, history)
      : new Chess().fen();
    const fenAfter = chess.fen();
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    const record: MoveRecord = {
      ply: history.length + 1,
      san: move.san,
      uci,
      fenBefore: history.length === 0 ? new Chess().fen() : history[history.length - 1].fenAfter,
      fenAfter,
      by: move.color,
    };

    // Increment + clock
    let { whiteMs, blackMs } = get();
    const inc = settings.timeControl.incrementMs;
    if (settings.timeControl.initialMs > 0) {
      if (move.color === 'w') whiteMs += inc;
      else blackMs += inc;
    }

    const nextHistory = [...history, record];
    set({
      chess,
      fen: fenAfter,
      history: nextHistory,
      cursor: nextHistory.length,
      toMove: chess.turn(),
      whiteMs,
      blackMs,
      lastTickAt: settings.timeControl.initialMs ? Date.now() : null,
      pendingHint: null,
      viewIndex: null,
    });

    // End checks
    if (chess.isGameOver()) {
      let reason: EndReason = null;
      let result: 'white' | 'black' | 'draw' = 'draw';
      if (chess.isCheckmate()) {
        reason = 'checkmate';
        result = move.color === 'w' ? 'white' : 'black';
      } else if (chess.isStalemate()) reason = 'stalemate';
      else if (chess.isInsufficientMaterial()) reason = 'insufficient';
      else if (chess.isThreefoldRepetition()) reason = 'threefold';
      else if (chess.isDraw()) reason = 'fifty';
      set({ status: 'ended', endReason: reason, endResult: result });
    }

    return record;
  },

  setPromotion: (m) => set({ pendingPromotion: m }),

  attachAnalysisToLastMove: (data) => {
    const { history } = get();
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const updated = { ...last, ...data };
    set({ history: [...history.slice(0, -1), updated] });
  },

  attachExplanation: (text) => {
    const { history } = get();
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const updated = { ...last, explanation: text };
    set({ history: [...history.slice(0, -1), updated] });
  },

  requestExplanation: () => set((s) => ({ explainNonce: s.explainNonce + 1 })),

  setViewIndex: (i) => set({ viewIndex: i }),

  loadSavedGame: (g) => {
    const chess = new Chess();
    for (const m of g.history) {
      try { chess.move(m.san); } catch {/* tolerate */}
    }
    set({
      status: 'ended',
      endReason: (g.endReason as EndReason),
      endResult: g.result,
      chess,
      fen: chess.fen(),
      history: g.history,
      cursor: g.history.length,
      toMove: chess.turn(),
      whiteMs: 0,
      blackMs: 0,
      lastTickAt: null,
      pendingHint: null,
      pendingPromotion: null,
      viewIndex: 0,
      exploreActive: false,
      exploreLast: null,
      settings: g.settings ?? get().settings,
    });
  },

  startExplore: (fromFen) => {
    const fen = fromFen ?? (() => {
      const st = get();
      if (st.viewIndex !== null && st.history[st.viewIndex]) return st.history[st.viewIndex].fenAfter;
      return st.fen;
    })();
    set({
      exploreActive: true,
      exploreFen: fen,
      exploreEntryFen: fen,
      exploreLast: null,
      pendingHint: null,
    });
  },

  exploreMove: ({ from, to, promotion }) => {
    const { exploreFen } = get();
    const c = new Chess(exploreFen);
    try {
      const mv = c.move({ from, to, promotion } as any);
      if (!mv) return false;
      set({ exploreFen: c.fen(), exploreLast: { from, to }, pendingHint: null });
      return true;
    } catch {
      return false;
    }
  },

  resetExplore: () => set((s) => ({ exploreFen: s.exploreEntryFen, exploreLast: null, pendingHint: null })),

  exitExplore: () => set({ exploreActive: false, exploreLast: null, pendingHint: null }),

  setHint: (lines) => set({ pendingHint: lines }),

  undo: () => {
    const { chess, history, status } = get();
    if (history.length === 0 || status !== 'playing') return;
    // Undo one full turn: opponent move + your move if applicable.
    const popCount = history.length >= 2 ? 2 : 1;
    for (let i = 0; i < popCount; i++) chess.undo();
    const nextHistory = history.slice(0, -popCount);
    set({
      chess,
      fen: chess.fen(),
      history: nextHistory,
      cursor: nextHistory.length,
      toMove: chess.turn(),
      pendingHint: null,
    });
  },

  redo: () => {
    // Not implementing real redo against engine — would diverge.
    // Kept stub for parity; intentionally no-op for now.
  },

  resign: () => {
    const { settings, status } = get();
    if (status !== 'playing') return;
    const winner: 'white' | 'black' = settings.userColor === 'w' ? 'black' : 'white';
    set({ status: 'ended', endReason: 'resign', endResult: winner });
  },

  setSettings: (patch) => {
    const merged = { ...get().settings, ...patch };
    saveSettings(merged);
    set({ settings: merged });
  },

  tickClocks: () => {
    const { lastTickAt, toMove, whiteMs, blackMs, status, settings } = get();
    if (status !== 'playing' || lastTickAt == null || settings.timeControl.initialMs === 0) return;
    const now = Date.now();
    const delta = now - lastTickAt;
    let nw = whiteMs, nb = blackMs;
    if (toMove === 'w') nw = Math.max(0, whiteMs - delta);
    else nb = Math.max(0, blackMs - delta);
    if (nw === 0 || nb === 0) {
      set({
        whiteMs: nw,
        blackMs: nb,
        lastTickAt: now,
        status: 'ended',
        endReason: 'timeout',
        endResult: nw === 0 ? 'black' : 'white',
      });
      return;
    }
    set({ whiteMs: nw, blackMs: nb, lastTickAt: now });
  },

  finalize: () => set({ status: 'ended' }),
}));

/** Helper: walk history to find FEN before nth move. Defensive. */
function rebuildFenBefore(_chess: Chess, history: MoveRecord[]): string {
  if (history.length === 0) return new Chess().fen();
  return history[history.length - 1].fenAfter;
}
