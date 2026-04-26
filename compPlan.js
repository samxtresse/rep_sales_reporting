// lib/compPlan.js
// Quarterly comp plan tier tables. Tier base = Gummies + Sachets combined.
// FT/Ret rates apply to FT/Ret revenue inside the combined base.

export const COMP_PLANS = {
  'new-2026-q1-gummies': {
    label: 'Q1 2026 — New Rep — Gummies + Sachets',
    base: 'gum_plus_sa',
    tiers: [
      { tier: 1, lo: 45000, ft: 0.25, ret: 0.20, label: '$45K+' },
      { tier: 2, lo: 35000, ft: 0.22, ret: 0.17, label: '$35–44K' },
      { tier: 3, lo: 20000, ft: 0.20, ret: 0.15, label: '$20–34K' },
      { tier: 4, lo: 1,     ft: 0.10, ret: 0.05, label: '$1–19K' },
    ],
  },
  'existing-2026-q1-gummies': {
    label: 'Q1 2026 — Existing Rep — Gummies + Sachets',
    base: 'gum_plus_sa',
    tiers: [
      { tier: 1, lo: 65000, ft: 0.25, ret: 0.20, label: '$65K+' },
      { tier: 2, lo: 55000, ft: 0.22, ret: 0.17, label: '$55–64K' },
      { tier: 3, lo: 31000, ft: 0.20, ret: 0.15, label: '$31–54K' },
      { tier: 4, lo: 1,     ft: 0.10, ret: 0.05, label: '$1–30K' },
    ],
  },
};

export function getPlan(planKey) {
  return COMP_PLANS[planKey] || null;
}

export function tierFor(plan, base) {
  if (!plan) return null;
  for (const t of plan.tiers) if (base >= t.lo) return t;
  return null;
}

export function computeCommission(plan, sums) {
  const gum = sums.gum || { ft: 0, ret: 0 };
  const sa  = sums.sa  || { ft: 0, ret: 0 };
  const base = gum.ft + gum.ret + sa.ft + sa.ret;
  const t = tierFor(plan, base);
  const ftAmt  = gum.ft + sa.ft;
  const retAmt = gum.ret + sa.ret;
  if (!t) return { tier: null, base, ftAmt, retAmt, ftComm: 0, retComm: 0, total: 0 };
  return {
    tier: t,
    base,
    ftAmt,
    retAmt,
    ftComm:  ftAmt  * t.ft,
    retComm: retAmt * t.ret,
    total:   ftAmt * t.ft + retAmt * t.ret,
  };
}
