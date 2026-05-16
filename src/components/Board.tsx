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
  // leave room: ~520px for right panel + 60 eval bar + paddings on wide; less on narrow
  const horizPanels = w >= 1024 ? 520 + 60 + 80 : 60;
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
  const status = useGame((s) => s.status);
  const setPromotion = useGame((s) => s.setPromotion);
  const lastUci = useGame((s) => s.history[s.history.length - 1]?.uci);
  const lastMove = useMemo<[Key, Key] | undefined>(() => {
    if (exploreActive) {
      return exploreLast ? [exploreLast.from as Key, exploreLast.to as Key] : undefined;
    }
    return lastUci ? [lastUci.slice(0, 2) as Key, lastUci.slice(2, 4) as Key] : undefined;
  }, [lastUci, exploreActive, exploreLast]);

  // Recompute size on window resize.
  useEffect(() => {
    const onResize = () => setSize(computeSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Initialize chessground once.
  useEffect(() => {
    if (!boardRef.current) return;
    if (apiRef.current) return;
    const config: Config = {
      fen,
      orientation: userColor === 'w' ? 'white' : 'black',
      turnColor: toMove === 'w' ? 'white' : 'black',
      movable: {
        free: false,
        color: userColor === 'w' ? 'white' : 'black',
        showDests: true,
        dests: computeDests(fen),
        events: {
          after: (orig, dest) => handleMove(orig, dest),
        },
      },
      draggable: { showGhost: true },
      animation: { enabled: true, duration: 180 },
      highlight: { lastMove: true, check: true },
      drawable: { enabled: true, visible: true },
    };
    apiRef.current = Chessground(boardRef.current, config);
    // Force layout flush + redraw to lock in geometry.
    requestAnimationFrame(() => apiRef.current?.redrawAll());

    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw on size change.
  useEffect(() => {
    if (apiRef.current) requestAnimationFrame(() => apiRef.current?.redrawAll());
  }, [size]);

  // Sync state.
  useEffect(() => {
    if (!apiRef.current) return;
    const canMove =
      exploreActive
        ? true
        : !reviewing && status === 'playing' && toMove === userColor;
    const movableColor = exploreActive
      ? (toMove === 'w' ? 'white' : 'black')
      : (userColor === 'w' ? 'white' : 'black');
    apiRef.current.set({
      fen,
      orientation: userColor === 'w' ? 'white' : 'black',
      turnColor: toMove === 'w' ? 'white' : 'black',
      lastMove: reviewing ? undefined : lastMove,
      movable: {
        color: movableColor,
        dests: canMove ? computeDests(fen) : new Map(),
      },
    });
  }, [fen, toMove, userColor, status, lastMove, reviewing, exploreActive]);

  // Hint arrows.
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
    apiRef.current.setAutoShapes(shapes);
  }, [hintLines, reviewing]);

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

  return (
    <div
      className="mx-auto overflow-hidden rounded-lg shadow-2xl ring-1 ring-border"
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
