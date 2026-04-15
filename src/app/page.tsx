import Link from 'next/link';

const isDev = process.env.NODE_ENV === 'development';

const NAV_LINKS = isDev ? [
  { href: '/gallery', label: 'Gallery', description: 'Browse the archive' },
  { href: '/database', label: 'Database', description: 'Raw data, all fields' },
  { href: '/feed', label: 'Feed', description: 'Chronological drops' },
] : [
  { href: '/preview', label: 'Gallery', description: 'Browse the archive' },
  { href: '/preview/collection', label: 'Collection', description: 'Curated highlights' },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] px-8 md:px-16">
      {/* Main content — vertically centered */}
      <div className="flex-1 flex flex-col justify-center max-w-xl">
        {/* Wordmark */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white leading-none">
            TYPOTHECA
          </h1>
          <p className="mt-3 text-xs uppercase tracking-[0.25em] text-neutral-500">
            Gallery of Types
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-neutral-400 leading-relaxed max-w-sm mb-12">
          A definitive repository of intentionally designed objects — sourced, catalogued, and
          archived for those who care about the craft.
        </p>

        {/* Nav links */}
        <nav className="flex flex-col gap-0 border-t border-neutral-800">
          {NAV_LINKS.map(({ href, label, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between py-4 border-b border-neutral-800 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-baseline gap-4">
                <span className="text-sm font-medium text-white group-hover:text-neutral-200 transition-colors">
                  {label}
                </span>
                <span className="text-xs text-neutral-600 group-hover:text-neutral-500 transition-colors">
                  {description}
                </span>
              </div>
              <svg
                className="w-4 h-4 text-neutral-700 group-hover:text-neutral-400 group-hover:translate-x-0.5 transition-all"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <footer className="py-8 text-[10px] uppercase tracking-[0.2em] text-neutral-700">
        Typotheca &mdash; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
