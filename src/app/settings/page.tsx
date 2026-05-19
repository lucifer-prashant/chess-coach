'use client';

import { useState, useEffect } from 'react';
import { useGame } from '@/lib/store';
import TopNav from '@/components/TopNav';
import { useToast } from '@/components/Toast';

const TIME_PRESETS: Array<{ label: string; initialMs: number; incrementMs: number }> = [
  { label: '∞ Unlimited', initialMs: 0, incrementMs: 0 },
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

const ELO_TIERS = [
  { min: 1320, max: 1500, name: 'Beginner', color: 'text-good' },
  { min: 1500, max: 1800, name: 'Intermediate', color: 'text-good' },
  { min: 1800, max: 2100, name: 'Club', color: 'text-brill' },
  { min: 2100, max: 2400, name: 'Expert', color: 'text-warn' },
  { min: 2400, max: 2700, name: 'Master', color: 'text-warn' },
  { min: 2700, max: 3001, name: 'Super-GM', color: 'text-bad' },
];

const DEFAULT_SETTINGS = {
  userColor: 'w' as const,
  elo: 1600,
  depth: 17,
  hintMode: false,
  timeControl: { initialMs: 10 * 60 * 1000, incrementMs: 5 * 1000 },
  nimModel: 'openai/gpt-oss-120b',
  llmEnabled: false,
  llmStrategy: 'auto' as const,
  audioEnabled: true,
  boardFlipped: false,
  boardTheme: 'brown' as const,
  showCoords: true,
  showBestArrowInReview: true,
  kidMode: false,
  animationsEnabled: true,
};

const BOARD_THEMES: Array<{ key: 'brown' | 'green' | 'blue' | 'slate'; name: string; light: string; dark: string }> = [
  { key: 'brown', name: 'Wood',  light: '#f0d9b5', dark: '#b58863' },
  { key: 'green', name: 'Tournament', light: '#eeeed2', dark: '#769656' },
  { key: 'blue',  name: 'Cool',  light: '#dee3e6', dark: '#8ca2ad' },
  { key: 'slate', name: 'Slate', light: '#d6d6d6', dark: '#5b6770' },
];

export default function SettingsPage() {
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const toast = useToast();
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState<'idle' | 'pending' | 'ok' | 'fail'>('idle');

  useEffect(() => { setKeyDraft(settings.nimKey ?? ''); }, [settings.nimKey]);

  const eloTier = ELO_TIERS.find((t) => settings.elo >= t.min && settings.elo < t.max) ?? ELO_TIERS[0];

  const testKey = async () => {
    if (!keyDraft.trim()) { toast.push('Enter a key first', 'warn'); return; }
    setTesting('pending');
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apiKey: keyDraft.trim(),
          model: settings.nimModel,
          temperature: 0,
          max_tokens: 4,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      if (res.ok) { setTesting('ok'); toast.push('NIM key works', 'success'); }
      else { setTesting('fail'); toast.push(`Key test failed (${res.status})`, 'error'); }
    } catch (err: any) {
      setTesting('fail');
      toast.push('Network error: ' + (err.message ?? err), 'error');
    }
    setTimeout(() => setTesting('idle'), 3000);
  };

  const resetDefaults = () => {
    if (!confirm('Reset all settings to defaults? Your NIM key stays.')) return;
    setSettings({ ...DEFAULT_SETTINGS, nimKey: settings.nimKey });
    toast.push('Settings reset', 'success');
  };

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="mt-1 text-sm text-muted">Stored locally in your browser.</p>
          </div>
          <button onClick={resetDefaults} className="btn btn-sm btn-ghost">Reset defaults</button>
        </header>

        <Section title="Engine" icon="⚙">
          <Field label="Opponent strength" value={`ELO ${settings.elo}`}>
            <input
              type="range" min={1320} max={3000} step={20}
              value={settings.elo}
              onChange={(e) => setSettings({ elo: parseInt(e.target.value, 10) })}
              className="w-full"
            />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-muted">1320</span>
              <span className={'font-semibold ' + eloTier.color}>{eloTier.name}</span>
              <span className="text-muted">3000</span>
            </div>
          </Field>

          <Field label="Analysis depth" value={`d${settings.depth}`}>
            <input
              type="range" min={12} max={20}
              value={settings.depth}
              onChange={(e) => setSettings({ depth: parseInt(e.target.value, 10) })}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-muted">
              <span>fast</span><span>balanced</span><span>strong</span>
            </div>
          </Field>

          <Field label="Your color">
            <div className="flex gap-2">
              {(['w', 'b'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setSettings({ userColor: c })}
                  className={'btn flex-1 ' + (settings.userColor === c ? 'btn-primary' : '')}
                >
                  {c === 'w' ? '♔ White' : '♚ Black'}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Time control" icon="⏱">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {TIME_PRESETS.map((t) => {
              const active = settings.timeControl.initialMs === t.initialMs &&
                settings.timeControl.incrementMs === t.incrementMs;
              return (
                <button
                  key={t.label}
                  onClick={() => setSettings({ timeControl: { initialMs: t.initialMs, incrementMs: t.incrementMs } })}
                  className={'btn btn-sm ' + (active ? 'btn-primary' : '')}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          title="AI coach (NVIDIA NIM)"
          icon="🧠"
          right={
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox" className="h-4 w-4 accent-accent"
                checked={settings.llmEnabled}
                onChange={(e) => setSettings({ llmEnabled: e.target.checked })}
              />
              Enabled
            </label>
          }
        >
          <p className="mb-4 text-xs text-muted">
            Get a free API key at{' '}
            <a className="text-accent underline hover:opacity-80" href="https://build.nvidia.com" target="_blank" rel="noreferrer">build.nvidia.com</a>.
            Stored only in your browser. Never sent to our servers.
          </p>

          <Field label="When to explain">
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'always', 'manual'] as const).map((s) => {
                const desc = s === 'auto' ? 'Blunders + key moments'
                  : s === 'always' ? 'Every move'
                  : 'On demand only';
                return (
                  <button
                    key={s}
                    onClick={() => setSettings({ llmStrategy: s })}
                    className={
                      'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ' +
                      (settings.llmStrategy === s
                        ? 'border-accent bg-accent/10 text-text'
                        : 'border-border bg-panel2 text-text hover:border-accent/40')
                    }
                  >
                    <span className="text-sm font-semibold capitalize">{s}</span>
                    <span className="text-[10px] text-muted">{desc}</span>
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
            <div className="flex flex-wrap gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                className="min-w-[200px] flex-1 rounded-md border border-border bg-panel2 px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
                placeholder="nvapi-..."
              />
              <button onClick={() => setShowKey((v) => !v)} className="btn btn-sm">
                {showKey ? '🙈' : '👁'}
              </button>
              <button
                onClick={() => { setSettings({ nimKey: keyDraft.trim() || undefined }); toast.push('Key saved', 'success'); }}
                className="btn btn-sm btn-primary"
              >
                Save
              </button>
              <button onClick={testKey} disabled={testing === 'pending'} className="btn btn-sm">
                {testing === 'pending' ? 'Testing…' : testing === 'ok' ? '✓ OK' : testing === 'fail' ? '✗ Fail' : 'Test'}
              </button>
            </div>
          </Field>
        </Section>

        <Section title="Board" icon="♟">
          <Field label="Theme">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BOARD_THEMES.map((t) => {
                const active = settings.boardTheme === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSettings({ boardTheme: t.key })}
                    className={
                      'flex flex-col items-center gap-1 rounded-lg border p-2 transition ' +
                      (active ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/40')
                    }
                  >
                    <div className="grid h-10 w-10 grid-cols-2 grid-rows-2 overflow-hidden rounded">
                      <div style={{ background: t.light }} />
                      <div style={{ background: t.dark }} />
                      <div style={{ background: t.dark }} />
                      <div style={{ background: t.light }} />
                    </div>
                    <span className="text-xs">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <Toggle label="Show coordinates" sub="a–h, 1–8 on board edges"
            checked={settings.showCoords}
            onChange={(v) => setSettings({ showCoords: v })}
          />
          <Toggle label="Flip board" sub="View from black's side"
            checked={settings.boardFlipped}
            onChange={(v) => setSettings({ boardFlipped: v })}
          />
          <Toggle label="Best-move arrow in review" sub="Show Stockfish's pick while stepping through"
            checked={settings.showBestArrowInReview}
            onChange={(v) => setSettings({ showBestArrowInReview: v })}
          />
          <Toggle label="Piece animations" sub="Smooth slide; off = instant"
            checked={settings.animationsEnabled}
            onChange={(v) => setSettings({ animationsEnabled: v })}
          />
        </Section>

        <Section title="Play preferences" icon="🎛">
          <Toggle label="Audio cues" sub="Move, capture, check, blunder"
            checked={settings.audioEnabled}
            onChange={(v) => setSettings({ audioEnabled: v })}
          />
          <Toggle label="Hint mode default-on" sub="Top-3 arrows before each of your moves"
            checked={settings.hintMode}
            onChange={(v) => setSettings({ hintMode: v })}
          />
          <Toggle label="Kid mode" sub="Single-ply undo (forgiving) — great for learners"
            checked={settings.kidMode}
            onChange={(v) => setSettings({ kidMode: v })}
          />
        </Section>
      </main>
    </>
  );
}

function Section({ title, icon, right, children }: { title: string; icon?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card mb-4 p-4 sm:mb-5 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {icon && <span className="text-base">{icon}</span>}
          {title}
        </h2>
        {right}
      </header>
      {children}
    </section>
  );
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-panel2">
      <input
        type="checkbox" className="h-4 w-4 accent-accent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="font-medium">{label}</span>
      {sub && <span className="ml-auto text-xs text-muted">{sub}</span>}
    </label>
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
