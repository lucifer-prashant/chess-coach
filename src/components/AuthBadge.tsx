'use client';

import { useEffect, useState } from 'react';
import { signInGoogle, signOutCurrent, watchAuth, consumeRedirect } from '@/lib/firebase';
import type { User } from 'firebase/auth';

export default function AuthBadge() {
  const [user, setUser] = useState<User | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      setConfigured(false);
      return;
    }
    consumeRedirect().catch(() => {});
    const off = watchAuth(setUser);
    return () => off();
  }, []);

  if (!configured) return null;

  if (!user) {
    return (
      <button onClick={() => signInGoogle().catch(console.error)} className="btn">
        Sign in
      </button>
    );
  }
  const name = user.displayName ?? user.email ?? 'signed in';
  const initial = (name[0] ?? '?').toUpperCase();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 font-semibold text-accent">
        {initial}
      </span>
      <span className="hidden text-muted sm:inline">{name}</span>
      <button onClick={() => signOutCurrent()} className="btn !px-2 !py-1 text-xs">
        sign out
      </button>
    </div>
  );
}
