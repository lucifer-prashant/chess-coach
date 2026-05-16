/**
 * Synthesized audio cues. No external assets. Uses WebAudio.
 * Must call `primeAudio()` from a user gesture before first cue.
 */

let ctx: AudioContext | null = null;
let primed = false;

export function primeAudio(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  primed = true;
}

export type Cue = 'move' | 'capture' | 'check' | 'mate' | 'illegal' | 'blunder' | 'start';

interface CueDef {
  freqs: number[];        // sequence of frequencies (Hz)
  durs: number[];         // per-step durations (s)
  type?: OscillatorType;
  gain?: number;
}

const CUES: Record<Cue, CueDef> = {
  move:    { freqs: [520], durs: [0.06], type: 'triangle', gain: 0.15 },
  capture: { freqs: [220, 140], durs: [0.05, 0.08], type: 'sawtooth', gain: 0.2 },
  check:   { freqs: [880, 1100], durs: [0.07, 0.07], type: 'square', gain: 0.18 },
  mate:    { freqs: [659, 523, 392, 261], durs: [0.12, 0.12, 0.12, 0.3], type: 'triangle', gain: 0.22 },
  illegal: { freqs: [180, 120], durs: [0.05, 0.1], type: 'sawtooth', gain: 0.2 },
  blunder: { freqs: [196, 147, 110], durs: [0.1, 0.1, 0.25], type: 'sawtooth', gain: 0.24 },
  start:   { freqs: [392, 523, 784], durs: [0.08, 0.08, 0.16], type: 'triangle', gain: 0.18 },
};

export function play(cue: Cue, volume = 1): void {
  if (!primed || !ctx) return;
  const def = CUES[cue];
  const now = ctx.currentTime;
  let offset = 0;
  for (let i = 0; i < def.freqs.length; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = def.type ?? 'sine';
    osc.frequency.value = def.freqs[i];
    const peak = (def.gain ?? 0.15) * volume;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(peak, now + offset + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + def.durs[i]);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + def.durs[i] + 0.02);
    offset += def.durs[i];
  }
}
