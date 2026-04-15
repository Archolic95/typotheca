'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/gallery', label: 'Gallery', icon: GridIcon },
  { href: '/database', label: 'Database', icon: TableIcon },
  { href: '/monitor', label: 'Monitors', icon: ActivityIcon },
  { href: '/watchlist', label: 'Watchlist', icon: TargetIcon },
  { href: '/feed', label: 'Feed', icon: ClockIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  // No sidebar on landing page. In production, also hide on preview pages.
  if (pathname === '/') return null;
  if (process.env.NODE_ENV !== 'development' && pathname.startsWith('/preview')) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-neutral-800 bg-[#0a0a0a] h-screen sticky top-0 shrink-0">
        <div className="px-5 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight text-white">TYPOTHECA</span>
          </Link>
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mt-1">Gallery of Types</p>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a] border-t border-neutral-800 flex" aria-label="Mobile navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 text-[10px]',
                active ? 'text-white' : 'text-neutral-500',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
      <rect x="9.5" y="1" width="5.5" height="5.5" rx="1" />
      <rect x="1" y="9.5" width="5.5" height="5.5" rx="1" />
      <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}

function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="2" width="14" height="12" rx="1.5" />
      <line x1="1" y1="6" x2="15" y2="6" />
      <line x1="1" y1="10" x2="15" y2="10" />
      <line x1="6" y1="6" x2="6" y2="14" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,8 4,4 7,10 10,2 13,8 15,6" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="7" />
      <circle cx="8" cy="8" r="4" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="7" />
      <polyline points="8,4 8,8 11,10" />
    </svg>
  );
}
