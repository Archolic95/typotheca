import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TYPOTHECA — Gallery of Types',
  description: 'A definitive repository of intentionally designed objects.',
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      {/* Minimal header for preview */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-neutral-900">
        <div className="max-w-[2200px] mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/preview" className="text-sm font-medium tracking-[0.3em] text-neutral-200 hover:text-white">
            TYPOTHECA
          </a>
          <nav className="flex items-center gap-6 text-xs text-neutral-500">
            <a href="/preview" className="hover:text-white transition-colors">Gallery</a>
            <a href="/preview/collection" className="hover:text-white transition-colors">Collection</a>
          </nav>
        </div>
      </header>
      {/* Global image protection styles */}
      <style>{`
        .preview-protect img,
        .preview-protect video {
          -webkit-user-drag: none;
          user-select: none;
          pointer-events: none;
        }
        .preview-protect {
          -webkit-touch-callout: none;
        }
      `}</style>
      <main className="preview-protect">
        {children}
      </main>
    </div>
  );
}
