'use client';

import { useGame } from '@/lib/store';

export default function GameStatusBanner() {
  const status = useGame((s) => s.status);
  const endReason = useGame((s) => s.endReason);
  const endResult = useGame((s) => s.endResult);
  const toMove = useGame((s) => s.toMove);
  const settings = useGame((s) => s.settings);
  const viewIndex = useGame((s) => s.viewIndex);
  const history = useGame((s) => s.history);
  const exploreActive = useGame((s) => s.exploreActive);

  if (exploreActive) {
    return (
      <Banner tone="brill">
        <span className="font-semibold">Explore mode</span> · move any piece freely · Reset to return · Exit to resume.
      </Banner>
    );
  }

  if (viewIndex !== null) {
    return (
      <Banner tone="accent">
        Reviewing move {viewIndex + 1} / {history.length} · <kbd>→</kbd> or <kbd>Esc</kbd> = live
      </Banner>
    );
  }

  if (status === 'ended') {
    const winner = endResult === 'draw' ? 'Draw' : `${endResult === 'white' ? 'White' : 'Black'} wins`;
    const userColorName = settings.userColor === 'w' ? 'white' : 'black';
    const userWon = endResult === userColorName;
    const tone = endResult === 'draw' ? 'muted' : userWon ? 'good' : 'bad';
    return (
      <Banner tone={tone as 'good' | 'bad' | 'muted'}>
        <span className="text-lg font-bold">{winner}</span>
        <span className="opacity-80"> · by {endReason}</span>
      </Banner>
    );
  }

  if (status === 'playing') {
    const yourTurn = toMove === settings.userColor;
    return (
      <Banner tone={yourTurn ? 'good' : 'muted'}>
        <span className="h-2 w-2 rounded-full" style={{ background: yourTurn ? '#5fd97a' : '#8a90a3' }} />
        {yourTurn ? 'Your move' : 'Stockfish thinking…'}
      </Banner>
    );
  }

  return null;
}

function Banner({ tone, children }: { tone: 'good' | 'bad' | 'muted' | 'accent' | 'brill'; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    good:   'border-good/40 bg-good/10 text-good',
    bad:    'border-bad/40 bg-bad/10 text-bad',
    muted:  'border-border bg-panel2 text-muted',
    accent: 'border-accent/40 bg-accent/10 text-accent',
    brill:  'border-brill/40 bg-brill/10 text-brill',
  };
  return (
    <div className={'fade-in flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ' + cls[tone]}>
      {children}
    </div>
  );
}
