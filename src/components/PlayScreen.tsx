'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Chess } from 'chess.js';
import Board from './Board';
import EvalBar from './EvalBar';
import Clock from './Clock';
import CoachPanel from './CoachPanel';
import MoveHistory from './MoveHistory';
import PromotionPicker from './PromotionPicker';
import AuthBadge from './AuthBadge';
import Captures from './Captures';
import { useGame } from '@/lib/store';
import { getAnalyzer, getOpponent, type AnalysisResult, type Score } from '@/lib/engine';
import { classify, scoreToCp } from '@/lib/classify';
import { detectFlags, detectPhase } from '@/lib/detectors';
import { explainMove, type ExplainInput } from '@/lib/nim';
import type { MoveLabel } from '@/lib/classify';
import type { PatternFlag } from '@/lib/detectors';
import { play as playCue, primeAudio } from '@/lib/audio';
import { watchAuth, saveGame } from '@/lib/firebase';

export default function PlayScreen() {
  const [startedLocal, setStarted] = useState(false);
  const hasHistory = useGame((s) => s.history.length > 0);
  const started = startedLocal || hasHistory;
  const [currentScore, setCurrentScore] = useState<Score | null>(null);
  const [currentWhiteToMove, setCurrentWhiteToMove] = useState<boolean>(true);
  const [thinking, setThinking] = useState(false);
  // Generation token: any in-flight pipelines compare to this; if it changes (undo / new game) they bail.
  const genRef = useRef(0);

  const fen = useGame((s) => s.fen);
  const toMove = useGame((s) => s.toMove);
  const status = useGame((s) => s.status);
  const settings = useGame((s) => s.settings);
  const history = useGame((s) => s.history);
  const pendingPromotion = useGame((s) => s.pendingPromotion);
  const setPromotion = useGame((s) => s.setPromotion);
  const pendingHint = useGame((s) => s.pendingHint);
  const setHint = useGame((s) => s.setHint);
  const viewIndex = useGame((s) => s.viewIndex);
  const setViewIndex = useGame((s) => s.setViewIndex);
  const exploreActive = useGame((s) => s.exploreActive);
  const exploreMoveAction = useGame((s) => s.exploreMove);

  const newGame = useGame((s) => s.newGame);
  const applyMove = useGame((s) => s.applyMove);
  const attachAnalysisToLastMove = useGame((s) => s.attachAnalysisToLastMove);
  const attachExplanation = useGame((s) => s.attachExplanation);
  const startExplore = useGame((s) => s.startExplore);
  const resetExplore = useGame((s) => s.resetExplore);
  const exitExplore = useGame((s) => s.exitExplore);
  const undoStore = useGame((s) => s.undo);
  const undo = useCallback(() => {
    genRef.current++;
    setThinking(false);
    setHint(null);
    undoStore();
  }, [undoStore, setHint]);
  const resign = useGame((s) => s.resign);
  const setSettings = useGame((s) => s.setSettings);

  // Pre-warm engines so first analysis is fast.
  useEffect(() => {
    getAnalyzer().ensureReady().catch(() => {});
    getOpponent().ensureReady().catch(() => {});
  }, []);

  // Keyboard: ← / → navigate history (review mode). Esc / End → live.
  useEffect(() => {
    if (!started) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const st = useGame.getState();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const cur = st.viewIndex ?? st.history.length;
        if (cur > 0) setViewIndex(cur - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (st.viewIndex === null) return;
        const next = st.viewIndex + 1;
        if (next >= st.history.length) setViewIndex(null);
        else setViewIndex(next);
      } else if (e.key === 'Escape' || e.key === 'End') {
        e.preventDefault();
        setViewIndex(null);
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (st.history.length > 0) setViewIndex(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, setViewIndex]);

  // Helpers wrapped in callback closure so we can pass settings/key.
  const streamExplanation = useCallback((input: ExplainInput) => {
    const s = useGame.getState().settings;
    if (!s.llmEnabled || !s.nimKey) return;
    attachExplanation('');
    explainMove(input, {
      apiKey: s.nimKey,
      model: s.nimModel,
      onToken: (delta) => {
        const cur = useGame.getState().history.slice(-1)[0]?.explanation ?? '';
        attachExplanation(cur + delta);
      },
    }).catch((err) => {
      attachExplanation(`(coach error: ${err.message ?? err})`);
    });
  }, [attachExplanation]);

  // On-demand explanation: bumped by user clicking "Ask coach".
  const explainNonce = useGame((s) => s.explainNonce);
  useEffect(() => {
    if (explainNonce === 0) return;
    const st = useGame.getState();
    const lastUser = [...st.history].reverse().find((m) => m.by === st.settings.userColor);
    if (!lastUser || !lastUser.classification) return;
    const phase = lastUser.fenBefore.split(' ')[0].split('').filter((c) => 'nbrqNBRQ'.includes(c)).length;
    const moverColorName: 'white' | 'black' = lastUser.by === 'w' ? 'white' : 'black';
    streamExplanation({
      classification: lastUser.classification,
      flags: lastUser.flags ?? [],
      phase: phase >= 12 ? 'opening' : phase >= 6 ? 'middlegame' : 'endgame',
      fenBefore: lastUser.fenBefore,
      fenAfter: lastUser.fenAfter,
      playedSan: lastUser.san,
      bestMoveSan: lastUser.bestMoveSan,
      evalBefore: lastUser.evalBefore,
      evalAfter: lastUser.evalAfter,
      moverColorName,
    });
  }, [explainNonce, streamExplanation]);

  // Auto-recompute hints (live: user turn; explore: every position).
  const exploreFen = useGame((s) => s.exploreFen);
  useEffect(() => {
    if (!started) return;
    const useExplore = exploreActive;
    if (!useExplore) {
      if (status !== 'playing') return;
      if (toMove !== settings.userColor) return;
    }
    if (!settings.hintMode) {
      setHint(null);
      return;
    }
    let cancelled = false;
    const fenSnap = useExplore ? exploreFen : fen;
    getAnalyzer()
      .analyze({ fen: fenSnap, depth: settings.depth, multipv: 3 })
      .then((r) => {
        const cur = useGame.getState();
        const curFen = cur.exploreActive ? cur.exploreFen : cur.fen;
        if (!cancelled && curFen === fenSnap) setHint(r.lines);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [started, status, toMove, fen, exploreActive, exploreFen, settings.userColor, settings.hintMode, settings.depth, setHint]);

  // Explore-mode: analyze each position for the eval bar.
  useEffect(() => {
    if (!exploreActive) return;
    let cancelled = false;
    const fenSnap = exploreFen;
    getAnalyzer()
      .analyze({ fen: fenSnap, depth: Math.min(settings.depth, 16), multipv: 1 })
      .then((r) => {
        const cur = useGame.getState();
        if (cancelled || !cur.exploreActive || cur.exploreFen !== fenSnap) return;
        if (r.lines[0]) {
          setCurrentScore(r.lines[0].score);
          setCurrentWhiteToMove(fenSnap.split(' ')[1] === 'w');
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [exploreActive, exploreFen, settings.depth]);

  // Save game once when ending — only if it was actually played this session.
  const savedRef = useRef(false);
  const playedThisSessionRef = useRef(false);
  useEffect(() => {
    if (status === 'playing') playedThisSessionRef.current = true;
  }, [status]);
  useEffect(() => {
    if (status !== 'ended' || savedRef.current) return;
    if (!playedThisSessionRef.current) return; // loaded from history, don't re-save
    savedRef.current = true;
    if (history.length === 0) return;
    if (status === 'ended' && (useGame.getState().endReason === 'checkmate' ||
        useGame.getState().endReason === 'resign' || useGame.getState().endReason === 'timeout')) {
      playCue('mate');
    }
    const off = watchAuth(async (user) => {
      if (!user) return;
      const chess = new Chess();
      for (const m of history) {
        try { chess.move(m.san); } catch {}
      }
      const result = useGame.getState().endResult ?? 'draw';
      const endReason = useGame.getState().endReason ?? 'unknown';
      await saveGame(user.uid, {
        result,
        endReason: endReason as string,
        movesCount: history.length,
        pgn: chess.pgn(),
        history,
        settings,
      }).catch(console.error);
      off();
    });
  }, [status, history, settings]);

  // Reset save flag when a new game starts.
  useEffect(() => {
    if (status === 'playing') savedRef.current = false;
  }, [status]);

  // ---- handle player move ----
  const onUserMove = useCallback(async (from: string, to: string, promotion?: string) => {
    if (status !== 'playing') return;
    if (toMove !== settings.userColor) return;

    const fenBefore = useGame.getState().fen;
    const rec = applyMove({ from, to, promotion });
    if (!rec) {
      if (settings.audioEnabled) playCue('illegal');
      return;
    }
    if (settings.audioEnabled) {
      if (rec.san.endsWith('#')) playCue('mate');
      else if (rec.san.includes('+')) playCue('check');
      else if (rec.san.includes('x')) playCue('capture');
      else playCue('move');
    }

    // Kick off analysis + opponent move in parallel.
    runMoveReview(fenBefore, rec.uci);
  }, [status, toMove, settings, applyMove]);

  const onPromotionPick = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPromotion(null);
    if (exploreActive) {
      exploreMoveAction({ from, to, promotion: piece });
      return;
    }
    onUserMove(from, to, piece);
  }, [pendingPromotion, setPromotion, onUserMove, exploreActive, exploreMoveAction]);

  // ---- post-move analysis pipeline ----
  const runMoveReview = useCallback(async (fenBefore: string, playedUci: string) => {
    const myGen = ++genRef.current;
    const aliveCheck = () => genRef.current === myGen;
    const analyzer = getAnalyzer();
    const fenAfter = useGame.getState().fen;
    const moverWasWhite = fenBefore.split(' ')[1] === 'w';

    // 1. Analyze position BEFORE the move (multipv 3, mover's POV).
    const beforeAnalysis = await analyzer.analyze({
      fen: fenBefore,
      depth: settings.depth,
      multipv: 3,
    }).catch(() => null);

    // 2. Analyze position AFTER the move.
    const afterAnalysis = await analyzer.analyze({
      fen: fenAfter,
      depth: settings.depth,
      multipv: 1,
    }).catch(() => null);

    if (!beforeAnalysis || !afterAnalysis) return;
    if (!aliveCheck()) return;

    const bestLine = beforeAnalysis.lines[0];
    const playedScore = afterAnalysis.lines[0]?.score ?? null;
    if (!bestLine || !playedScore) return;

    // Best score is from mover's POV (side-to-move at fenBefore was mover).
    const evalBeforeMover = scoreToCp(bestLine.score, moverWasWhite);
    // After-eval: side-to-move is OPPONENT — their score, so flip for mover.
    const evalAfterMover = -scoreToCp(playedScore, !moverWasWhite);

    const hadMateBefore = bestLine.score.type === 'mate' && bestLine.score.value > 0;
    const isOnlyMove = beforeAnalysis.lines.length === 1;

    const phase = detectPhase(fenBefore);
    const fullMove = parseInt(fenBefore.split(' ')[5] ?? '1', 10);

    // Best reply from opponent at fenAfter.
    const bestReplyUci = afterAnalysis.bestmove ?? undefined;
    let bestReplyMove = null;
    if (bestReplyUci) {
      try {
        const sim = new Chess(fenAfter);
        bestReplyMove = sim.move({
          from: bestReplyUci.slice(0, 2),
          to: bestReplyUci.slice(2, 4),
          promotion: bestReplyUci.length > 4 ? bestReplyUci.slice(4, 5) : undefined,
        } as any);
      } catch {
        bestReplyMove = null;
      }
    }

    const bestMoveUci = bestLine.pv[0];
    const sim = new Chess(fenBefore);
    let bestMoveSan: string | undefined;
    try {
      const mv = sim.move({
        from: bestMoveUci.slice(0, 2),
        to: bestMoveUci.slice(2, 4),
        promotion: bestMoveUci.length > 4 ? bestMoveUci.slice(4, 5) : undefined,
      } as any);
      bestMoveSan = mv?.san;
    } catch {}

    const flags = detectFlags({
      fenBefore,
      fenAfter,
      movePlayedUci: playedUci,
      movePlayedSan: useGame.getState().history.slice(-1)[0]?.san ?? '',
      bestMoveUci,
      bestReplyUci,
      bestReplyMove,
      hadMateBefore,
      fullMoveNumber: fullMove,
      phase,
    });

    const c = classify(evalBeforeMover, evalAfterMover, { wasOnlyMove: isOnlyMove });

    attachAnalysisToLastMove({
      classification: c,
      flags,
      bestMoveUci,
      bestMoveSan,
      evalBefore: bestLine.score,
      evalAfter: playedScore,
      topLines: beforeAnalysis.lines,
    });

    // Eval bar reflects the static position eval; using afterAnalysis (full depth).
    // This is from opponent's POV (they're to move) — EvalBar flips with whiteToMove.
    setCurrentScore(playedScore);
    setCurrentWhiteToMove(!moverWasWhite);

    if (settings.audioEnabled && c.label === 'blunder') playCue('blunder');

    // LLM auto-trigger logic.
    const shouldAutoExplain =
      settings.llmEnabled && settings.nimKey &&
      (settings.llmStrategy === 'always' ||
        (settings.llmStrategy === 'auto' && isNotableMove(c.label, flags)));
    if (shouldAutoExplain) {
      streamExplanation({
        classification: c,
        flags,
        phase,
        fenBefore,
        fenAfter,
        playedSan: useGame.getState().history.slice(-1)[0]?.san ?? '',
        bestMoveSan,
        evalBefore: bestLine.score,
        evalAfter: playedScore,
        moverColorName: moverWasWhite ? 'white' : 'black',
      });
    }

    // Opponent move (only if game not over and pipeline still alive).
    if (useGame.getState().status === 'playing' && aliveCheck()) {
      const opp = getOpponent();
      setThinking(true);
      const reply = await opp.play({
        fen: fenAfter,
        elo: settings.elo,
      }).catch(() => null);
      setThinking(false);
      if (!reply || !aliveCheck() || useGame.getState().fen !== fenAfter) return;

      // Apply opponent move.
      const fenBeforeOpp = useGame.getState().fen;
      const oppRec = applyMove({
        from: reply.slice(0, 2),
        to: reply.slice(2, 4),
        promotion: reply.length > 4 ? reply.slice(4, 5) : undefined,
      });
      if (oppRec && settings.audioEnabled) {
        if (oppRec.san.endsWith('#')) playCue('mate');
        else if (oppRec.san.includes('+')) playCue('check');
        else if (oppRec.san.includes('x')) playCue('capture');
        else playCue('move');
      }

      // Eval bar + hints are handled by the auto-effect below (watches fen/toMove).
      void fenBeforeOpp;
      const fenAfterOpp = useGame.getState().fen;
      analyzer.analyze({ fen: fenAfterOpp, depth: settings.depth, multipv: 1 })
        .then((r) => {
          if (r.lines[0] && useGame.getState().fen === fenAfterOpp) {
            setCurrentScore(r.lines[0].score);
            setCurrentWhiteToMove(useGame.getState().toMove === 'w');
          }
        })
        .catch(() => {});
    }
  }, [settings, attachAnalysisToLastMove, attachExplanation, applyMove, setHint]);

  // Start the game.
  const handleStart = useCallback(async () => {
    genRef.current++;
    primeAudio();
    newGame();
    setCurrentScore(null);
    setHint(null);
    setStarted(true);
    if (settings.audioEnabled) playCue('start');

    // If user is black, engine moves first.
    if (settings.userColor === 'b') {
      const opp = getOpponent();
      setThinking(true);
      const reply = await opp.play({
        fen: useGame.getState().fen,
        elo: settings.elo,
      }).catch(() => null);
      setThinking(false);
      if (reply) {
        applyMove({
          from: reply.slice(0, 2),
          to: reply.slice(2, 4),
          promotion: reply.length > 4 ? reply.slice(4, 5) : undefined,
        });
        if (settings.audioEnabled) playCue('move');
      }
    }

    // Initial hint handled by auto-effect.
  }, [newGame, settings, setHint, applyMove]);

  // Toggle hint mode mid-game.
  const handleToggleHint = useCallback(() => {
    const next = !settings.hintMode;
    setSettings({ hintMode: next });
    if (!next) {
      setHint(null);
      return;
    }
    if (status === 'playing' && toMove === settings.userColor) {
      getAnalyzer().analyze({
        fen: useGame.getState().fen,
        depth: settings.depth,
        multipv: 3,
      }).then((r) => setHint(r.lines)).catch(() => {});
    }
  }, [settings, setSettings, setHint, status, toMove]);

  const userIsWhite = settings.userColor === 'w';
  const orientation = userIsWhite ? 'white' as const : 'black' as const;
  const topSide = userIsWhite ? 'black' as const : 'white' as const;
  const bottomSide = userIsWhite ? 'white' as const : 'black' as const;

  const endResult = useGame.getState().endResult;
  const endReason = useGame.getState().endReason;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-5">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-text">
          <span className="text-accent">♞</span> chess.coach
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="font-mono">ELO {settings.elo}</span>
          <span>·</span>
          <span className="font-mono">d{settings.depth}</span>
          <span>·</span>
          <Link href="/settings" className="hover:text-text">settings</Link>
        </div>
        <AuthBadge />
      </header>

      {!started && (
        <div className="mx-auto mt-16 max-w-md">
          <div className="card p-8 text-center">
            <div className="mx-auto mb-4 text-5xl">♞</div>
            <h2 className="text-2xl font-bold">Ready?</h2>
            <p className="mt-2 text-sm text-muted">
              You play <span className="text-text">{userIsWhite ? 'White' : 'Black'}</span> vs Stockfish
              ELO <span className="text-text">{settings.elo}</span>. Time <span className="text-text">{formatTC(settings)}</span>.
            </p>
            <button onClick={handleStart} className="btn btn-primary mt-6 w-full py-3 text-base">
              Start game
            </button>
            <div className="mt-3 text-xs text-muted">
              <Link href="/settings" className="hover:text-text">change settings →</Link>
            </div>
          </div>
        </div>
      )}

      {started && (
        <div className="grid gap-5 lg:grid-cols-[44px_minmax(0,1fr)_380px]">
          {/* Left: eval bar */}
          <div className="hidden lg:block">
            <div style={{ height: '640px', maxHeight: '85vh' }}>
              <EvalBar score={currentScore} whiteToMove={currentWhiteToMove} orientation={orientation} />
            </div>
          </div>

          {/* Center: clocks + board + controls */}
          <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3">
            <div className="flex items-center justify-between">
              <PlayerTag side={topSide} role="opponent" elo={settings.elo} thinking={thinking} />
              <Clock side={topSide} />
            </div>
            <Board hintLines={pendingHint} onMove={(f, t) => onUserMove(f, t)} />
            <div className="flex items-center justify-between">
              <PlayerTag side={bottomSide} role="you" />
              <Clock side={bottomSide} />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                onClick={handleToggleHint}
                className={'btn ' + (settings.hintMode ? '!border-good/50 !bg-good/15 !text-good' : '')}
              >
                {settings.hintMode ? '✓ Hint on' : 'Hint off'}
              </button>
              <button onClick={undo} disabled={history.length === 0 || status !== 'playing' || exploreActive} className="btn">
                ↶ Undo
              </button>
              <button onClick={resign} disabled={status !== 'playing' || exploreActive} className="btn">
                Resign
              </button>
              {!exploreActive ? (
                <button onClick={() => startExplore()} className="btn">
                  ⚐ Explore
                </button>
              ) : (
                <>
                  <button onClick={resetExplore} className="btn">↺ Reset</button>
                  <button onClick={exitExplore} className="btn btn-primary">Exit explore</button>
                </>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => setViewIndex(Math.max(0, (viewIndex ?? history.length) - 1))}
                  disabled={history.length === 0 || (viewIndex !== null && viewIndex === 0)}
                  className="btn !px-2"
                  title="Previous (←)"
                >
                  ←
                </button>
                <button
                  onClick={() => {
                    if (viewIndex === null) return;
                    const next = viewIndex + 1;
                    setViewIndex(next >= history.length ? null : next);
                  }}
                  disabled={viewIndex === null}
                  className="btn !px-2"
                  title="Next (→)"
                >
                  →
                </button>
                {viewIndex !== null && (
                  <button onClick={() => setViewIndex(null)} className="btn btn-primary">
                    Live
                  </button>
                )}
                {viewIndex === null && (
                  <button onClick={handleStart} className="btn btn-primary">
                    New game
                  </button>
                )}
              </div>
            </div>
            {viewIndex !== null && !exploreActive && (
              <div className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
                Reviewing move {viewIndex + 1} of {history.length} · press <span className="font-mono">→</span> or <span className="font-mono">Esc</span> to return
              </div>
            )}
            {exploreActive && (
              <div className="rounded-md border border-brill/40 bg-brill/10 px-3 py-2 text-xs text-brill">
                Explore mode · move any piece freely · Reset to return to entry · Exit to resume game
              </div>
            )}

            {status === 'ended' && (
              <div className="card mt-2 p-4 text-center">
                <div className="text-lg font-semibold">
                  {endResult === 'draw'
                    ? 'Draw'
                    : `${endResult === 'white' ? 'White' : 'Black'} wins`}
                </div>
                <div className="text-xs text-muted">by {endReason}</div>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    onClick={() => { setViewIndex(0); }}
                    className="btn"
                  >
                    Review moves
                  </button>
                  <button
                    onClick={() => startExplore()}
                    className="btn btn-primary"
                  >
                    Analyze →
                  </button>
                </div>
              </div>
            )}

            <MoveHistory />
          </div>

          {/* Right: coach panel */}
          <div className="min-h-[640px]">
            <CoachPanel />
          </div>
        </div>
      )}

      <PromotionPicker onPick={onPromotionPick} />
    </main>
  );
}

const NOTABLE_LABELS: MoveLabel[] = ['inaccuracy', 'mistake', 'blunder'];
// Trigger LLM only on bad moves. Wins/mates/best moves stay quiet — coach button still available for manual.
function isNotableMove(label: MoveLabel, _flags: PatternFlag[]): boolean {
  return NOTABLE_LABELS.includes(label);
}

function formatTC(s: ReturnType<typeof useGame.getState>['settings']): string {
  if (s.timeControl.initialMs === 0) return 'unlimited';
  const m = s.timeControl.initialMs / 60000;
  const inc = s.timeControl.incrementMs / 1000;
  return `${m}+${inc}`;
}

function PlayerTag({ side, role, elo, thinking }: { side: 'white' | 'black'; role: 'you' | 'opponent'; elo?: number; thinking?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={
          'inline-block h-3 w-3 flex-none rounded-full ' +
          (side === 'white' ? 'bg-white ring-1 ring-border' : 'bg-[#0e1018] ring-1 ring-border')
        }
      />
      <span className="text-sm font-medium flex-none">
        {role === 'you' ? 'You' : 'Stockfish'}
        {role === 'opponent' && elo && <span className="ml-1 text-xs text-muted">{elo}</span>}
      </span>
      {thinking && role === 'opponent' && (
        <span className="ml-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted flex-none">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          thinking
        </span>
      )}
      <Captures by={side} />
    </div>
  );
}
