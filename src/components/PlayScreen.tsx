'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Chess } from 'chess.js';
import Board from './Board';
import EvalBar from './EvalBar';
import EvalGraph from './EvalGraph';
import Clock from './Clock';
import CoachPanel from './CoachPanel';
import MoveHistory from './MoveHistory';
import PromotionPicker from './PromotionPicker';
import TopNav from './TopNav';
import KeyboardHelp from './KeyboardHelp';
import GameStatusBanner from './GameStatusBanner';
import Captures from './Captures';
import OpeningBadge from './OpeningBadge';
import GameSummary from './GameSummary';
import { useToast } from './Toast';
import { useGame } from '@/lib/store';
import { getAnalyzer, getOpponent, type Score } from '@/lib/engine';
import { classify, scoreToCp } from '@/lib/classify';
import { detectFlags, detectPhase } from '@/lib/detectors';
import { explainMove, type ExplainInput } from '@/lib/nim';
import type { MoveLabel } from '@/lib/classify';
import type { PatternFlag } from '@/lib/detectors';
import { play as playCue, primeAudio } from '@/lib/audio';
import { watchAuth, saveGame } from '@/lib/firebase';

export default function PlayScreen() {
  const toast = useToast();
  const [startedLocal, setStarted] = useState(false);
  const hasHistory = useGame((s) => s.history.length > 0);
  const started = startedLocal || hasHistory;
  const [currentScore, setCurrentScore] = useState<Score | null>(null);
  const [currentWhiteToMove, setCurrentWhiteToMove] = useState<boolean>(true);
  const [thinking, setThinking] = useState(false);
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

  useEffect(() => {
    getAnalyzer().ensureReady().catch(() => {});
    getOpponent().ensureReady().catch(() => {});
  }, []);

  // ---- start game (declared early so keyboard handler can call it) ----
  const handleStart = useCallback(async () => {
    genRef.current++;
    primeAudio();
    newGame();
    setCurrentScore(null);
    setHint(null);
    setStarted(true);
    if (settings.audioEnabled) playCue('start');

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
  }, [newGame, settings, setHint, applyMove]);

  const handleToggleHint = useCallback(() => {
    const next = !settings.hintMode;
    setSettings({ hintMode: next });
    toast.push(next ? 'Hint mode on' : 'Hint mode off', 'info');
    if (!next) { setHint(null); return; }
    if (status === 'playing' && toMove === settings.userColor) {
      getAnalyzer().analyze({
        fen: useGame.getState().fen,
        depth: settings.depth,
        multipv: 3,
      }).then((r) => setHint(r.lines)).catch(() => {});
    }
  }, [settings, setSettings, setHint, status, toMove, toast]);

  // Keyboard.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useGame.getState();
      const key = e.key;
      if (key === 'ArrowLeft') {
        e.preventDefault();
        const cur = st.viewIndex ?? st.history.length;
        if (cur > 0) setViewIndex(cur - 1);
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        if (st.viewIndex === null) return;
        const next = st.viewIndex + 1;
        setViewIndex(next >= st.history.length ? null : next);
      } else if (key === 'Escape' || key === 'End') {
        e.preventDefault();
        setViewIndex(null);
      } else if (key === 'Home') {
        e.preventDefault();
        if (st.history.length > 0) setViewIndex(0);
      } else if (key === 'n' || key === 'N') {
        if (st.status !== 'playing') handleStart();
      } else if (key === 'r' || key === 'R') {
        if (st.status === 'playing') {
          if (confirm('Resign this game?')) resign();
        }
      } else if (key === 'u' || key === 'U') {
        if (st.status === 'playing' && st.history.length > 0 && !st.exploreActive) undo();
      } else if (key === 'h' || key === 'H') {
        handleToggleHint();
      } else if (key === 'e' || key === 'E') {
        if (st.exploreActive) exitExplore();
        else startExplore();
      } else if (key === 'f' || key === 'F') {
        const cur = useGame.getState().settings.boardFlipped;
        useGame.getState().setSettings({ boardFlipped: !cur });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setViewIndex, handleStart, resign, undo, handleToggleHint, startExplore, exitExplore]);

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
      toast.push('Coach error: ' + (err.message ?? err), 'error');
    });
  }, [attachExplanation, toast]);

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

  const exploreFen = useGame((s) => s.exploreFen);
  useEffect(() => {
    if (!started) return;
    const useExplore = exploreActive;
    if (!useExplore) {
      if (status !== 'playing') return;
      if (toMove !== settings.userColor) return;
    }
    if (!settings.hintMode) { setHint(null); return; }
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

  const syncExploreToViewIndex = useGame((s) => s.syncExploreToViewIndex);
  useEffect(() => {
    if (status === 'ended' && exploreActive) {
      if (viewIndex !== null && history.length > 0) syncExploreToViewIndex(viewIndex);
      else if (viewIndex === null) startExplore();
    }
  }, [viewIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedRef = useRef(false);
  const playedThisSessionRef = useRef(false);
  useEffect(() => { if (status === 'playing') playedThisSessionRef.current = true; }, [status]);
  useEffect(() => {
    if (status !== 'ended' || savedRef.current) return;
    if (!playedThisSessionRef.current) return;
    savedRef.current = true;
    if (history.length === 0) return;
    const reason = useGame.getState().endReason;
    if (reason === 'checkmate' || reason === 'resign' || reason === 'timeout') playCue('mate');
    const result = useGame.getState().endResult;
    const userWon = (result === 'white' && settings.userColor === 'w') || (result === 'black' && settings.userColor === 'b');
    toast.push(result === 'draw' ? 'Game drawn' : userWon ? `You won by ${reason}` : `You lost by ${reason}`, userWon ? 'success' : result === 'draw' ? 'info' : 'warn');
    const off = watchAuth(async (user) => {
      if (!user) return;
      const chess = new Chess();
      for (const m of history) { try { chess.move(m.san); } catch {} }
      await saveGame(user.uid, {
        result: useGame.getState().endResult ?? 'draw',
        endReason: (useGame.getState().endReason ?? 'unknown') as string,
        movesCount: history.length,
        pgn: chess.pgn(),
        history,
        settings,
      }).then(() => toast.push('Game saved to history', 'success')).catch(console.error);
      off();
    });
  }, [status, history, settings, toast]);

  useEffect(() => { if (status === 'playing') savedRef.current = false; }, [status]);

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
    runMoveReview(fenBefore, rec.uci);
  }, [status, toMove, settings, applyMove]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPromotionPick = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPromotion(null);
    if (exploreActive) { exploreMoveAction({ from, to, promotion: piece }); return; }
    onUserMove(from, to, piece);
  }, [pendingPromotion, setPromotion, onUserMove, exploreActive, exploreMoveAction]);

  const runMoveReview = useCallback(async (fenBefore: string, playedUci: string) => {
    const myGen = ++genRef.current;
    const aliveCheck = () => genRef.current === myGen;
    const analyzer = getAnalyzer();
    const fenAfter = useGame.getState().fen;
    const moverWasWhite = fenBefore.split(' ')[1] === 'w';

    const beforeAnalysis = await analyzer.analyze({ fen: fenBefore, depth: settings.depth, multipv: 3 }).catch(() => null);
    const afterAnalysis = await analyzer.analyze({ fen: fenAfter, depth: settings.depth, multipv: 1 }).catch(() => null);

    if (beforeAnalysis && afterAnalysis && aliveCheck()) {
      const bestLine = beforeAnalysis.lines[0];
      const playedScore = afterAnalysis.lines[0]?.score ?? null;
      if (bestLine && playedScore) {
        const evalBeforeMover = scoreToCp(bestLine.score, moverWasWhite);
        const evalAfterMover = -scoreToCp(playedScore, !moverWasWhite);
        const hadMateBefore = bestLine.score.type === 'mate' && bestLine.score.value > 0;
        const isOnlyMove = beforeAnalysis.lines.length === 1;
        const phase = detectPhase(fenBefore);
        const fullMove = parseInt(fenBefore.split(' ')[5] ?? '1', 10);
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
          } catch { bestReplyMove = null; }
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
          fenBefore, fenAfter,
          movePlayedUci: playedUci,
          movePlayedSan: useGame.getState().history.slice(-1)[0]?.san ?? '',
          bestMoveUci, bestReplyUci, bestReplyMove,
          hadMateBefore, fullMoveNumber: fullMove, phase,
        });
        const c = classify(evalBeforeMover, evalAfterMover, { wasOnlyMove: isOnlyMove });
        const st = useGame.getState();
        if (st.endReason === 'checkmate' && st.status === 'ended') {
          c.label = 'best';
          c.matePivot = 'kept-mate';
        }
        attachAnalysisToLastMove({
          classification: c, flags, bestMoveUci, bestMoveSan,
          evalBefore: bestLine.score, evalAfter: playedScore,
          topLines: beforeAnalysis.lines,
        });
        setCurrentScore(playedScore);
        setCurrentWhiteToMove(!moverWasWhite);
        if (settings.audioEnabled && c.label === 'blunder') playCue('blunder');
        const shouldAutoExplain =
          settings.llmEnabled && settings.nimKey &&
          (settings.llmStrategy === 'always' ||
            (settings.llmStrategy === 'auto' && isNotableMove(c.label, flags)));
        if (shouldAutoExplain) {
          streamExplanation({
            classification: c, flags, phase, fenBefore, fenAfter,
            playedSan: useGame.getState().history.slice(-1)[0]?.san ?? '',
            bestMoveSan,
            evalBefore: bestLine.score, evalAfter: playedScore,
            moverColorName: moverWasWhite ? 'white' : 'black',
          });
        }
      }
    }

    if (useGame.getState().status === 'playing' && aliveCheck()) {
      const opp = getOpponent();
      setThinking(true);
      const reply = await opp.play({ fen: fenAfter, elo: settings.elo }).catch(() => null);
      setThinking(false);
      if (!reply || !aliveCheck() || useGame.getState().fen !== fenAfter) return;
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
  }, [settings, attachAnalysisToLastMove, applyMove, streamExplanation]);

  const userIsWhite = settings.userColor === 'w';
  const baseOrient = userIsWhite ? 'white' as const : 'black' as const;
  const orientation = settings.boardFlipped
    ? (baseOrient === 'white' ? 'black' : 'white') as 'white' | 'black'
    : baseOrient;
  const topSide = orientation === 'white' ? 'black' as const : 'white' as const;
  const bottomSide = orientation === 'white' ? 'white' as const : 'black' as const;

  const handleResign = () => {
    if (confirm('Resign this game?')) resign();
  };

  const handleFlip = () => setSettings({ boardFlipped: !settings.boardFlipped });

  const copyPgn = async () => {
    const chess = new Chess();
    for (const m of history) { try { chess.move(m.san); } catch {} }
    try {
      await navigator.clipboard.writeText(chess.pgn());
      toast.push('PGN copied', 'success');
    } catch {
      toast.push('Clipboard blocked', 'error');
    }
  };

  return (
    <>
      <TopNav extra={
        started && (
          <span className="hidden md:inline-flex items-center gap-2 rounded-md border border-border bg-panel2/80 px-3 py-1.5 font-mono text-xs text-muted">
            ELO {settings.elo} · d{settings.depth}
          </span>
        )
      } />
      <KeyboardHelp />
      <main className="mx-auto max-w-[1500px] px-4 py-4 lg:px-6">

        {!started && (
          <div className="mx-auto mt-12 max-w-md">
            <div className="card pop p-8 text-center">
              <div className="mx-auto mb-3 text-6xl">♞</div>
              <h2 className="text-2xl font-bold">Ready?</h2>
              <p className="mt-2 text-sm text-muted">
                You play <span className="text-text font-semibold">{userIsWhite ? 'White' : 'Black'}</span> vs Stockfish{' '}
                ELO <span className="text-text font-semibold">{settings.elo}</span>.<br />
                Time: <span className="text-text font-semibold">{formatTC(settings)}</span> · Depth: <span className="text-text font-semibold">{settings.depth}</span>
              </p>
              <button onClick={handleStart} className="btn btn-primary mt-6 w-full py-3 text-base">
                Start game
              </button>
              <div className="mt-4 flex justify-center gap-3 text-xs text-muted">
                <Link href="/settings" className="hover:text-text underline">change settings</Link>
                <span>·</span>
                <span>press <kbd>?</kbd> for shortcuts</span>
              </div>
            </div>
          </div>
        )}

        {started && (
          <div className="grid gap-4 lg:grid-cols-[44px_minmax(0,1fr)_360px]">
            {/* Eval bar */}
            <div className="hidden lg:block">
              <div style={{ height: '640px', maxHeight: '85vh' }}>
                <EvalBar score={currentScore} whiteToMove={currentWhiteToMove} orientation={orientation} />
              </div>
            </div>

            {/* Center: board + controls */}
            <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <OpeningBadge />
                <div className="flex items-center gap-2">
                  <button onClick={handleFlip} className="btn btn-sm btn-ghost" title="Flip board (F)">⇅ Flip</button>
                  <button onClick={copyPgn} disabled={history.length === 0} className="btn btn-sm btn-ghost" title="Copy PGN">📋 PGN</button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <PlayerTag side={topSide} role={topSide === (userIsWhite ? 'black' : 'white') ? 'opponent' : 'you'} elo={settings.elo} thinking={thinking} />
                <Clock side={topSide} />
              </div>

              <Board hintLines={pendingHint} onMove={(f, t) => onUserMove(f, t)} />

              <div className="flex items-center justify-between">
                <PlayerTag side={bottomSide} role={bottomSide === (userIsWhite ? 'white' : 'black') ? 'you' : 'opponent'} elo={settings.elo} thinking={thinking} />
                <Clock side={bottomSide} />
              </div>

              <GameStatusBanner />

              <ControlBar
                hintOn={settings.hintMode}
                onHint={handleToggleHint}
                canUndo={history.length > 0 && status === 'playing' && !exploreActive}
                onUndo={undo}
                canResign={status === 'playing' && !exploreActive}
                onResign={handleResign}
                exploreActive={exploreActive}
                onExplore={() => { startExplore(); toast.push('Explore mode — branch freely', 'info'); }}
                onExploreReset={resetExplore}
                onExploreExit={exitExplore}
                viewIndex={viewIndex}
                historyLength={history.length}
                onPrev={() => setViewIndex(Math.max(0, (viewIndex ?? history.length) - 1))}
                onNext={() => {
                  if (viewIndex === null) return;
                  const next = viewIndex + 1;
                  setViewIndex(next >= history.length ? null : next);
                }}
                onFirst={() => { if (history.length > 0) setViewIndex(0); }}
                onLive={() => setViewIndex(null)}
                onNewGame={handleStart}
                gameEnded={status === 'ended'}
              />
            </div>

            {/* Right: moves big, coach collapsible, eval graph */}
            <div className="flex min-h-[640px] flex-col gap-3">
              <MoveHistory maxHeight="540px" />
              <CoachPanel />
              <EvalGraph />
            </div>
          </div>
        )}

        <GameSummary onJump={(ply) => setViewIndex(ply)} />
        <PromotionPicker onPick={onPromotionPick} />
      </main>
    </>
  );
}

interface ControlBarProps {
  hintOn: boolean;
  onHint: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canResign: boolean;
  onResign: () => void;
  exploreActive: boolean;
  onExplore: () => void;
  onExploreReset: () => void;
  onExploreExit: () => void;
  viewIndex: number | null;
  historyLength: number;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLive: () => void;
  onNewGame: () => void;
  gameEnded: boolean;
}

function ControlBar(p: ControlBarProps) {
  const reviewing = p.viewIndex !== null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!p.exploreActive ? (
        <>
          <button
            onClick={p.onHint}
            title="Toggle hint (H)"
            className={'btn btn-sm ' + (p.hintOn ? '!border-good/50 !bg-good/10 !text-good' : '')}
          >
            {p.hintOn ? '💡 Hint on' : '💡 Hint'}
          </button>
          <button onClick={p.onUndo} disabled={!p.canUndo} className="btn btn-sm" title="Undo (U)">
            ↶ Undo
          </button>
          <button onClick={p.onResign} disabled={!p.canResign} className="btn btn-sm" title="Resign (R)">
            🏳 Resign
          </button>
          <button onClick={p.onExplore} className="btn btn-sm" title="Explore (E)">
            ⚐ Explore
          </button>
        </>
      ) : (
        <>
          <button onClick={p.onExploreReset} className="btn btn-sm">↺ Reset branch</button>
          <button onClick={p.onExploreExit} className="btn btn-sm btn-primary">Exit explore</button>
        </>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={p.onFirst}
          disabled={p.historyLength === 0 || p.viewIndex === 0}
          className="btn btn-icon btn-sm"
          title="First (Home)"
        >⇤</button>
        <button
          onClick={p.onPrev}
          disabled={p.historyLength === 0 || (reviewing && p.viewIndex === 0)}
          className="btn btn-icon btn-sm"
          title="Prev (←)"
        >←</button>
        <button
          onClick={p.onNext}
          disabled={!reviewing}
          className="btn btn-icon btn-sm"
          title="Next (→)"
        >→</button>
        {reviewing ? (
          <button onClick={p.onLive} className="btn btn-sm btn-primary" title="Live (End)">Live ⇥</button>
        ) : (
          <button onClick={p.onNewGame} className="btn btn-sm btn-primary" title="New game (N)">
            + New
          </button>
        )}
      </div>
    </div>
  );
}

const NOTABLE_LABELS: MoveLabel[] = ['inaccuracy', 'mistake', 'blunder'];
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
      <span className="text-sm font-semibold flex-none">
        {role === 'you' ? 'You' : 'Stockfish'}
        {role === 'opponent' && elo && <span className="ml-1 text-xs font-normal text-muted">{elo}</span>}
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
