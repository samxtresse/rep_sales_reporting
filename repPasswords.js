// lib/repPasswords.js
// Three resolution paths for a rep's password (in priority order):
//   1. REP_PASS_<SLUG> env var override (per rep)
//   2. REP_PASSWORDS JSON env var override (multiple at once)
//   3. lowercase last name from lib/repRoster.js (default)
//
// findRepByPassword() walks the roster and returns the rep whose password
// matches the input — used by the single-input login flow.

import { REPS, getRepBySlug, defaultPasswordFor } from './repRoster.js';

export function getRepPassword(slug) {
  const s = String(slug || '').toLowerCase();
  if (!s) return null;

  const envKey = 'REP_PASS_' + s.toUpperCase().replace(/-/g, '_');
  if (process.env[envKey]) return process.env[envKey];

  const blob = process.env.REP_PASSWORDS;
  if (blob) {
    try {
      const map = JSON.parse(blob);
      if (map && typeof map[s] === 'string') return map[s];
    } catch {
      // ignore parse error
    }
  }

  const rep = getRepBySlug(s);
  return defaultPasswordFor(rep);
}

// Canonical (lowercase, trimmed) password to use when comparing.
export function canonicalPassword(s) {
  return String(s || '').toLowerCase().trim();
}

// Find which rep a typed password belongs to. Returns the rep object or null.
// O(N) over the 19 reps. If two reps had the same surname this would return
// the first match — current roster has no collisions.
export function findRepByPassword(password) {
  const norm = canonicalPassword(password);
  if (!norm) return null;
  for (const rep of REPS) {
    const expected = canonicalPassword(getRepPassword(rep.slug));
    if (expected && expected === norm) return rep;
  }
  return null;
}
