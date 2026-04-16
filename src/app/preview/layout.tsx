import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TYPOTHECA — Gallery of Types',
  description: 'A definitive repository of intentionally designed objects.',
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      {/* Minimal header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-neutral-900">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/preview" className="text-sm font-medium tracking-[0.3em] text-neutral-200 hover:text-white transition-colors">
            TYPOTHECA
          </a>
          <span className="text-[10px] tracking-[0.25em] text-neutral-600 uppercase">Gallery of Types</span>
        </div>
      </header>
      {/* Global image protection styles — keep videos interactive */}
      <style>{`
        .preview-protect img {
          -webkit-user-drag: none;
          user-select: none;
          pointer-events: none;
        }
        .preview-protect video {
          -webkit-user-drag: none;
          user-select: none;
          /* pointer-events intentionally left enabled so <video> controls work */
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
