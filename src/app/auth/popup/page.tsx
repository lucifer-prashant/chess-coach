'use client';

import { useEffect, useState } from 'react';
import { signInGooglePopup } from '@/lib/firebase';

export default function AuthPopupPage() {
  const [status, setStatus] = useState('Signing in...');

  useEffect(() => {
    let alive = true;

    signInGooglePopup()
      .then(() => {
        if (!alive) return;
        setStatus('Signed in. You can close this window.');
        window.close();
      })
      .catch((err) => {
        if (!alive) return;
        setStatus(formatAuthError(err));
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-text">
      <div className="max-w-sm text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Firebase Auth</div>
        <div className="mt-3 text-lg font-semibold">{status}</div>
      </div>
    </main>
  );
}

function formatAuthError(err: unknown): string {
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message;
  if (code === 'auth/popup-closed-by-user') return 'Sign-in popup was closed.';
  if (code === 'auth/popup-blocked') return 'Browser blocked the sign-in popup.';
  return message ?? code ?? 'Sign-in failed';
}
