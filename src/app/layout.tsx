import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chess Coach',
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
      <body suppressHydrationWarning className="min-h-screen bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
