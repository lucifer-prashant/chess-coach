import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import StoreHydrator from '@/components/StoreHydrator';

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
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-bg text-text antialiased">
        <ToastProvider>
          <StoreHydrator />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
