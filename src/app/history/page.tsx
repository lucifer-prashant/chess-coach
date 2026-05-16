'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listGames, watchAuth, signInGoogle, type SavedGame } from '@/lib/firebase';
import { useGame } from '@/lib/store';
import type { User } from 'firebase/auth';

export default function HistoryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Array<SavedGame & { id: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => watchAuth(setUser), []);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setGames([]);
      return;
    }
    setLoading(true);
    listGames(user.uid).then((g) => {
      setGames(g);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-muted hover:text-text">← home</Link>
          <h1 className="mt-1 text-3xl font-bold">History</h1>
          {user && <div className="mt-1 text-xs text-muted">{games.length} game{games.length === 1 ? '' : 's'}</div>}
        </div>
        <Link href="/play" className="btn btn-primary">New game →</Link>
      </div>

      {!user && (
        <div className="card p-8 text-center">
          <div className="text-sm text-muted">Sign in to view your saved games.</div>
          <button className="btn btn-primary mt-4" onClick={() => signInGoogle().catch(console.error)}>
            Sign in with Google
          </button>
        </div>
      )}
      {user && loading && (
        <div className="card p-6 text-center text-muted text-sm">Loading…</div>
      )}
      {user && !loading && games.length === 0 && (
        <div className="card p-8 text-center text-sm text-muted">
          No games yet. Finish a game (checkmate, resign, or timeout) and it lands here.
        </div>
      )}
      <ul className="space-y-3">
        {games.map((g) => <GameCard key={g.id} game={g} />)}
      </ul>
    </main>
  );
}

function GameCard({ game }: { game: SavedGame & { id: string } }) {
  const router = useRouter();
  const loadSavedGame = useGame((s) => s.loadSavedGame);
  const openAnalysis = () => {
    loadSavedGame({
      history: game.history,
      result: game.result,
      endReason: game.endReason,
      settings: game.settings,
    });
    router.push('/play');
  };
  const date = game.createdAt
    ? new Date(((game.createdAt as unknown as { seconds: number }).seconds ?? 0) * 1000)
    : null;
  const result = game.result;
  const userWonSide = game.settings?.userColor === 'w' ? 'white' : 'black';
  const outcome =
    result === 'draw' ? 'Draw' :
    result === userWonSide ? 'You won' :
    'You lost';
  const accent =
    outcome === 'You won' ? 'text-good border-good/40 bg-good/10'
    : outcome === 'You lost' ? 'text-bad border-bad/40 bg-bad/10'
    : 'text-muted border-border bg-panel2';

  return (
    <li
      onClick={openAnalysis}
      className="card group cursor-pointer p-4 transition hover:border-accent/50 hover:bg-panel2"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={'chip border ' + accent}>{outcome}</span>
          <span className="text-sm text-muted">
            by <span className="text-text">{game.endReason}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted">
            <span className="font-mono">{game.movesCount} moves</span>
            {date && <span className="ml-3">{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          <span className="text-xs text-muted opacity-0 transition group-hover:opacity-100">analyze →</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted">
        <span>You: <span className="text-text">{game.settings?.userColor === 'w' ? 'White' : 'Black'}</span></span>
        <span>SF: <span className="text-text">ELO {game.settings?.elo ?? '—'}</span></span>
        <span>Depth: <span className="text-text">{game.settings?.depth ?? '—'}</span></span>
      </div>
      <details onClick={(e) => e.stopPropagation()} className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-text">PGN</summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-panel2 p-3 font-mono text-[11px] leading-relaxed text-text/85">
          {game.pgn}
        </pre>
      </details>
    </li>
  );
}
