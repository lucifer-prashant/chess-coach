import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Chess Coach — play, get coached',
  description: 'Local Stockfish-powered chess coach. Play and learn.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/cg/chessground.base.css" />
        <link rel="stylesheet" href="/cg/chessground.brown.css" />
        <link rel="stylesheet" href="/cg/chessground.cburnett.css" />
        {/* Warm SF WASM cache early so first move/hint isn't a cold compile */}
        <link rel="preload" href="/sf/stockfish-18.js" as="script" crossOrigin="anonymous" />
        <link rel="preload" href="/sf/stockfish-18.wasm" as="fetch" type="application/wasm" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-bg text-text antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
