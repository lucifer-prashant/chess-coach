'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signInGoogle, signOutCurrent, watchAuth, consumeRedirect } from '@/lib/firebase';
import type { User } from 'firebase/auth';

export default function AuthBadge() {
  const [user, setUser] = useState<User | null>(null);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      setConfigured(false);
      return;
    }
    consumeRedirect()
      .then((redirectUser) => {
        if (redirectUser) setUser(redirectUser);
      })
      .catch((err) => {
        console.error(err);
        setError(formatAuthError(err));
      });
    const off = watchAuth(setUser);
    return () => off();
  }, []);

  if (!configured) return null;

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInGoogle();
    } catch (err) {
      console.error(err);
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        {error && <span className="hidden max-w-[260px] truncate text-xs text-bad sm:inline" title={error}>{error}</span>}
        <button onClick={signIn} disabled={busy} className="btn">
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    );
  }
  const name = user.displayName ?? user.email ?? 'signed in';
  const initial = (name[0] ?? '?').toUpperCase();
  return (
    <div className="flex items-center gap-2 text-sm">
      <Link href="/history" className="flex items-center gap-2 rounded-full bg-accent/20 px-2 py-1 pr-3 transition hover:bg-accent/30">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent font-semibold text-white">
          {initial}
        </span>
        <span className="hidden text-text sm:inline">{name}</span>
      </Link>
      <button onClick={() => signOutCurrent()} className="btn text-xs">
        sign out
      </button>
    </div>
  );
}

function formatAuthError(err: unknown): string {
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message;
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in popup closed before Firebase finished.';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorized in Firebase Auth.';
  if (code) return code;
  return message ?? 'Sign-in failed';
}
