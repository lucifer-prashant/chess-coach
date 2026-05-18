'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthBadge from './AuthBadge';

const TABS = [
  { href: '/play', label: 'Play' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
];

export default function TopNav({ extra }: { extra?: React.ReactNode }) {
  const path = usePathname() ?? '/';
  return (
    <nav className="navbar">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 py-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2 text-base font-bold tracking-tight">
          <span className="text-accent text-2xl leading-none transition-transform group-hover:rotate-[-8deg] group-hover:scale-110">♞</span>
          <span className="text-text hidden sm:inline">chess.coach</span>
        </Link>

        <div className="ml-2 flex items-center gap-1">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              data-active={path.startsWith(t.href)}
              className="nav-tab"
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {extra}
          <AuthBadge />
        </div>
      </div>
    </nav>
  );
}
