'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { computeCommission } from '../lib/compPlan.js';

const RUST = '#5C2A1A';
const COPPER_DARK = '#A85F28';
const CREAM = '#FBF0E8';
const SOFT_BG = '#F5F1EA';
const BORDER = '#DDD0C4';
const INK = '#1A1A1A';
const MUTED = '#7A6F60';
const HINT = '#9C9081';

const fmt$ = n => '$' + Math.round(n || 0).toLocaleString();
const fmt$k = n => Math.abs(n) >= 1000 ? '$' + (n / 1000).toFixed(1) + 'K' : '$' + Math.round(n).toLocaleString();
const fmtN = n => Math.round(n || 0).toLocaleString();
const fmtPct = (n, dp = 1) => ((n || 0) * 100).toFixed(dp) + '%';
const fmtDate = s => {
  if (!s) return '—';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  if (!y || !m || !d) return s;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m - 1]} ${+d}, ${y.slice(2)}`;
};

const PRODUCTS = [
  { key: 'gum', label: 'Gummies' },
  { key: 'xv',  label: 'XVIE' },
  { key: 'se',  label: 'Serum' },
  { key: 'sa',  label: 'Sachets' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TIER_COLORS = {
  Silver:   { bg: '#F0F0F0', fg: '#666' },
  Gold:     { bg: '#FFF8E7', fg: '#B8860B' },
  Platinum: { bg: '#F0F4FF', fg: '#4B6CB7' },
  Diamond:  { bg: '#F0FAF5', fg: '#2E7D55' },
};

function quarterOf(month) { return Math.ceil(month / 3); }

function sumProd(rows, prod) {
  return rows.reduce((acc, r) => ({
    ft:    acc.ft    + (r[prod + '_ft']    || 0),
    ret:   acc.ret   + (r[prod + '_ret']   || 0),
    ft_n:  acc.ft_n  + (r[prod + '_ft_n']  || 0),
    ret_n: acc.ret_n + (r[prod + '_ret_n'] || 0),
  }), { ft: 0, ret: 0, ft_n: 0, ret_n: 0 });
}

export default function RepDashboard({ rep, monthly, accounts, orders, plan }) {
  const yearsPresent = useMemo(() => {
    const set = new Set(monthly.map(r => r.year));
    if (set.size === 0) set.add(new Date().getFullYear());
    return Array.from(set).sort();
  }, [monthly]);

  const [year, setYear] = useState(yearsPresent[yearsPresent.length - 1]);

  const yearRows = useMemo(
    () => monthly.filter(r => r.year === year).sort((a, b) => a.month - b.month),
    [monthly, year]
  );

  const initialActive = useMemo(() => {
    const a = {};
    for (let m = 1; m <= 12; m++) a[m] = false;
    yearRows.forEach(r => {
      const total = PRODUCTS.reduce((s, p) => s + (r[p.key + '_ft'] || 0) + (r[p.key + '_ret'] || 0), 0);
      if (total > 0) a[r.month] = true;
    });
    if (Object.values(a).every(v => !v)) for (let m = 1; m <= 12; m++) a[m] = true;
    return a;
  }, [yearRows]);

  const [active, setActive] = useState(initialActive);
  useEffect(() => { setActive(initialActive); }, [initialActive]);

  const [proj, setProj] = useState({ gum_ft: 0, gum_ret: 0, xv_ft: 0, xv_ret: 0, se_ft: 0, se_ret: 0, sa_ft: 0, sa_ret: 0 });

  const [acctSort, setAcctSort] = useState({ key: 'totalRevenue', dir: 'desc' });
  const [acctSearch, setAcctSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  const selectedMonths = useMemo(() => Object.keys(active).filter(m => active[m]).map(Number).sort((a, b) => a - b), [active]);
  const selectedRows = useMemo(() => yearRows.filter(r => active[r.month]), [yearRows, active]);

  const visibleRows = useMemo(() => selectedMonths.map(m => {
    const found = yearRows.find(r => r.month === m);
    return found || {
      repSlug: rep.slug, year, month: m,
      gum_ft: 0, gum_ret: 0, gum_ft_n: 0, gum_ret_n: 0,
      xv_ft: 0,  xv_ret: 0,  xv_ft_n: 0,  xv_ret_n: 0,
      se_ft: 0,  se_ret: 0,  se_ft_n: 0,  se_ret_n: 0,
      sa_ft: 0,  sa_ret: 0,  sa_ft_n: 0,  sa_ret_n: 0,
    };
  }), [selectedMonths, yearRows, rep.slug, year]);

  const sums = useMemo(() => {
    const out = {};
    PRODUCTS.forEach(p => out[p.key] = sumProd(selectedRows, p.key));
    return out;
  }, [selectedRows]);

  const tot = PRODUCTS.reduce((acc, p) => ({
    ft:    acc.ft    + sums[p.key].ft,
    ret:   acc.ret   + sums[p.key].ret,
    ft_n:  acc.ft_n  + sums[p.key].ft_n,
    ret_n: acc.ret_n + sums[p.key].ret_n,
  }), { ft: 0, ret: 0, ft_n: 0, ret_n: 0 });

  const totalNet = tot.ft + tot.ret;
  const totalAccts = tot.ft_n + tot.ret_n;
  const aov = totalAccts ? totalNet / totalAccts : 0;
  const ftPct = totalNet ? tot.ft / totalNet : 0;

  const comm = computeCommission(plan, sums);

  const projComm = computeCommission(plan, {
    gum: { ft: +proj.gum_ft || 0, ret: +proj.gum_ret || 0 },
    sa:  { ft: +proj.sa_ft  || 0, ret: +proj.sa_ret  || 0 },
  });
  const projTotal = ['gum_ft','gum_ret','xv_ft','xv_ret','se_ft','se_ret','sa_ft','sa_ret']
    .reduce((s, k) => s + (+proj[k] || 0), 0);

  const setActiveMonths = pred => {
    const next = {};
    for (let m = 1; m <= 12; m++) next[m] = pred(m);
    setActive(next);
  };

  const windowLabel = selectedMonths.length === 0
    ? 'Pick at least one month'
    : selectedMonths.length === 1
    ? `${MONTH_LABELS[selectedMonths[0] - 1]} ${year}`
    : `${MONTH_LABELS[selectedMonths[0] - 1]}–${MONTH_LABELS[selectedMonths[selectedMonths.length - 1] - 1]} ${year} • ${selectedMonths.length} mo`;

  // --- account filtering & sorting ---
  const filteredAccts = useMemo(() => {
    const q = acctSearch.trim().toLowerCase();
    let list = (accounts || []).slice();
    if (q) list = list.filter(a => (a.companyName || '').toLowerCase().includes(q) || (a.city || '').toLowerCase().includes(q) || (a.state || '').toLowerCase().includes(q));
    list.sort((a, b) => {
      const k = acctSort.key, d = acctSort.dir === 'asc' ? 1 : -1;
      const va = a[k] ?? '', vb = b[k] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * d;
      return String(va).localeCompare(String(vb)) * d;
    });
    return list;
  }, [accounts, acctSearch, acctSort]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    let list = (orders || []).slice();
    if (q) list = list.filter(o => (o.companyName || '').toLowerCase().includes(q) || (o.productLabels || []).some(p => p.toLowerCase().includes(q)));
    return list;
  }, [orders, orderSearch]);

  const toggleSort = (key) => {
    setAcctSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: INK }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 80px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 600, fontSize: 30, margin: '0 0 4px', color: RUST }}>{rep.name}</h1>
            <div style={{ fontSize: 13, color: MUTED }}>
              {rep.section} • {rep.region} territory • {plan ? plan.label : 'No comp plan loaded'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <button
              onClick={async () => {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/';
              }}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 500,
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                background: '#fff',
                color: COPPER_DARK,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
              }}
            >
              Sign out
            </button>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: HINT, marginBottom: 4 }}>Window</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: RUST }}>{windowLabel}</div>
            </div>
          </div>
        </div>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={lbl}>Year</span>
            <select value={year} onChange={e => setYear(+e.target.value)} style={selectStyle}>
              {yearsPresent.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <button onClick={() => setActiveMonths(m => yearRows.some(r => r.month === m && PRODUCTS.some(p => (r[p.key + '_ft'] || 0) + (r[p.key + '_ret'] || 0) > 0)))} style={btnSm}>Active months only</button>
            <button onClick={() => setActiveMonths(() => true)} style={btnSm}>All YTD</button>
            <button onClick={() => setActiveMonths(m => quarterOf(m) === Math.ceil((new Date().getMonth() + 1) / 3))} style={btnSm}>Current quarter</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const on = !!active[m];
              const r = yearRows.find(rr => rr.month === m);
              const tot = r ? PRODUCTS.reduce((s, p) => s + (r[p.key + '_ft'] || 0) + (r[p.key + '_ret'] || 0), 0) : 0;
              return (
                <button
                  key={m}
                  onClick={() => setActive(prev => ({ ...prev, [m]: !prev[m] }))}
                  style={{
                    padding: '6px 12px', borderRadius: 999,
                    border: `1px solid ${on ? COPPER_DARK : BORDER}`,
                    background: on ? COPPER_DARK : '#fff',
                    color: on ? '#fff' : (tot > 0 ? INK : HINT),
                    fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: on ? 500 : 400,
                  }}
                >
                  {MONTH_LABELS[m - 1]}{tot > 0 ? '' : ' ·'}
                </button>
              );
            })}
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
          <Kpi label="Total net sales"      value={fmt$(totalNet)}    sub={`${selectedMonths.length} mo selected`} />
          <Kpi label="First-time biz"       value={fmtPct(ftPct)}     sub={`${fmt$k(tot.ft)} of ${fmt$k(totalNet)}`} />
          <Kpi label="Total accounts"       value={fmtN(totalAccts)}  sub={`${fmtN(tot.ft_n)} new · ${fmtN(tot.ret_n)} ret`} />
          <Kpi label="Avg order value"      value={fmt$(aov)}         sub={totalAccts ? `${totalAccts} accounts` : '—'} />
          <Kpi label="Estimated commission" value={fmt$(comm.total)}  sub={comm.tier ? `Tier ${comm.tier.tier} on ${fmt$k(comm.base)} G+Sa` : 'No tier match'} />
        </div>

        <SectionTitle>Sales by product</SectionTitle>
        <ProductTable rows={visibleRows} months={selectedMonths} mode="dollars" totals={sums} grand={totalNet} />

        <SectionTitle>New accounts by product</SectionTitle>
        <ProductTable rows={visibleRows} months={selectedMonths} mode="counts" totals={sums} grand={totalAccts} />

        <SectionTitle>Commission — {plan ? plan.label : 'no plan loaded'}</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <Card>
            <div style={lbl}>Tier table</div>
            {plan ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
                <thead><tr style={{ color: MUTED }}><th style={th}>Tier</th><th style={th}>Threshold</th><th style={thR}>FT</th><th style={thR}>Ret</th></tr></thead>
                <tbody>
                  {plan.tiers.map(t => {
                    const cur = comm.tier && comm.tier.tier === t.tier;
                    return (
                      <tr key={t.tier} style={{ background: cur ? CREAM : 'transparent', fontWeight: cur ? 500 : 400, color: cur ? RUST : INK }}>
                        <td style={td}>{t.tier}</td>
                        <td style={td}>{t.label}</td>
                        <td style={tdR}>{(t.ft * 100).toFixed(0)}%</td>
                        <td style={tdR}>{(t.ret * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <div style={{ fontSize: 13, color: MUTED }}>No comp plan registered for <code>{rep.planKey}</code>.</div>}
            <div style={{ fontSize: 11, color: HINT, marginTop: 8, lineHeight: 1.5 }}>Tier set by combined Gummies + Sachets total in the selected window.</div>
          </Card>
          <Card>
            <div style={lbl}>Estimated this window</div>
            <div style={{ marginTop: 8 }}>
              <MiniRow label="Gummies + Sachets base" value={fmt$(comm.base)} />
              <MiniRow label="Tier placement" value={comm.tier ? `Tier ${comm.tier.tier} • ${(comm.tier.ft * 100).toFixed(0)}% / ${(comm.tier.ret * 100).toFixed(0)}%` : '—'} />
              <MiniRow label={`FT comm (${fmt$(comm.ftAmt)} × ${comm.tier ? (comm.tier.ft * 100).toFixed(0) : 0}%)`} value={fmt$(comm.ftComm)} />
              <MiniRow label={`Ret comm (${fmt$(comm.retAmt)} × ${comm.tier ? (comm.tier.ret * 100).toFixed(0) : 0}%)`} value={fmt$(comm.retComm)} />
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: RUST }}>Estimated total</span>
                <span style={{ fontSize: 18, fontWeight: 500, color: RUST }}>{fmt$(comm.total)}</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: HINT, marginTop: 8, lineHeight: 1.5 }}>XVIE ({fmt$(sums.xv.ft + sums.xv.ret)}) and Serum ({fmt$(sums.se.ft + sums.se.ret)}) sit on separate plans not yet loaded.</div>
          </Card>
        </div>

        <SectionTitle>Projected sales — input by product</SectionTitle>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {[
              ['Gummies $ (FT)', 'gum_ft'], ['Gummies $ (Ret)', 'gum_ret'],
              ['XVIE $ (FT)',    'xv_ft'],  ['XVIE $ (Ret)',    'xv_ret'],
              ['Serum $ (FT)',   'se_ft'],  ['Serum $ (Ret)',   'se_ret'],
              ['Sachets $ (FT)', 'sa_ft'],  ['Sachets $ (Ret)', 'sa_ret'],
            ].map(([label, key]) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{label}</span>
                <input type="number" min="0" step="100" value={proj[key]} onChange={e => setProj(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} />
              </label>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 14, paddingTop: 10 }}>
            <MiniRow label="Projected net sales (all products)" value={fmt$(projTotal)} />
            <MiniRow label="Gummies + Sachets base"             value={fmt$(projComm.base)} />
            <MiniRow label="Tier placement"                     value={projComm.tier ? `Tier ${projComm.tier.tier} • ${(projComm.tier.ft * 100).toFixed(0)}% / ${(projComm.tier.ret * 100).toFixed(0)}%` : '—'} />
            <MiniRow label="Projected commission"               value={fmt$(projComm.total)} bold />
          </div>
        </Card>

        {/* ---------- DRILL-DOWN: ACCOUNT HISTORY ---------- */}
        <SectionTitle>Account history <span style={subTitleHint}>· every account in your territory · click headers to sort</span></SectionTitle>
        <Card>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search accounts, cities, states…"
              value={acctSearch}
              onChange={e => setAcctSearch(e.target.value)}
              style={{ ...inputStyle, maxWidth: 300, padding: '7px 10px' }}
            />
            <span style={{ fontSize: 12, color: MUTED }}>{filteredAccts.length} of {accounts?.length || 0} accounts</span>
          </div>
          <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: SOFT_BG }}>
                  <SortHeader label="Account" k="companyName" sort={acctSort} onClick={toggleSort} align="left" />
                  <SortHeader label="City" k="city" sort={acctSort} onClick={toggleSort} align="left" />
                  <SortHeader label="State" k="state" sort={acctSort} onClick={toggleSort} align="left" />
                  <SortHeader label="Last order" k="lastOrderDate" sort={acctSort} onClick={toggleSort} />
                  <SortHeader label="Orders" k="orderCount" sort={acctSort} onClick={toggleSort} />
                  <SortHeader label="Lifetime $" k="totalRevenue" sort={acctSort} onClick={toggleSort} />
                  <th style={th}>Tier (current Q)</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccts.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: HINT, padding: 20 }}>No accounts to show.</td></tr>
                ) : filteredAccts.map((a) => {
                  const tc = a.loyaltyTier ? TIER_COLORS[a.loyaltyTier] : null;
                  return (
                    <tr key={a.customerId} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={td}>{a.companyName || <span style={{ color: HINT }}>—</span>}</td>
                      <td style={td}>{a.city || <span style={{ color: HINT }}>—</span>}</td>
                      <td style={td}>{a.state || <span style={{ color: HINT }}>—</span>}</td>
                      <td style={tdR}>{fmtDate(a.lastOrderDate)}</td>
                      <td style={tdR}>{fmtN(a.orderCount)}</td>
                      <td style={tdR}>{fmt$(a.totalRevenue)}</td>
                      <td style={td}>
                        {a.loyaltyTier ? (
                          <span style={{ background: tc.bg, color: tc.fg, padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 500 }}>{a.loyaltyTier}</span>
                        ) : <span style={{ color: HINT, fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ---------- DRILL-DOWN: RECENT ORDERS ---------- */}
        <SectionTitle>Recent orders <span style={subTitleHint}>· last 50 B2B orders, newest first</span></SectionTitle>
        <Card>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by account or product…"
              value={orderSearch}
              onChange={e => setOrderSearch(e.target.value)}
              style={{ ...inputStyle, maxWidth: 300, padding: '7px 10px' }}
            />
            <span style={{ fontSize: 12, color: MUTED }}>{filteredOrders.length} of {orders?.length || 0} orders</span>
          </div>
          <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: SOFT_BG }}>
                  <th style={th}>Date</th>
                  <th style={th}>Order</th>
                  <th style={th}>Account</th>
                  <th style={th}>Products</th>
                  <th style={thR}>Total</th>
                  <th style={th}>Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: HINT, padding: 20 }}>No orders.</td></tr>
                ) : filteredOrders.map(o => {
                  const productSummary = ['gum','xv','se','sa']
                    .filter(c => o.products[c] > 0)
                    .map(c => {
                      const qty = o[`${c.replace('xv','xv').replace('se','se').replace('sa','sa').replace('gum','gum')}Qty`] || 0;
                      return `${PRODUCTS.find(p => p.key === c).label}${qty ? ' ×' + qty : ''}`;
                    })
                    .join(', ');
                  return (
                    <tr key={o.orderId} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={td}>{fmtDate(o.date)}</td>
                      <td style={{ ...td, color: HINT, fontSize: 11 }}>{o.orderName || ('#' + String(o.orderId).slice(-6))}</td>
                      <td style={td}>{o.companyName || <span style={{ color: HINT }}>—</span>}</td>
                      <td style={{ ...td, fontSize: 12, color: MUTED }}>{productSummary || '—'}</td>
                      <td style={tdR}>{fmt$(o.total)}</td>
                      <td style={td}>
                        <span style={{
                          background: o.firstTimeAny ? CREAM : SOFT_BG,
                          color: o.firstTimeAny ? COPPER_DARK : MUTED,
                          padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 500,
                        }}>{o.firstTimeAny ? 'First-time' : 'Returning'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ fontSize: 11, color: HINT, marginTop: 32, lineHeight: 1.7, padding: 14, borderRadius: 6, border: `1px solid ${BORDER}`, background: SOFT_BG }}>
          <strong style={{ color: RUST }}>Definitions.</strong>{' '}
          A B2B order is any order ≥ $700 with a recognized rep tag, ADCS-tagged orders excluded.{' '}
          First-Time = customer&rsquo;s first-ever order of that product (across full Shopify history) falls within the selected month.{' '}
          Loyalty tier reflects gummy cases ordered in the current calendar quarter (1=Silver, 2-3=Gold, 4-5=Platinum, 6+=Diamond).{' '}
          <br /><br />
          <strong style={{ color: RUST }}>Live data.</strong>{' '}
          Pulled from Windsor.ai → Shopify and refreshed every 4 hours. Data caching is per-deployment; redeploy to force a refresh.
        </div>
      </div>
    </div>
  );
}

// ---- subcomponents ----
function Card({ children }) { return <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>{children}</div>; }
function SectionTitle({ children }) { return <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, margin: '24px 0 10px' }}>{children}</div>; }
function Kpi({ label, value, sub }) {
  return (
    <div style={{ background: SOFT_BG, borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: RUST, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: HINT, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
function MiniRow({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', fontSize: 13, borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ color: MUTED, fontSize: 12 }}>{label}</span>
      <span style={{ fontWeight: bold ? 500 : 400, color: bold ? RUST : INK, fontSize: bold ? 14 : 13 }}>{value}</span>
    </div>
  );
}
function SortHeader({ label, k, sort, onClick, align }) {
  const active = sort.key === k;
  const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <th
      onClick={() => onClick(k)}
      style={{ ...(align === 'left' ? th : thR), cursor: 'pointer', userSelect: 'none', color: active ? RUST : MUTED }}
    >
      {label}{arrow}
    </th>
  );
}
function ProductTable({ rows, months, mode, totals, grand }) {
  const isDollar = mode === 'dollars';
  const fmt = isDollar ? fmt$ : fmtN;
  const ftKey  = isDollar ? '_ft'  : '_ft_n';
  const retKey = isDollar ? '_ret' : '_ret_n';
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 6, background: '#fff' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: SOFT_BG }}>
            <th style={{ ...th, position: 'sticky', left: 0, background: SOFT_BG, zIndex: 1 }}>Product</th>
            {months.map(m => <th key={m} style={thR}>{MONTH_LABELS[m - 1]}</th>)}
            <th style={{ ...thR, borderLeft: `1px solid ${BORDER}` }}>Period</th>
          </tr>
        </thead>
        <tbody>
          {PRODUCTS.map(p => {
            const ftVals  = rows.map(r => r[p.key + ftKey]  || 0);
            const retVals = rows.map(r => r[p.key + retKey] || 0);
            const totVals = ftVals.map((v, i) => v + retVals[i]);
            const periodTot = isDollar ? (totals[p.key].ft + totals[p.key].ret) : (totals[p.key].ft_n + totals[p.key].ret_n);
            return (
              <React.Fragment key={p.key}>
                <tr style={{ background: '#FCF7F1', fontWeight: 500 }}>
                  <td style={{ ...td, position: 'sticky', left: 0, background: '#FCF7F1', zIndex: 1, color: RUST }}>{p.label}</td>
                  {totVals.map((v, i) => <td key={i} style={tdR}>{v ? fmt(v) : <span style={{ color: HINT }}>—</span>}</td>)}
                  <td style={{ ...tdR, borderLeft: `1px solid ${BORDER}`, color: RUST }}>{periodTot ? fmt(periodTot) : '—'}</td>
                </tr>
                <tr style={{ color: MUTED, fontSize: 12 }}>
                  <td style={{ ...td, paddingLeft: 28, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>First-time</td>
                  {ftVals.map((v, i) => <td key={i} style={tdR}>{v ? fmt(v) : <span style={{ color: HINT }}>—</span>}</td>)}
                  <td style={{ ...tdR, borderLeft: `1px solid ${BORDER}` }}>{(isDollar ? totals[p.key].ft : totals[p.key].ft_n) ? fmt(isDollar ? totals[p.key].ft : totals[p.key].ft_n) : '—'}</td>
                </tr>
                <tr style={{ color: MUTED, fontSize: 12 }}>
                  <td style={{ ...td, paddingLeft: 28, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Returning</td>
                  {retVals.map((v, i) => <td key={i} style={tdR}>{v ? fmt(v) : <span style={{ color: HINT }}>—</span>}</td>)}
                  <td style={{ ...tdR, borderLeft: `1px solid ${BORDER}` }}>{(isDollar ? totals[p.key].ret : totals[p.key].ret_n) ? fmt(isDollar ? totals[p.key].ret : totals[p.key].ret_n) : '—'}</td>
                </tr>
              </React.Fragment>
            );
          })}
          <tr style={{ borderTop: `2px solid ${COPPER_DARK}`, background: SOFT_BG, fontWeight: 500 }}>
            <td style={{ ...td, position: 'sticky', left: 0, background: SOFT_BG, zIndex: 1, color: RUST }}>{isDollar ? 'Total net' : 'Total accts'}</td>
            {rows.map((r, i) => {
              const v = PRODUCTS.reduce((s, p) => s + (r[p.key + ftKey] || 0) + (r[p.key + retKey] || 0), 0);
              return <td key={i} style={tdR}>{v ? fmt(v) : '—'}</td>;
            })}
            <td style={{ ...tdR, borderLeft: `1px solid ${BORDER}`, color: RUST }}>{fmt(grand)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---- styles ----
const th  = { padding: '10px 10px', textAlign: 'left',  fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUTED, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' };
const thR = { ...th, textAlign: 'right' };
const td  = { padding: '8px 10px', textAlign: 'left',  fontSize: 13, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' };
const tdR = { ...td, textAlign: 'right' };
const lbl = { fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUTED };
const subTitleHint = { fontSize: 11, fontWeight: 400, color: HINT, textTransform: 'none', letterSpacing: 0, marginLeft: 8 };
const btnSm = { padding: '6px 10px', fontSize: 11, fontWeight: 500, border: `1px solid ${BORDER}`, borderRadius: 6, background: '#fff', color: COPPER_DARK, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em' };
const selectStyle = { padding: '6px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 13, color: INK, fontFamily: 'inherit' };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '6px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: INK };
