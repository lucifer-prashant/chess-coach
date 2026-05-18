'use client';

import { useEffect, useState } from 'react';
import { listGames, watchAuth, type SavedGame } from '@/lib/firebase';
import type { User } from 'firebase/auth';

export default function HomeStats() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Array<SavedGame & { id: string }>>([]);

  useEffect(() => watchAuth(setUser), []);
  useEffect(() => {
    if (!user) { setGames([]); return; }
    listGames(user.uid).then(setGames).catch(() => {});
  }, [user]);

  if (!user || games.length === 0) return null;

  const total = games.length;
  const wins = games.filter((g) => {
    const me = g.settings?.userColor === 'w' ? 'white' : 'black';
    return g.result === me;
  }).length;
  const draws = games.filter((g) => g.result === 'draw').length;
  const losses = total - wins - draws;
  const winRate = Math.round((wins / total) * 100);

  let blunders = 0;
  let moves = 0;
  for (const g of games) {
    for (const m of g.history ?? []) {
      if (m.by !== g.settings?.userColor) continue;
      moves++;
      if (m.classification?.label === 'blunder') blunders++;
    }
  }
  const blunderRate = moves > 0 ? ((blunders / moves) * 100).toFixed(1) : '0.0';

  const stats = [
    { label: 'Games', value: total },
    { label: 'Win rate', value: `${winRate}%` },
    { label: 'W / D / L', value: `${wins} / ${draws} / ${losses}` },
    { label: 'Blunder rate', value: `${blunderRate}%` },
  ];

  return (
    <section className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="card p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{s.label}</div>
          <div className="mt-1 font-mono text-xl">{s.value}</div>
        </div>
      ))}
    </section>
  );
}
