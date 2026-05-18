'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
