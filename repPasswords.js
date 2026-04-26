// app/page.js
// Single-input login. If the rep has a valid session cookie, jumps straight to
// the dashboard. Otherwise renders the login form.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRepBySlug } from '../lib/repRoster.js';
import LoginForm from '../components/LoginForm.jsx';

export const dynamic = 'force-dynamic';

export default function Home() {
  const slug = cookies().get('rep_session')?.value;
  if (slug && getRepBySlug(slug)) {
    redirect('/dashboard');
  }
  return <LoginForm />;
}
