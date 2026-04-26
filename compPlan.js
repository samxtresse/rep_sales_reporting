// app/dashboard/page.js
// Reads the rep_session cookie, identifies the rep, fetches their bundle from
// Windsor.ai, renders the dashboard. No cookie or invalid → redirect to /.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRepBySlug } from '../../lib/repRoster.js';
import { getRepBundle } from '../../lib/repData.js';
import { getPlan } from '../../lib/compPlan.js';
import RepDashboard from '../../components/RepDashboard.jsx';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const slug = cookies().get('rep_session')?.value;
  if (!slug) redirect('/');

  const rep = getRepBySlug(slug);
  if (!rep) redirect('/');

  let bundle = { monthly: [], accounts: [], orders: [] };
  let error = null;
  try {
    bundle = await getRepBundle(rep.slug);
  } catch (e) {
    error = e?.message || 'Failed to load Windsor.ai data';
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  const plan = getPlan(rep.planKey);

  return (
    <RepDashboard
      rep={rep}
      monthly={bundle.monthly}
      accounts={bundle.accounts}
      orders={bundle.orders}
      plan={plan}
    />
  );
}

export const metadata = { title: 'My Tracker — Xtressé' };

function ErrorView({ error }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBF0E8', fontFamily: '-apple-system, sans-serif', padding: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #DDD0C4', borderRadius: 12, padding: '28px 32px', maxWidth: 480, width: '100%' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 600, color: '#5C2A1A', margin: '0 0 8px' }}>Couldn&rsquo;t load data</h1>
        <pre style={{ background: '#F5F1EA', padding: 12, borderRadius: 6, fontSize: 12, overflow: 'auto', margin: '8px 0' }}>{error}</pre>
        <p style={{ fontSize: 12, color: '#7A6F60', margin: 0 }}>
          Most common cause: <code>WINDSOR_API_KEY</code> missing or invalid in Vercel env vars.
        </p>
      </div>
    </div>
  );
}
