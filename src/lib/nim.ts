/**
 * NVIDIA NIM client. Streams chat completions over SSE.
 * User supplies their own key + model. Browser-direct (no server).
 */

import type { Classification } from './classify';
import type { PatternFlag, Phase } from './detectors';
import type { Score } from './engine';

const PROXY_URL = '/api/coach';

export interface ExplainInput {
  classification: Classification;
  flags: PatternFlag[];
  phase: Phase;
  fenBefore: string;
  fenAfter: string;
  playedSan: string;
  bestMoveSan?: string;
  evalBefore?: Score | null;
  evalAfter?: Score | null;
  moverColorName: 'white' | 'black';
}

export interface ExplainOptions {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  onToken: (text: string) => void;
}

export async function explainMove(input: ExplainInput, opts: ExplainOptions): Promise<string> {
  const prompt = buildPrompt(input);

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKey: opts.apiKey,
      model: opts.model,
      temperature: 0.3,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'You are a concise chess coach. Explain a single move in 2 to 3 short sentences. ' +
            'Do not restate the eval numbers. Speak naturally. ' +
            'Mention the better move only if one was clearly superior. End with a one-line lesson when relevant.',
        },
        { role: 'user', content: prompt },
      ],
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '');
    throw new Error(`NIM error ${res.status}: ${txt.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const rawLine = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!rawLine.startsWith('data:')) continue;
      const data = rawLine.slice(5).trim();
      if (data === '[DONE]') return full;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          opts.onToken(delta);
        }
      } catch {
        // ignore malformed lines (heartbeats etc)
      }
    }
  }
  return full;
}

function buildPrompt(i: ExplainInput): string {
  const evalBeforeText = i.evalBefore ? scoreText(i.evalBefore) : 'unknown';
  const evalAfterText = i.evalAfter ? scoreText(i.evalAfter) : 'unknown';
  const flagsText = i.flags.length ? i.flags.join(', ') : 'none';

  return [
    `Player color: ${i.moverColorName}`,
    `Game phase: ${i.phase}`,
    `Played move: ${i.playedSan}`,
    `Stockfish's best move: ${i.bestMoveSan ?? 'n/a'}`,
    `Eval before (from mover): ${evalBeforeText}`,
    `Eval after (from mover): ${evalAfterText}`,
    `Centipawn loss: ${i.classification.cpLoss}`,
    `Move label: ${i.classification.label}`,
    `Pattern detectors triggered: ${flagsText}`,
    `Position before (FEN): ${i.fenBefore}`,
    `Position after (FEN): ${i.fenAfter}`,
    '',
    'Explain why this move earned its label. Be short. Be specific. No filler.',
  ].join('\n');
}

function scoreText(s: Score): string {
  if (s.type === 'mate') return `mate in ${s.value}`;
  return `${(s.value / 100).toFixed(2)} pawns`;
}
