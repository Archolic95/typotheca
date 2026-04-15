import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'typotheca_2026';

export async function POST(request: NextRequest) {
  const { key } = await request.json();

  if (key !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('typotheca_admin', ADMIN_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  });
  return res;
}
