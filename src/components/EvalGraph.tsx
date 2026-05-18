'use client';

import { useMemo } from 'react';
import { useGame } from '@/lib/store';
import { scoreToCp } from '@/lib/classify';

const W = 380;
const H = 60;
const CLAMP = 1200;

export default function EvalGraph() {
  const history = useGame((s) => s.history);
  const viewIndex = useGame((s) => s.viewIndex);
  const setViewIndex = useGame((s) => s.setViewIndex);

  const points = useMemo(() => {
    if (history.length === 0) return [] as Array<{ x: number; y: number; cp: number }>;
    return history.map((m, i) => {
      let cp = 0;
      if (m.evalAfter) {
        const whiteSide = m.by === 'w';
        // evalAfter is side-to-move POV; after a white move, black is to move, so flip.
        const cpFromMover = scoreToCp(m.evalAfter, !whiteSide);
        cp = whiteSide ? -cpFromMover : cpFromMover; // standardize: positive = white
        // Above is double-flip; simplify:
        cp = (whiteSide ? -1 : 1) * cpFromMover;
      }
      cp = Math.max(-CLAMP, Math.min(CLAMP, cp));
      const x = (i / Math.max(1, history.length - 1)) * W;
      const y = H / 2 - (cp / CLAMP) * (H / 2);
      return { x, y, cp };
    });
  }, [history]);

  if (history.length < 2) return null;

  const path = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaUp = `M0,${H / 2} ${points.map((p) => `L${p.x},${Math.min(p.y, H / 2)}`).join(' ')} L${W},${H / 2} Z`;
  const areaDn = `M0,${H / 2} ${points.map((p) => `L${p.x},${Math.max(p.y, H / 2)}`).join(' ')} L${W},${H / 2} Z`;

  const activeIdx = viewIndex ?? history.length - 1;
  const active = points[activeIdx];

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (history.length - 1));
    setViewIndex(idx === history.length - 1 ? null : Math.max(0, idx));
  };

  return (
    <div className="card p-3">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted">
        <span>Eval graph</span>
        <span className="font-mono text-text/70">
          {active ? (active.cp >= 0 ? '+' : '') + (active.cp / 100).toFixed(2) : '—'}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        onClick={handleClick}
        className="cursor-pointer"
        preserveAspectRatio="none"
      >
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#252a3a" strokeWidth={1} />
        <path d={areaUp} fill="rgba(238,240,245,0.18)" />
        <path d={areaDn} fill="rgba(14,16,24,0.6)" />
        <path d={path} fill="none" stroke="#7c5cff" strokeWidth={1.5} />
        {active && (
          <g>
            <line x1={active.x} x2={active.x} y1={0} y2={H} stroke="#7c5cff" strokeWidth={1} strokeDasharray="2,2" />
            <circle cx={active.x} cy={active.y} r={3} fill="#7c5cff" />
          </g>
        )}
      </svg>
    </div>
  );
}
