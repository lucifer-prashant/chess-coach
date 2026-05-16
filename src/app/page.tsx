import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <nav className="flex items-center justify-between py-6">
        <div className="text-sm font-semibold tracking-tight">
          <span className="text-accent">♞</span> chess.coach
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/settings" className="text-muted hover:text-text">Settings</Link>
          <Link href="/history" className="text-muted hover:text-text">History</Link>
        </div>
      </nav>

      <section className="flex flex-1 flex-col justify-center py-10">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-panel/50 px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
            Local Stockfish 18 · runs in your browser
          </div>
          <h1 className="text-6xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Play.<br />
            <span className="bg-gradient-to-r from-[#8a6bff] via-[#36c5d6] to-[#5fd97a] bg-clip-text text-transparent">
              Get coached.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted md:text-lg">
            Every move classified by Stockfish. Twelve detectors find the chess facts
            behind it. An LLM puts it in plain English — in two short sentences.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/play" className="btn btn-primary px-6 py-3 text-base">
              Start a game →
            </Link>
            <Link href="/settings" className="btn px-6 py-3 text-base">
              Configure
            </Link>
          </div>
          <FeatureGrid />
        </div>
      </section>

      <footer className="py-6 text-xs text-muted">
        Built with chess.js, chessground, stockfish-wasm, NVIDIA NIM.
      </footer>
    </main>
  );
}

function FeatureGrid() {
  const features = [
    {
      title: 'Live review',
      body: 'Eval bar and label appear in under a second. The coach voice streams in just after.',
    },
    {
      title: 'Hint mode',
      body: 'Toggle on for top-3 arrows before you move. Toggle off to play normally and get reviewed.',
    },
    {
      title: 'Twelve detectors',
      body: 'Hung piece, missed mate, allowed fork, early queen, lost tempo — all flagged automatically.',
    },
    {
      title: 'Your engine',
      body: 'Stockfish runs in your browser. Nothing leaves your machine except optional LLM calls.',
    },
  ];
  return (
    <div className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {features.map((f) => (
        <div key={f.title} className="card p-5">
          <div className="text-sm font-semibold text-text">{f.title}</div>
          <div className="mt-1 text-sm text-muted">{f.body}</div>
        </div>
      ))}
    </div>
  );
}
