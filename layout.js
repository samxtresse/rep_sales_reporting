// app/api/login/route.js
// POST { password } → matches against every rep's password.
// On success: sets `rep_session` cookie containing the rep slug, returns 200.
// On failure: returns 401.

import { NextResponse } from 'next/server';
import { findRepByPassword } from '../../../lib/repPasswords.js';

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const password = String(body.password || '');
  if (!password) {
    return NextResponse.json({ error: 'Missing password' }, { status: 400 });
  }

  const rep = findRepByPassword(password);
  if (!rep) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, slug: rep.slug, name: rep.name });
  res.cookies.set('rep_session', rep.slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return res;
}
