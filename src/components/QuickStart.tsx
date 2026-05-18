'use client';

import Link from 'next/link';
import { useGame } from '@/lib/store';

const PRESETS = [
  { label: 'Beginner',  elo: 1320, sub: 'casual, forgiving',   accent: 'good',   icon: '🌱' },
  { label: 'Club',      elo: 1700, sub: 'solid tactics',        accent: 'brill',  icon: '♞' },
  { label: 'Strong',    elo: 2200, sub: 'punishes mistakes',    accent: 'warn',   icon: '⚔' },
  { label: 'Master',    elo: 2800, sub: 'top-tier play',        accent: 'bad',    icon: '👑' },
];

const ACCENT_CLS: Record<string, string> = {
  good:  'border-good/30  hover:border-good/60  hover:bg-good/5',
  brill: 'border-brill/30 hover:border-brill/60 hover:bg-brill/5',
  warn:  'border-warn/30  hover:border-warn/60  hover:bg-warn/5',
  bad:   'border-bad/30   hover:border-bad/60   hover:bg-bad/5',
};

export default function QuickStart() {
  const setSettings = useGame((s) => s.setSettings);
  const settings = useGame((s) => s.settings);
  const hasHistory = useGame((s) => s.history.length > 0);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Quick start</h2>
        <Link href="/settings" className="text-xs text-muted hover:text-text">Custom →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PRESETS.map((p) => (
          <Link
            key={p.label}
            href="/play"
            onClick={() => setSettings({ elo: p.elo })}
            className={'card group flex flex-col gap-1 p-4 transition ' + ACCENT_CLS[p.accent]}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{p.icon}</span>
              <span className="font-mono text-xs text-muted">ELO {p.elo}</span>
            </div>
            <div className="mt-2 text-base font-semibold">{p.label}</div>
            <div className="text-xs text-muted">{p.sub}</div>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/play" className="btn btn-primary">
          {hasHistory ? 'Resume game →' : 'Start game →'}
        </Link>
        <span className="text-xs text-muted">
          Current: ELO <span className="font-mono text-text">{settings.elo}</span> ·{' '}
          <span className="font-mono text-text">{settings.userColor === 'w' ? 'White' : 'Black'}</span> ·{' '}
          <Link href="/settings" className="underline hover:text-text">change</Link>
        </span>
      </div>
    </section>
  );
}
