import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Sidebar } from '@/components/layout/Sidebar';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'TYPOTHECA',
    template: '%s — TYPOTHECA',
  },
  description: 'A definitive repository of intentionally designed objects.',
  openGraph: {
    title: 'TYPOTHECA',
    description: 'A definitive repository of intentionally designed objects.',
    siteName: 'TYPOTHECA',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'TYPOTHECA',
    description: 'A definitive repository of intentionally designed objects.',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-[#0a0a0a] text-neutral-100 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
