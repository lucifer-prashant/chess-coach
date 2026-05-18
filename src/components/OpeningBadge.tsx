'use client';

import { useMemo } from 'react';
import { useGame } from '@/lib/store';
import { detectOpening } from '@/lib/openings';

export default function OpeningBadge() {
  const history = useGame((s) => s.history);
  const opening = useMemo(
    () => detectOpening(history.slice(0, 20).map((m) => m.san)),
    [history],
  );
  if (!opening) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-panel2/60 px-2.5 py-1 text-xs">
      <span className="font-mono text-muted">{opening.eco}</span>
      <span className="text-text">{opening.name}</span>
    </div>
  );
}
