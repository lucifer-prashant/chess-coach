'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut,
  onAuthStateChanged, type Auth, type User,
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, query, where, getDocs,
  serverTimestamp, type Firestore,
} from 'firebase/firestore';
import type { MoveRecord, GameSettings } from './store';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function isConfigured(): boolean {
  return !!(config.apiKey && config.projectId);
}

export function fbApp(): FirebaseApp | null {
  if (!isConfigured()) return null;
  if (!app) app = getApps().length ? getApps()[0] : initializeApp(config as any);
  return app;
}

export function fbAuth(): Auth | null {
  if (!fbApp()) return null;
  if (!auth) auth = getAuth(fbApp()!);
  return auth;
}

export function fbDb(): Firestore | null {
  if (!fbApp()) return null;
  if (!db) db = getFirestore(fbApp()!);
  return db;
}

export async function signInGoogle(): Promise<void> {
  const a = fbAuth();
  if (!a) throw new Error('Firebase not configured. Add NEXT_PUBLIC_FIREBASE_* env vars.');
  await signInWithRedirect(a, new GoogleAuthProvider());
}

/** Call on app load to capture the redirect result (no-op if no pending redirect). */
export async function consumeRedirect(): Promise<User | null> {
  const a = fbAuth();
  if (!a) return null;
  try {
    const result = await getRedirectResult(a);
    return result?.user ?? null;
  } catch {
    return null;
  }
}

export async function signOutCurrent(): Promise<void> {
  const a = fbAuth();
  if (!a) return;
  await signOut(a);
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  const a = fbAuth();
  if (!a) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(a, cb);
}

export interface SavedGame {
  uid: string;
  result: 'white' | 'black' | 'draw';
  endReason: string;
  movesCount: number;
  pgn: string;
  history: MoveRecord[];
  settings: GameSettings;
  createdAt: ReturnType<typeof serverTimestamp>;
}

export async function saveGame(uid: string, game: Omit<SavedGame, 'uid' | 'createdAt'>): Promise<void> {
  const d = fbDb();
  if (!d) return;
  await addDoc(collection(d, 'games'), {
    uid,
    ...game,
    createdAt: serverTimestamp(),
  });
}

export async function listGames(uid: string): Promise<Array<SavedGame & { id: string }>> {
  const d = fbDb();
  if (!d) return [];
  const q = query(collection(d, 'games'), where('uid', '==', uid));
  const snap = await getDocs(q);
  const rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as SavedGame) }));
  rows.sort((a, b) => {
    const ta = (a.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
    const tb = (b.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
    return tb - ta;
  });
  return rows;
}
