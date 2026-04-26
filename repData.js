// lib/repData.js
// Single Windsor.ai pull (Shopify line items, Jan 2025 onward) → cached 4hr →
// produces three aggregations per rep:
//
//   monthly[]   — per-month × per-product × FT/Ret aggregates (existing)
//   accounts[]  — one row per unique customer in the rep's territory
//   orders[]    — per-order rollups (line items grouped) for drill-down
//
// All three are filtered to the rep slug before the dashboard ever sees them.

import { unstable_cache } from 'next/cache';
import { matchRepFromTags } from './repRoster.js';

const GUMMY_SKUS  = new Set(['860011740100', 'XTRS001']);
const XVIE_SKUS   = new Set(['X-XVIE-2ML-006']);
const SERUM_SKUS  = new Set(['X-FRC-30ML-CASE', 'X-FRC-30ML-001']);
const SACHET_SKUS = new Set(['X-GN-002CT-001', 'X-GN-002CT-002', 'X-GN-002CT-003', 'X-GN-002CT-004']);
const EXCLUDE_SKUS = new Set(['XTR-SHPR-DBL', 'X-GN-002CT-RAW']);

function classifyBySku(sku, title) {
  if (!sku) {
    const t = (title || '').toLowerCase();
    if (t.includes('sachet') && !t.includes('gummy on the go')) return 'sa';
    if (t.includes('gummy on the go')) return 'sa';
    if (t.includes('xvie')) return 'xv';
    if (t.includes('serum')) return 'se';
    if (t.includes('gummy') || t.includes('gummies')) return 'gum';
    return null;
  }
  if (EXCLUDE_SKUS.has(sku)) return null;
  if (GUMMY_SKUS.has(sku))   return 'gum';
  if (XVIE_SKUS.has(sku))    return 'xv';
  if (SERUM_SKUS.has(sku))   return 'se';
  if (SACHET_SKUS.has(sku))  return 'sa';
  if (sku.startsWith('X-GN-002CT')) return 'sa';
  const u = sku.toUpperCase();
  if (u.includes('XVIE')) return 'xv';
  if (u.includes('FRC'))  return 'se';
  return null;
}

const PRODUCT_LABEL = { gum: 'Gummies', xv: 'XVIE', se: 'Serum', sa: 'Sachets' };
const B2B_THRESHOLD = 700;

// ---- Loyalty tier from quarterly gummy case quantity ----
// 1 case = Silver, 2-3 = Gold, 4-5 = Platinum, 6+ = Diamond. National = None.
function loyaltyTier(caseQty) {
  if (!caseQty || caseQty < 1) return null;
  if (caseQty === 1) return 'Silver';
  if (caseQty <= 3) return 'Gold';
  if (caseQty <= 5) return 'Platinum';
  return 'Diamond';
}

// ---- Windsor.ai fetch ----

async function windsorFetch(fields, dateFrom, dateTo) {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) throw new Error('Missing WINDSOR_API_KEY env var');
  const account = process.env.WINDSOR_ACCOUNT || 'ace1d0-26.myshopify.com';

  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  params.set('connector', 'shopify');
  params.set('account', account);
  params.set('fields', fields.join(','));
  params.set('date_from', dateFrom);
  params.set('date_to', dateTo);
  params.set('date_filters', JSON.stringify({ orders: 'createdAt' }));

  const url = 'https://api.windsor.ai/connectors/shopify?' + params.toString();
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Windsor.ai fetch failed: ${res.status} ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.data || json.rows || [];
}

function ymOf(s) {
  if (!s) return null;
  const d = String(s).slice(0, 10);
  const [y, m] = d.split('-').map(Number);
  if (!y || !m) return null;
  return { y, m };
}

function lineRevenue(r) {
  const price = Number(r.line_item__price || 0);
  const qty   = Number(r.line_item__quantity || 0);
  const disc  = Number(r.line_item__total_discount || 0);
  return price * qty - disc;
}

function pickFirst(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

// ---- Build all derivations from a single Windsor pull ----

async function buildAllRepData() {
  // Try a generous field list. Windsor returns nulls for fields not exposed
  // by the connector — `pickFirst` collapses fallbacks gracefully.
  const fields = [
    'order_id',
    'order_name',
    'order_created_at',
    'order_total_price',
    'order_tags',
    'order_customer_id',
    'order_email',
    'order_shipping_company',
    'order_shipping_address__company',
    'order_billing_company',
    'order_billing_address__company',
    'order_shipping_city',
    'order_shipping_address__city',
    'order_shipping_province',
    'order_shipping_province_code',
    'order_shipping_address__province',
    'line_item__sku',
    'line_item__title',
    'line_item__price',
    'line_item__quantity',
    'line_item__total_discount',
  ];

  // History from Jan 2024 onward — gives us the first-purchase signal needed
  // to classify FT vs Returning correctly. The dashboard's year selector
  // will surface 2025 onward as soon as data exists.
  const today = new Date().toISOString().slice(0, 10);
  const all = await windsorFetch(fields, '2024-01-01', today);

  // ---- Pass 1: first-purchase date per customer per category (full history) ----
  const firstDate = new Map();
  for (const r of all) {
    const cust = String(r.order_customer_id || (r.order_email || '').toLowerCase());
    if (!cust || cust === 'none') continue;
    const date = String(r.order_created_at || '').slice(0, 10);
    if (!date) continue;
    const cat = classifyBySku(r.line_item__sku, r.line_item__title);
    if (!cat) continue;
    if (!firstDate.has(cust)) firstDate.set(cust, {});
    const obj = firstDate.get(cust);
    if (!obj[cat] || date < obj[cat]) obj[cat] = date;
  }

  // ---- Pass 2: aggregate per rep ----
  // Three structures keyed by rep slug:
  //   monthlyByRep[slug]  → Map<'YYYY-MM', monthlyRow>
  //   acctsByRep[slug]    → Map<custKey, accountRow>
  //   ordersByRep[slug]   → Map<orderId, orderRow>
  const monthlyByRep = new Map();
  const acctsByRep = new Map();
  const ordersByRep = new Map();

  function emptyMonthly(slug, y, m) {
    return {
      repSlug: slug, year: y, month: m,
      gum_ft: 0, gum_ret: 0, gum_ft_n: 0, gum_ret_n: 0,
      xv_ft:  0, xv_ret:  0, xv_ft_n:  0, xv_ret_n:  0,
      se_ft:  0, se_ret:  0, se_ft_n:  0, se_ret_n:  0,
      sa_ft:  0, sa_ret:  0, sa_ft_n:  0, sa_ret_n:  0,
      _ft_custs: { gum: new Set(), xv: new Set(), se: new Set(), sa: new Set() },
      _ret_custs:{ gum: new Set(), xv: new Set(), se: new Set(), sa: new Set() },
    };
  }
  function getMonthly(slug, y, m) {
    if (!monthlyByRep.has(slug)) monthlyByRep.set(slug, new Map());
    const sub = monthlyByRep.get(slug);
    const k = `${y}-${String(m).padStart(2, '0')}`;
    if (!sub.has(k)) sub.set(k, emptyMonthly(slug, y, m));
    return sub.get(k);
  }
  function getAccount(slug, custKey) {
    if (!acctsByRep.has(slug)) acctsByRep.set(slug, new Map());
    const sub = acctsByRep.get(slug);
    if (!sub.has(custKey)) {
      sub.set(custKey, {
        customerId: custKey,
        companyName: '',
        city: '',
        state: '',
        firstOrderDate: '',
        lastOrderDate: '',
        orderCount: 0,
        orderIds: new Set(),
        totalRevenue: 0,
        productMix: { gum: 0, xv: 0, se: 0, sa: 0 },
        gumCasesQuarter: 0, // for loyalty tier — counted within current quarter in postprocess
      });
    }
    return sub.get(custKey);
  }
  function getOrder(slug, orderId) {
    if (!ordersByRep.has(slug)) ordersByRep.set(slug, new Map());
    const sub = ordersByRep.get(slug);
    if (!sub.has(orderId)) {
      sub.set(orderId, {
        orderId,
        orderName: '',
        date: '',
        customerId: '',
        companyName: '',
        city: '',
        state: '',
        total: 0,
        products: { gum: 0, xv: 0, se: 0, sa: 0 },
        productLabels: new Set(),
        gumQty: 0,
        xvQty: 0,
        seQty: 0,
        saQty: 0,
        firstTimeAny: false,
      });
    }
    return sub.get(orderId);
  }

  for (const r of all) {
    const orderTotal = Number(r.order_total_price || 0);
    if (orderTotal < B2B_THRESHOLD) continue;
    const slug = matchRepFromTags(r.order_tags);
    if (!slug || slug === '__EXCLUDE__') continue;

    const cat = classifyBySku(r.line_item__sku, r.line_item__title);
    if (!cat) continue;

    const ym = ymOf(r.order_created_at);
    if (!ym) continue;

    const dateStr = String(r.order_created_at || '').slice(0, 10);
    const ymKey = `${ym.y}-${String(ym.m).padStart(2, '0')}`;
    const cust = String(r.order_customer_id || (r.order_email || '').toLowerCase());
    const fd = firstDate.get(cust)?.[cat];
    const rev = lineRevenue(r);
    const qty = Number(r.line_item__quantity || 0);
    const isFT = fd && fd.slice(0, 7) === ymKey;

    // monthly
    const row = getMonthly(slug, ym.y, ym.m);
    if (isFT) { row[`${cat}_ft`] += rev; row._ft_custs[cat].add(cust); }
    else      { row[`${cat}_ret`] += rev; row._ret_custs[cat].add(cust); }

    // account
    const a = getAccount(slug, cust);
    a.totalRevenue += rev;
    a.productMix[cat] += rev;
    if (!a.firstOrderDate || dateStr < a.firstOrderDate) a.firstOrderDate = dateStr;
    if (!a.lastOrderDate  || dateStr > a.lastOrderDate)  a.lastOrderDate  = dateStr;
    a.orderIds.add(r.order_id);
    if (!a.companyName) {
      a.companyName = pickFirst(
        r.order_shipping_company,
        r.order_shipping_address__company,
        r.order_billing_company,
        r.order_billing_address__company,
        r.order_email
      );
    }
    if (!a.city)  a.city  = pickFirst(r.order_shipping_city, r.order_shipping_address__city);
    if (!a.state) a.state = pickFirst(r.order_shipping_province_code, r.order_shipping_province, r.order_shipping_address__province);

    // order
    const o = getOrder(slug, r.order_id);
    o.date = o.date && o.date < dateStr ? o.date : dateStr;
    o.orderName = r.order_name || o.orderName;
    o.customerId = cust;
    o.total += rev;
    o.products[cat] += rev;
    if (cat === 'gum') o.gumQty += qty;
    if (cat === 'xv') o.xvQty += qty;
    if (cat === 'se') o.seQty += qty;
    if (cat === 'sa') o.saQty += qty;
    o.productLabels.add(PRODUCT_LABEL[cat]);
    if (isFT) o.firstTimeAny = true;
    if (!o.companyName) {
      o.companyName = pickFirst(
        r.order_shipping_company,
        r.order_shipping_address__company,
        r.order_billing_company,
        r.order_billing_address__company,
        r.order_email
      );
    }
    if (!o.city)  o.city  = pickFirst(r.order_shipping_city, r.order_shipping_address__city);
    if (!o.state) o.state = pickFirst(r.order_shipping_province_code, r.order_shipping_province, r.order_shipping_address__province);
  }

  // ---- Finalize: counts, loyalty, sort ----
  const monthlyOut = [];
  for (const [slug, sub] of monthlyByRep) {
    for (const [, row] of sub) {
      for (const c of ['gum','xv','se','sa']) {
        row[`${c}_ft_n`]  = row._ft_custs[c].size;
        row[`${c}_ret_n`] = row._ret_custs[c].size;
      }
      delete row._ft_custs;
      delete row._ret_custs;
      monthlyOut.push(row);
    }
  }

  // accounts: convert orderIds Set → count, attach loyalty tier
  const accountsOut = [];
  for (const [slug, sub] of acctsByRep) {
    for (const [, a] of sub) {
      a.orderCount = a.orderIds.size;
      delete a.orderIds;
      a.repSlug = slug;
      // Loyalty tier from current-quarter gummy cases.
      // We approximate by counting unique gummy-orders in the most recent
      // quarter present in their data — same shape as the workbook.
      // (Detailed quarterly tier is computed at render time from monthly rows.)
      accountsOut.push(a);
    }
  }

  const ordersOut = [];
  for (const [slug, sub] of ordersByRep) {
    for (const [, o] of sub) {
      o.repSlug = slug;
      o.productLabels = Array.from(o.productLabels);
      ordersOut.push(o);
    }
  }

  return { monthly: monthlyOut, accounts: accountsOut, orders: ordersOut };
}

export const getAllRepData = unstable_cache(
  buildAllRepData,
  ['rep-detail-v1'],
  { revalidate: 14400, tags: ['rep-detail'] }
);

// ---------- per-rep slices ----------

export async function getRepMonthlyData(slug) {
  if (!slug) return [];
  const { monthly } = await getAllRepData();
  return monthly
    .filter(r => r.repSlug === slug)
    .sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

// Account-level rollup for one rep, with loyalty tier inferred from gummy
// cases in the most recent calendar quarter.
export async function getRepAccountData(slug) {
  if (!slug) return [];
  const { accounts, orders } = await getAllRepData();
  const accts = accounts.filter(a => a.repSlug === slug);

  // Compute current-quarter gummy case count per customer for loyalty tier.
  // Uses the most recent quarter that exists in their order history.
  const today = new Date();
  const curY = today.getUTCFullYear();
  const curQ = Math.ceil((today.getUTCMonth() + 1) / 3);
  const qStart = new Date(Date.UTC(curY, (curQ - 1) * 3, 1)).toISOString().slice(0, 10);

  const gumCasesByCustQ = new Map();
  for (const o of orders) {
    if (o.repSlug !== slug) continue;
    if (!o.date || o.date < qStart) continue;
    if (!o.gumQty) continue;
    gumCasesByCustQ.set(o.customerId, (gumCasesByCustQ.get(o.customerId) || 0) + o.gumQty);
  }

  return accts
    .map(a => ({
      ...a,
      gumCasesQuarter: gumCasesByCustQ.get(a.customerId) || 0,
      loyaltyTier: loyaltyTier(gumCasesByCustQ.get(a.customerId) || 0),
    }))
    .sort((a, b) => (b.lastOrderDate || '').localeCompare(a.lastOrderDate || ''));
}

// Last N B2B orders for a rep, newest first.
export async function getRepRecentOrders(slug, limit = 50) {
  if (!slug) return [];
  const { orders } = await getAllRepData();
  return orders
    .filter(o => o.repSlug === slug)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, limit);
}

// Convenience: get everything one rep needs in a single call.
export async function getRepBundle(slug) {
  const [monthly, accounts, orders] = await Promise.all([
    getRepMonthlyData(slug),
    getRepAccountData(slug),
    getRepRecentOrders(slug, 50),
  ]);
  return { monthly, accounts, orders };
}
