'use client';

import { useMemo } from 'react';
import { Chess } from 'chess.js';
import type { AnalysisLine } from '@/lib/engine';

interface Props {
  lines: AnalysisLine[] | null;
  fen: string;
}

export default function EngineLines({ lines, fen }: Props) {
  const parsed = useMemo(() => {
    if (!lines?.length) return [];
    return lines.map((line) => {
      const chess = new Chess(fen);
      const sans: string[] = [];
      for (const uci of line.pv.slice(0, 8)) {
        try {
          const mv = chess.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
          } as any);
          if (mv) sans.push(mv.san);
          else break;
        } catch { break; }
      }
      const cp = line.score.type === 'mate'
        ? (line.score.value > 0 ? 'M' : '-M') + Math.abs(line.score.value)
        : (line.score.value >= 0 ? '+' : '') + (line.score.value / 100).toFixed(2);
      return { cp, depth: line.depth, sans };
    });
  }, [lines, fen]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Engine lines</span>
        {parsed[0] && <span className="font-mono text-[10px] text-muted">d{parsed[0].depth}</span>}
      </div>
      {!lines && (
        <div className="px-3 py-3 text-xs text-muted">Analyzing…</div>
      )}
      {lines && lines.length === 0 && (
        <div className="px-3 py-3 text-xs text-muted">No legal moves.</div>
      )}
      <div className="divide-y divide-border/50">
        {parsed.map((line, i) => (
          <div key={i} className="flex items-baseline gap-3 px-3 py-2">
            <span className={
              'w-14 shrink-0 font-mono text-xs font-bold ' +
              (i === 0 ? 'text-good' : i === 1 ? 'text-text/60' : 'text-text/40')
            }>
              {line.cp}
            </span>
            <span className="truncate font-mono text-xs text-text/70">
              {line.sans.join(' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
