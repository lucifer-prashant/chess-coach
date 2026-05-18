'use client';

import { useEffect, useState } from 'react';

const BINDINGS: Array<{ keys: string[]; label: string }> = [
  { keys: ['?'], label: 'Show this overlay' },
  { keys: ['N'], label: 'New game' },
  { keys: ['R'], label: 'Resign' },
  { keys: ['U'], label: 'Undo' },
  { keys: ['H'], label: 'Toggle hint mode' },
  { keys: ['E'], label: 'Toggle explore mode' },
  { keys: ['←', '→'], label: 'Step through moves' },
  { keys: ['Home'], label: 'Jump to first move' },
  { keys: ['End', 'Esc'], label: 'Return to live position' },
  { keys: ['F'], label: 'Flip board (UI only — not implemented)' },
];

export default function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="card pop max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">esc</button>
        </header>
        <ul className="space-y-2">
          {BINDINGS.map((b) => (
            <li key={b.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">{b.label}</span>
              <span className="flex gap-1">
                {b.keys.map((k) => <kbd key={k}>{k}</kbd>)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted">
          Press <kbd>?</kbd> anywhere to toggle.
        </div>
      </div>
    </div>
  );
}
