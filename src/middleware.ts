import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE = 'typotheca_admin';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'typotheca_2026';

/** Routes that require admin authentication */
const ADMIN_ROUTES = ['/gallery', '/database', '/monitor', '/watchlist', '/feed'];

/** Check if a request has valid admin auth */
function isAdmin(req: NextRequest): boolean {
  // Local dev is always admin
  if (process.env.NODE_ENV === 'development') return true;
  return req.cookies.get(ADMIN_COOKIE)?.value === ADMIN_SECRET;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login route — always public
  if (pathname === '/login') return NextResponse.next();

  // Root → redirect to preview in production
  if (pathname === '/') {
    if (!isAdmin(req)) {
      return NextResponse.redirect(new URL('/preview', req.url));
    }
    return NextResponse.next();
  }

  // Preview/collection → redirect to main preview
  if (pathname === '/preview/collection') {
    return NextResponse.redirect(new URL('/preview', req.url));
  }

  // Preview routes — public, add security headers
  if (pathname.startsWith('/preview')) {
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    return res;
  }

  // API write routes — require admin
  if (pathname.startsWith('/api/objects/') && (req.method === 'PATCH' || req.method === 'DELETE')) {
    if (!isAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin routes — require auth, redirect to preview if not authenticated
  if (ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    if (!isAdmin(req)) {
      return NextResponse.redirect(new URL('/preview', req.url));
    }
    return NextResponse.next();
  }

  // Landing page and everything else — public
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/gallery/:path*', '/database/:path*', '/monitor/:path*',
    '/watchlist/:path*', '/feed/:path*', '/preview/:path*',
    '/api/objects/:path*', '/login',
  ],
};
