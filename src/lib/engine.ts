/* eslint-disable @typescript-eslint/no-explicit-any */

export type Score =
  | { type: 'cp'; value: number }
  | { type: 'mate'; value: number };

export interface AnalysisLine {
  multipv: number;
  depth: number;
  score: Score;
  pv: string[];
  pvSan?: string[];
}

export interface AnalysisResult {
  bestmove: string | null;
  ponder?: string | null;
  lines: AnalysisLine[];
  depth: number;
}

export interface AnalyzeOptions {
  fen: string;
  depth?: number;
  movetime?: number;
  multipv?: number;
  signal?: AbortSignal;
}

export interface PlayOptions {
  fen: string;
  elo: number;
  movetime?: number;
  signal?: AbortSignal;
}

type Listener = (line: string) => void;

/**
 * Thin UCI wrapper over a stockfish.js Web Worker.
 * One worker = one engine. Caller must serialize requests on a single worker.
 */
export class StockfishEngine {
  private worker: Worker;
  private listeners = new Set<Listener>();
  private ready = false;
  private readyPromise: Promise<void>;

  constructor(workerUrl: string) {
    this.worker = new Worker(workerUrl);
    this.worker.onmessage = (e: MessageEvent) => {
      const text = typeof e.data === 'string' ? e.data : e.data?.data;
      if (typeof text !== 'string') return;
      for (const fn of this.listeners) fn(text);
    };
    this.readyPromise = this.init();
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private async init(): Promise<void> {
    await this.waitFor('uciok', () => this.send('uci'));
    const threads = pickThreads();
    this.send(`setoption name Threads value ${threads}`);
    this.send('setoption name Hash value 64');
    await this.isReady();
    this.ready = true;
  }

  private isReady(): Promise<void> {
    return this.waitFor('readyok', () => this.send('isready'));
  }

  /** Resolves when a line containing `token` is received. */
  private waitFor(token: string, trigger: () => void, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const onLine = (line: string) => {
        if (line.includes(token)) {
          this.listeners.delete(onLine);
          resolve();
        }
      };
      this.listeners.add(onLine);
      const onAbort = () => {
        this.listeners.delete(onLine);
        // Stop any running search so the engine is clean for the next queued job
        this.send('stop');
        reject(new DOMException('aborted', 'AbortError'));
      };
      if (signal) {
        if (signal.aborted) {
          this.listeners.delete(onLine);
          this.send('stop');
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
      trigger();
    });
  }

  async ensureReady(): Promise<void> {
    return this.readyPromise;
  }

  private queue: Promise<unknown> = Promise.resolve();
  private async claim<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.queue;
    let release: () => void = () => {};
    this.queue = new Promise<void>((r) => { release = r; });
    try { await prev; } catch { /* swallow */ }
    try {
      await this.ensureReady();
      return await fn();
    } finally {
      release();
    }
  }

  /** Run analysis. Returns top N lines from final iteration. */
  async analyze(opts: AnalyzeOptions): Promise<AnalysisResult> {
    return this.claim(() => this.runAnalyze(opts));
  }

  private async runAnalyze(opts: AnalyzeOptions): Promise<AnalysisResult> {
    const { fen, depth = 17, movetime, multipv = 3, signal } = opts;
    const linesByMpv = new Map<number, AnalysisLine>();
    let bestmove: string | null = null;
    let ponder: string | null = null;
    let maxDepth = 0;

    const onLine = (line: string) => {
      if (line.startsWith('info ')) {
        const parsed = parseInfo(line);
        if (parsed) {
          linesByMpv.set(parsed.multipv, parsed);
          if (parsed.depth > maxDepth) maxDepth = parsed.depth;
        }
      } else if (line.startsWith('bestmove')) {
        const parts = line.split(/\s+/);
        bestmove = parts[1] === '(none)' ? null : parts[1] ?? null;
        const pIdx = parts.indexOf('ponder');
        if (pIdx >= 0) ponder = parts[pIdx + 1] ?? null;
      }
    };

    this.listeners.add(onLine);
    try {
      this.send('ucinewgame');
      this.send(`setoption name MultiPV value ${multipv}`);
      this.send('setoption name Skill Level value 20');
      this.send('setoption name UCI_LimitStrength value false');
      await this.waitFor('readyok', () => this.send('isready'));
      this.send(`position fen ${fen}`);
      const goCmd = movetime ? `go movetime ${movetime}` : `go depth ${depth}`;
      await this.waitFor('bestmove', () => this.send(goCmd), signal);
    } finally {
      this.listeners.delete(onLine);
    }

    const lines = [...linesByMpv.values()].sort((a, b) => a.multipv - b.multipv);
    return { bestmove, ponder, lines, depth: maxDepth };
  }

  /** Get an opponent move at a target ELO. */
  async play(opts: PlayOptions): Promise<string | null> {
    return this.claim(() => this.runPlay(opts));
  }

  private async runPlay(opts: PlayOptions): Promise<string | null> {
    const { fen, elo, signal } = opts;
    const clampedElo = Math.max(1320, Math.min(3190, Math.round(elo)));
    // Only UCI_Elo limits strength — Skill Level stays at 20 (max).
    // Stacking Skill Level + UCI_Elo causes double-weakening: random blunders
    // on top of ELO-based errors, making play incoherent at lower ELOs.
    const movetime =
      clampedElo < 1500 ? 300 :
      clampedElo < 1700 ? 500 :
      clampedElo < 1900 ? 700 :
      clampedElo < 2100 ? 1000 :
      clampedElo < 2300 ? 1400 :
      clampedElo < 2500 ? 1800 :
      clampedElo < 2800 ? 2500 :
      3000;

    let bestmove: string | null = null;
    const onLine = (line: string) => {
      if (line.startsWith('bestmove')) {
        const m = line.split(/\s+/)[1];
        bestmove = m === '(none)' ? null : m ?? null;
      }
    };
    this.listeners.add(onLine);
    try {
      this.send('ucinewgame');
      this.send('setoption name MultiPV value 1');
      this.send('setoption name Skill Level value 20');
      this.send('setoption name UCI_LimitStrength value true');
      this.send(`setoption name UCI_Elo value ${clampedElo}`);
      await this.waitFor('readyok', () => this.send('isready'));
      this.send(`position fen ${fen}`);
      await this.waitFor('bestmove', () => this.send(`go movetime ${movetime}`), signal);
    } finally {
      this.listeners.delete(onLine);
    }
    return bestmove;
  }

  stop() {
    this.send('stop');
  }

  destroy() {
    try { this.send('quit'); } catch {}
    this.worker.terminate();
    this.listeners.clear();
  }
}

function parseInfo(line: string): AnalysisLine | null {
  const tokens = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let score: Score | null = null;
  const pv: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    switch (t) {
      case 'depth':
        depth = parseInt(tokens[++i], 10);
        break;
      case 'multipv':
        multipv = parseInt(tokens[++i], 10);
        break;
      case 'score': {
        const kind = tokens[++i];
        const v = parseInt(tokens[++i], 10);
        if (kind === 'cp') score = { type: 'cp', value: v };
        else if (kind === 'mate') score = { type: 'mate', value: v };
        break;
      }
      case 'pv':
        for (let j = i + 1; j < tokens.length; j++) pv.push(tokens[j]);
        i = tokens.length;
        break;
      default:
        break;
    }
  }
  if (!score) return null;
  return { multipv, depth, score, pv };
}

/* ---------- pool ---------- */

// Two separate workers: one for analysis/hints, one for opponent play.
// Sharing a single worker means hint analysis (depth=17, ~3-4s each) queues
// BEFORE the opponent's play call, so the opponent waits 10s then gets 300ms — braindead.
let analyzerSingleton: StockfishEngine | null = null;
let opponentSingleton: StockfishEngine | null = null;

function pickWorkerUrl(): string {
  return '/sf/stockfish-18-lite-single.js';
}

function pickThreads(): number {
  return 1;
}

export function getAnalyzer(): StockfishEngine {
  if (!analyzerSingleton) analyzerSingleton = new StockfishEngine(pickWorkerUrl());
  return analyzerSingleton;
}

export function getOpponent(): StockfishEngine {
  if (!opponentSingleton) opponentSingleton = new StockfishEngine(pickWorkerUrl());
  return opponentSingleton;
}

/**
 * Create the engine and run a depth-1 warmup so WASM is fetched + JIT-compiled
 * before the user's first real move. Idempotent.
 */
let warmed = false;
export async function warmEngines(): Promise<void> {
  if (warmed || typeof window === 'undefined') return;
  warmed = true;
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  try {
    // Warm both workers in parallel — each pays WASM compile cost once
    await Promise.all([
      getAnalyzer().analyze({ fen: startFen, depth: 1, multipv: 1 }),
      getOpponent().analyze({ fen: startFen, depth: 1, multipv: 1 }),
    ]);
  } catch {
    warmed = false;
  }
}
