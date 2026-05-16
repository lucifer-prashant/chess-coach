'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useGame } from '@/lib/store';

const TIME_PRESETS: Array<{ label: string; initialMs: number; incrementMs: number }> = [
  { label: 'Unlimited', initialMs: 0, incrementMs: 0 },
  { label: '1+0', initialMs: 60_000, incrementMs: 0 },
  { label: '1+1', initialMs: 60_000, incrementMs: 1000 },
  { label: '3+0', initialMs: 180_000, incrementMs: 0 },
  { label: '3+2', initialMs: 180_000, incrementMs: 2000 },
  { label: '5+0', initialMs: 300_000, incrementMs: 0 },
  { label: '5+3', initialMs: 300_000, incrementMs: 3000 },
  { label: '10+0', initialMs: 600_000, incrementMs: 0 },
  { label: '10+5', initialMs: 600_000, incrementMs: 5000 },
  { label: '15+10', initialMs: 900_000, incrementMs: 10_000 },
  { label: '30+0', initialMs: 1_800_000, incrementMs: 0 },
];

const NIM_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.1-405b-instruct',
  'mistralai/mixtral-8x22b-instruct-v0.1',
  'nvidia/nemotron-4-340b-instruct',
];

export default function SettingsPage() {
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const [keyDraft, setKeyDraft] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setKeyDraft(settings.nimKey ?? '');
  }, [settings.nimKey]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-muted hover:text-text">← home</Link>
          <h1 className="mt-1 text-3xl font-bold">Settings</h1>
        </div>
        <Link href="/play" className="btn btn-primary">Play →</Link>
      </div>

      <Section title="Engine">
        <Field label="Opponent strength" value={`ELO ${settings.elo}`}>
          <input
            type="range"
            min={1320}
            max={3000}
            step={20}
            value={settings.elo}
            onChange={(e) => setSettings({ elo: parseInt(e.target.value, 10) })}
            className="w-full accent-accent"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-muted">
            <span>beginner</span><span>club</span><span>master</span>
          </div>
        </Field>
        <Field label="Analysis depth" value={`${settings.depth}`}>
          <input
            type="range"
            min={12}
            max={20}
            value={settings.depth}
            onChange={(e) => setSettings({ depth: parseInt(e.target.value, 10) })}
            className="w-full accent-accent"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-muted">
            <span>fast (12)</span><span>17</span><span>strong (20)</span>
          </div>
        </Field>
        <Field label="Your color">
          <div className="flex gap-2">
            {(['w', 'b'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setSettings({ userColor: c })}
                className={
                  'btn flex-1 ' +
                  (settings.userColor === c ? 'btn-primary' : '')
                }
              >
                {c === 'w' ? '♔ White' : '♚ Black'}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Time control">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {TIME_PRESETS.map((t) => {
            const active = settings.timeControl.initialMs === t.initialMs &&
              settings.timeControl.incrementMs === t.incrementMs;
            return (
              <button
                key={t.label}
                onClick={() => setSettings({ timeControl: { initialMs: t.initialMs, incrementMs: t.incrementMs } })}
                className={'btn ' + (active ? 'btn-primary' : '')}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="AI coach (NVIDIA NIM)"
        right={
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-accent"
              checked={settings.llmEnabled}
              onChange={(e) => setSettings({ llmEnabled: e.target.checked })}
            />
            Enabled
          </label>
        }
      >
        <p className="mb-3 text-xs text-muted">
          Free key at <a className="text-accent underline" href="https://build.nvidia.com" target="_blank" rel="noreferrer">build.nvidia.com</a>.
          Stored only in your browser. Never sent to our servers.
        </p>
        <Field label="When to explain">
          <div className="grid grid-cols-3 gap-2">
            {(['auto', 'always', 'manual'] as const).map((s) => {
              const desc = s === 'auto' ? 'Only blunders & key moments'
                : s === 'always' ? 'Every move'
                : 'On demand only';
              return (
                <button
                  key={s}
                  onClick={() => setSettings({ llmStrategy: s })}
                  className={'btn flex-col items-start py-2 ' + (settings.llmStrategy === s ? 'btn-primary' : '')}
                >
                  <span className="text-sm font-semibold capitalize">{s}</span>
                  <span className="text-[10px] opacity-80">{desc}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Model">
          <select
            value={settings.nimModel}
            onChange={(e) => setSettings({ nimModel: e.target.value })}
            className="w-full rounded-md border border-border bg-panel2 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            {NIM_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="API key">
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyDraft}
              onChange={(e) => { setKeyDraft(e.target.value); setKeySaved(false); }}
              className="flex-1 rounded-md border border-border bg-panel2 px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
              placeholder="nvapi-..."
            />
            <button onClick={() => setShowKey((v) => !v)} className="btn text-xs">
              {showKey ? 'hide' : 'show'}
            </button>
            <button
              onClick={() => { setSettings({ nimKey: keyDraft.trim() || undefined }); setKeySaved(true); }}
              className="btn btn-primary"
            >
              Save
            </button>
          </div>
          {keySaved && <div className="mt-1 text-xs text-good">Saved.</div>}
        </Field>
      </Section>

      <Section title="Other">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="accent-accent"
            checked={settings.audioEnabled}
            onChange={(e) => setSettings({ audioEnabled: e.target.checked })}
          />
          Audio cues
        </label>
      </Section>
    </main>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card mb-5 p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        {value && <div className="font-mono text-xs text-text">{value}</div>}
      </div>
      {children}
    </div>
  );
}

