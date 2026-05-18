'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import { Chess, type Square } from 'chess.js';
import { useGame } from '@/lib/store';
import type { AnalysisLine } from '@/lib/engine';

interface BoardProps {
  hintLines?: AnalysisLine[] | null;
  onMove?: (from: string, to: string, promotion?: string) => void;
}

function computeSize(): number {
  if (typeof window === 'undefined') return 480;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const horizPanels = w >= 1024 ? 500 + 60 + 80 : 60;
  const maxFromWidth = w - horizPanels;
  const maxFromHeight = h - 220;
  const raw = Math.min(640, maxFromWidth, maxFromHeight);
  return Math.max(320, Math.floor(raw / 8) * 8);
}

export default function Board({ hintLines, onMove }: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const [size, setSize] = useState<number>(() => (typeof window === 'undefined' ? 480 : computeSize()));

  const liveFen = useGame((s) => s.fen);
  const viewIndex = useGame((s) => s.viewIndex);
  const viewedFen = useGame((s) =>
    s.viewIndex !== null && s.history[s.viewIndex] ? s.history[s.viewIndex].fenAfter : null,
  );
  const viewedMove = useGame((s) =>
    s.viewIndex !== null && s.history[s.viewIndex] ? s.history[s.viewIndex] : null,
  );
  const exploreActive = useGame((s) => s.exploreActive);
  const exploreFen = useGame((s) => s.exploreFen);
  const exploreLast = useGame((s) => s.exploreLast);
  const exploreMoveAction = useGame((s) => s.exploreMove);
  const fen = exploreActive ? exploreFen : (viewedFen ?? liveFen);
  const reviewing = !exploreActive && viewIndex !== null;
  const fenSideToMove: 'white' | 'black' = (fen.split(' ')[1] === 'w' ? 'white' : 'black');
  const liveToMove = useGame((s) => s.toMove);
  const toMove = exploreActive ? (fenSideToMove === 'white' ? 'w' : 'b') : liveToMove;
  const userColor = useGame((s) => s.settings.userColor);
  const flipped = useGame((s) => s.settings.boardFlipped);
  const theme = useGame((s) => s.settings.boardTheme);
  const showCoords = useGame((s) => s.settings.showCoords);
  const showBestArrowReview = useGame((s) => s.settings.showBestArrowInReview);
  const animationsEnabled = useGame((s) => s.settings.animationsEnabled);
  const status = useGame((s) => s.status);
  const setPromotion = useGame((s) => s.setPromotion);
  const lastUci = useGame((s) => s.history[s.history.length - 1]?.uci);
  const lastMove = useMemo<[Key, Key] | undefined>(() => {
    if (exploreActive) return exploreLast ? [exploreLast.from as Key, exploreLast.to as Key] : undefined;
    if (reviewing && viewedMove?.uci) {
      return [viewedMove.uci.slice(0, 2) as Key, viewedMove.uci.slice(2, 4) as Key];
    }
    return lastUci ? [lastUci.slice(0, 2) as Key, lastUci.slice(2, 4) as Key] : undefined;
  }, [lastUci, exploreActive, exploreLast, reviewing, viewedMove]);

  const baseOrient = userColor === 'w' ? 'white' : 'black';
  const orientation = flipped ? (baseOrient === 'white' ? 'black' : 'white') : baseOrient;

  useEffect(() => {
    const onResize = () => setSize(computeSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!boardRef.current) return;
    if (apiRef.current) return;
    const config: Config = {
      fen,
      orientation,
      turnColor: toMove === 'w' ? 'white' : 'black',
      coordinates: showCoords,
      movable: {
        free: false,
        color: baseOrient,
        showDests: true,
        dests: computeDests(fen),
        events: { after: (orig, dest) => handleMove(orig, dest) },
      },
      draggable: { showGhost: true },
      animation: { enabled: animationsEnabled, duration: animationsEnabled ? 180 : 0 },
      highlight: { lastMove: true, check: true },
      drawable: { enabled: true, visible: true },
    };
    apiRef.current = Chessground(boardRef.current, config);
    requestAnimationFrame(() => apiRef.current?.redrawAll());

    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (apiRef.current) requestAnimationFrame(() => apiRef.current?.redrawAll());
  }, [size]);

  useEffect(() => {
    if (!apiRef.current) return;
    const canMove = exploreActive
      ? true
      : !reviewing && status === 'playing' && toMove === userColor;
    const movableColor = exploreActive
      ? (toMove === 'w' ? 'white' : 'black')
      : baseOrient;
    apiRef.current.set({
      fen,
      orientation,
      turnColor: toMove === 'w' ? 'white' : 'black',
      coordinates: showCoords,
      animation: { enabled: animationsEnabled, duration: animationsEnabled ? 180 : 0 },
      lastMove,
      movable: {
        color: movableColor,
        dests: canMove ? computeDests(fen) : new Map(),
      },
    });
  }, [fen, toMove, userColor, status, lastMove, reviewing, exploreActive, orientation, showCoords, animationsEnabled, baseOrient]);

  // Arrows: hints (live), best move (review).
  useEffect(() => {
    if (!apiRef.current) return;
    const shapes: DrawShape[] = [];
    if (!reviewing && hintLines && hintLines.length > 0) {
      hintLines.slice(0, 3).forEach((line, i) => {
        const move = line.pv[0];
        if (!move) return;
        shapes.push({
          orig: move.slice(0, 2) as Key,
          dest: move.slice(2, 4) as Key,
          brush: i === 0 ? 'green' : i === 1 ? 'yellow' : 'red',
        });
      });
    }
    if (reviewing && showBestArrowReview && viewedMove?.bestMoveUci && viewedMove.bestMoveUci !== viewedMove.uci) {
      shapes.push({
        orig: viewedMove.bestMoveUci.slice(0, 2) as Key,
        dest: viewedMove.bestMoveUci.slice(2, 4) as Key,
        brush: 'green',
      });
    }
    apiRef.current.setAutoShapes(shapes);
  }, [hintLines, reviewing, showBestArrowReview, viewedMove]);

  function handleMove(orig: Key, dest: Key) {
    const st = useGame.getState();
    const sourceFen = st.exploreActive ? st.exploreFen : st.fen;
    const game = new Chess(sourceFen);
    const piece = game.get(orig as Square);
    if (piece?.type === 'p') {
      const lastRank = piece.color === 'w' ? '8' : '1';
      if ((dest as string)[1] === lastRank) {
        setPromotion({ from: orig as string, to: dest as string });
        apiRef.current?.set({ fen: sourceFen });
        return;
      }
    }
    if (st.exploreActive) {
      const ok = exploreMoveAction({ from: orig as string, to: dest as string });
      if (!ok) apiRef.current?.set({ fen: sourceFen });
      return;
    }
    onMove?.(orig as string, dest as string);
  }

  const themeClass = theme === 'brown' ? '' : `board-theme-${theme}`;
  const coordsClass = showCoords ? '' : 'no-coords';

  return (
    <div
      className={'mx-auto overflow-hidden rounded-lg shadow-2xl ring-1 ring-border ' + themeClass + ' ' + coordsClass}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <div
        ref={boardRef}
        className="cg-wrap"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    </div>
  );
}

function computeDests(fen: string): Map<Key, Key[]> {
  const game = new Chess(fen);
  const dests = new Map<Key, Key[]>();
  const squares: Square[] = [];
  for (const file of 'abcdefgh') {
    for (const rank of '12345678') {
      squares.push((file + rank) as Square);
    }
  }
  for (const sq of squares) {
    const moves = game.moves({ square: sq, verbose: true }) as { to: string }[];
    if (moves.length) dests.set(sq as Key, moves.map((m) => m.to as Key));
  }
  return dests;
}
