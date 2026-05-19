import Link from 'next/link';
import TopNav from '@/components/TopNav';
import HomeStats from '@/components/HomeStats';
import QuickStart from '@/components/QuickStart';

export default function Home() {
  return (
    <>
      <TopNav />
      <main className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">

        <section className="pt-12 pb-6">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-panel/50 px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
              Stockfish 18 · runs in your browser · zero server
            </div>
            <h1 className="text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
              Play.<br />
              <span className="bg-gradient-to-r from-[#8a6bff] via-[#36c5d6] to-[#5fd97a] bg-clip-text text-transparent">
                Get coached.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted md:text-lg">
              Every move classified by Stockfish. Twelve detectors find the chess
              facts behind it. An LLM puts it in plain English.
            </p>
          </div>
        </section>

        <HomeStats />

        <QuickStart />

        <FeatureGrid />

        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted">
          Built with chess.js · chessground · stockfish-wasm · NVIDIA NIM. ·{' '}
          <Link className="hover:text-text" href="/settings">Settings</Link>
        </footer>
      </main>
    </>
  );
}

function FeatureGrid() {
  const features = [
    { icon: '⚡', title: 'Live review', body: 'Eval bar and label appear in under a second. Coach voice streams after.' },
    { icon: '💡', title: 'Hint mode', body: 'Toggle top-3 arrows before you move. Off = play normal, get reviewed.' },
    { icon: '🎯', title: 'Twelve detectors', body: 'Hung piece, missed mate, allowed fork, early queen, lost tempo — all flagged.' },
    { icon: '🔒', title: 'Your engine', body: 'Stockfish runs in your browser. Nothing leaves except optional LLM calls.' },
    { icon: '🔍', title: 'Explore mode', body: 'Branch the position. Try ideas. Reset to entry. Never lose your spot.' },
    { icon: '📈', title: 'Eval graph', body: 'See momentum across the whole game. Click any move to jump.' },
  ];
  return (
    <section className="mt-14">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Features</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card p-5 transition hover:border-accent/40">
            <div className="text-2xl">{f.icon}</div>
            <div className="mt-2 text-sm font-semibold text-text">{f.title}</div>
            <div className="mt-1 text-sm text-muted">{f.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
