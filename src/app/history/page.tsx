'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listGames, watchAuth, signInGoogle, deleteGame, type SavedGame } from '@/lib/firebase';
import { useGame } from '@/lib/store';
import TopNav from '@/components/TopNav';
import { useToast } from '@/components/Toast';
import type { User } from 'firebase/auth';
import type { MoveLabel } from '@/lib/classify';

type Filter = 'all' | 'wins' | 'losses' | 'draws';
type SortBy = 'date' | 'moves' | 'elo';

export default function HistoryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Array<SavedGame & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortBy>('date');
  const [search, setSearch] = useState('');
  const toast = useToast();

  useEffect(() => watchAuth(setUser), []);
  useEffect(() => {
    if (!user) { setLoading(false); setGames([]); return; }
    setLoading(true);
    listGames(user.uid).then((g) => { setGames(g); setLoading(false); }).catch(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => computeStats(games), [games]);

  const filtered = useMemo(() => {
    const userColorOf = (g: SavedGame) => g.settings?.userColor === 'w' ? 'white' : 'black';
    let out = games.filter((g) => {
      if (filter === 'all') return true;
      const me = userColorOf(g);
      if (filter === 'wins') return g.result === me;
      if (filter === 'losses') return g.result !== me && g.result !== 'draw';
      return g.result === 'draw';
    });
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((g) => g.pgn?.toLowerCase().includes(q) || g.endReason?.toLowerCase().includes(q));
    }
    out = [...out].sort((a, b) => {
      if (sort === 'moves') return b.movesCount - a.movesCount;
      if (sort === 'elo') return (b.settings?.elo ?? 0) - (a.settings?.elo ?? 0);
      const ta = (a.createdAt as any)?.seconds ?? 0;
      const tb = (b.createdAt as any)?.seconds ?? 0;
      return tb - ta;
    });
    return out;
  }, [games, filter, sort, search]);

  const onDelete = async (id: string) => {
    if (!confirm('Delete this game permanently?')) return;
    await deleteGame(id).then(() => {
      setGames((g) => g.filter((x) => x.id !== id));
      toast.push('Game deleted', 'success');
    }).catch((e) => toast.push('Delete failed: ' + e.message, 'error'));
  };

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">History</h1>
            {user && <p className="mt-1 text-sm text-muted">{games.length} game{games.length === 1 ? '' : 's'}</p>}
          </div>
          <Link href="/play" className="btn btn-primary">+ New game</Link>
        </header>

        {!user && (
          <div className="card p-10 text-center">
            <div className="mx-auto mb-4 text-5xl">📚</div>
            <h2 className="text-xl font-semibold">Sign in to see your games</h2>
            <p className="mt-2 text-sm text-muted">Games sync to Firestore. Local-only mode available too — but history requires sign-in.</p>
            <button className="btn btn-primary mt-5" onClick={() => signInGoogle().catch(console.error)}>
              Sign in with Google
            </button>
          </div>
        )}

        {user && loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="shimmer h-24 rounded-xl" />)}
          </div>
        )}

        {user && !loading && games.length === 0 && (
          <div className="card p-10 text-center">
            <div className="mx-auto mb-4 text-5xl">♟️</div>
            <h2 className="text-xl font-semibold">No games yet</h2>
            <p className="mt-2 text-sm text-muted">Finish a game (checkmate, resign, or timeout) and it lands here.</p>
            <Link href="/play" className="btn btn-primary mt-5">Play first game →</Link>
          </div>
        )}

        {user && games.length > 0 && (
          <>
            {/* Stats strip */}
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Win rate" value={`${stats.winRate}%`} accent="good" />
              <Stat label="W / D / L" value={`${stats.wins} / ${stats.draws} / ${stats.losses}`} />
              <Stat label="Avg moves" value={stats.avgMoves.toString()} />
              <Stat label="Blunder rate" value={`${stats.blunderRate}%`} accent={stats.blunderRate > 5 ? 'bad' : 'good'} />
            </div>

            {/* Filter bar */}
            <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
              <div className="flex gap-1">
                {(['all', 'wins', 'losses', 'draws'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={
                      'rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ' +
                      (filter === f ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-panel2 hover:text-text')
                    }
                  >{f}</button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search PGN / reason…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[160px] rounded-md border border-border bg-panel2 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortBy)}
                className="rounded-md border border-border bg-panel2 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
              >
                <option value="date">Newest</option>
                <option value="moves">Most moves</option>
                <option value="elo">Highest ELO</option>
              </select>
            </div>

            {filtered.length === 0 && (
              <div className="card p-6 text-center text-sm text-muted">No games match.</div>
            )}

            <ul className="space-y-3">
              {filtered.map((g) => <GameCard key={g.id} game={g} onDelete={() => onDelete(g.id)} />)}
            </ul>
          </>
        )}
      </main>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'good' | 'bad' }) {
  const valCls = accent === 'good' ? 'text-good' : accent === 'bad' ? 'text-bad' : '';
  return (
    <div className="card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className={'mt-1 font-mono text-xl ' + valCls}>{value}</div>
    </div>
  );
}

function GameCard({ game, onDelete }: { game: SavedGame & { id: string }; onDelete: () => void }) {
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
  const userColor = game.settings?.userColor === 'w' ? 'white' : 'black';
  const outcome = game.result === 'draw' ? 'Draw' : game.result === userColor ? 'Won' : 'Lost';
  const accent =
    outcome === 'Won' ? 'text-good border-good/40 bg-good/10'
    : outcome === 'Lost' ? 'text-bad border-bad/40 bg-bad/10'
    : 'text-muted border-border bg-panel2';

  const blunders = (game.history ?? []).filter((m) => m.by === game.settings?.userColor && m.classification?.label === 'blunder').length;

  return (
    <li className="card group p-5 transition hover:border-accent/50">
      <div className="flex items-start justify-between gap-4">
        <div onClick={openAnalysis} className="flex flex-1 cursor-pointer items-center gap-4">
          <span className={'chip border ' + accent}>{outcome}</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-muted">by <span className="font-medium text-text">{game.endReason}</span></span>
              <span className="font-mono text-xs text-muted">{game.movesCount} moves</span>
              {blunders > 0 && (
                <span className="rounded bg-bad/15 px-2 py-0.5 text-xs font-semibold text-bad">
                  ⚠ {blunders} blunder{blunders === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span>You: <span className="text-text">{game.settings?.userColor === 'w' ? '♔ White' : '♚ Black'}</span></span>
              <span>SF: <span className="text-text">ELO {game.settings?.elo ?? '—'}</span></span>
              <span>d{game.settings?.depth ?? '—'}</span>
              {date && <span>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button onClick={openAnalysis} className="btn btn-sm btn-primary">Analyze →</button>
          <button onClick={onDelete} className="text-xs text-muted hover:text-bad">Delete</button>
        </div>
      </div>
      <details onClick={(e) => e.stopPropagation()} className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-text">View PGN</summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-panel2 p-3 font-mono text-[11px] leading-relaxed text-text/85">
          {game.pgn}
        </pre>
      </details>
    </li>
  );
}

function computeStats(games: Array<SavedGame & { id: string }>) {
  const total = games.length || 1;
  let wins = 0, draws = 0, losses = 0;
  let moveSum = 0;
  let userMoves = 0;
  let blunders = 0;
  for (const g of games) {
    const me = g.settings?.userColor === 'w' ? 'white' : 'black';
    if (g.result === 'draw') draws++;
    else if (g.result === me) wins++;
    else losses++;
    moveSum += g.movesCount ?? 0;
    for (const m of g.history ?? []) {
      if (m.by !== g.settings?.userColor) continue;
      userMoves++;
      if ((m.classification?.label as MoveLabel) === 'blunder') blunders++;
    }
  }
  return {
    wins, draws, losses,
    winRate: Math.round((wins / total) * 100),
    avgMoves: Math.round(moveSum / total),
    blunderRate: userMoves > 0 ? +((blunders / userMoves) * 100).toFixed(1) : 0,
  };
}
