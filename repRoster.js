// lib/repRoster.js
// 19 W2 reps. Password = lowercase last name (no spaces, no punctuation).
// `tagVariants` are case-insensitive substrings to match against Shopify
// `order_tags`. Add any historical misspellings here.

export const REPS = [
  // Existing W2 (11)
  { slug: 'jamie-bergeron',         name: 'Jamie Bergeron',         lastName: 'Bergeron',         section: 'Existing W2', region: 'West', tagVariants: ['jamie bergeron'],         planKey: 'existing-2026-q1-gummies' },
  { slug: 'michelle-spencer',       name: 'Michelle Spencer',       lastName: 'Spencer',          section: 'Existing W2', region: 'East', tagVariants: ['michelle spencer'],       planKey: 'existing-2026-q1-gummies' },
  { slug: 'dia-lamport',            name: 'Dia Lamport',            lastName: 'Lamport',          section: 'Existing W2', region: 'East', tagVariants: ['dia lamport'],            planKey: 'existing-2026-q1-gummies' },
  { slug: 'cheryl-greiber',         name: 'Cheryl Greiber',         lastName: 'Greiber',          section: 'Existing W2', region: 'West', tagVariants: ['cheryl greiber'],         planKey: 'existing-2026-q1-gummies' },
  { slug: 'denisse-schimelpfening', name: 'Denisse Schimelpfening', lastName: 'Schimelpfening',   section: 'Existing W2', region: 'West', tagVariants: ['denisse schimelpfening'], planKey: 'existing-2026-q1-gummies' },
  { slug: 'laura-mann',             name: 'Laura Mann',             lastName: 'Mann',             section: 'Existing W2', region: 'West', tagVariants: ['laura mann'],             planKey: 'existing-2026-q1-gummies' },
  { slug: 'sherry-quinn',           name: 'Sherry Quinn',           lastName: 'Quinn',            section: 'Existing W2', region: 'East', tagVariants: ['sherry quinn'],           planKey: 'existing-2026-q1-gummies' },
  { slug: 'tyler-de-masi',          name: 'Tyler De Masi',          lastName: 'De Masi',          section: 'Existing W2', region: 'East', tagVariants: ['tyler de masi', 'tyler demasi'], planKey: 'existing-2026-q1-gummies' },
  { slug: 'michelle-boehle',        name: 'Michelle Boehle',        lastName: 'Boehle',           section: 'Existing W2', region: 'West', tagVariants: ['michelle boehle'],        planKey: 'existing-2026-q1-gummies' },
  { slug: 'sonia-mace',             name: 'Sonia Mace',             lastName: 'Mace',             section: 'Existing W2', region: 'East', tagVariants: ['sonia mace'],             planKey: 'existing-2026-q1-gummies' },
  { slug: 'taylor-bates',           name: 'Taylor Bates',           lastName: 'Bates',            section: 'Existing W2', region: 'East', tagVariants: ['taylor bates'],           planKey: 'existing-2026-q1-gummies' },

  // New W2 (8)
  { slug: 'heidi-fisher',    name: 'Heidi Fisher',    lastName: 'Fisher',   section: 'New W2', region: 'West', tagVariants: ['heidi fisher'],    planKey: 'new-2026-q1-gummies' },
  { slug: 'amy-pierre',      name: 'Amy Pierre',      lastName: 'Pierre',   section: 'New W2', region: 'East', tagVariants: ['amy pierre'],      planKey: 'new-2026-q1-gummies' },
  { slug: 'gina-napoli',     name: 'Gina Napoli',     lastName: 'Napoli',   section: 'New W2', region: 'East', tagVariants: ['gina napoli'],     planKey: 'new-2026-q1-gummies' },
  { slug: 'megan-gilbert',   name: 'Megan Gilbert',   lastName: 'Gilbert',  section: 'New W2', region: 'East', tagVariants: ['megan gilbert'],   planKey: 'new-2026-q1-gummies' },
  { slug: 'bridget-selberg', name: 'Bridget Selberg', lastName: 'Selberg',  section: 'New W2', region: 'West', tagVariants: ['bridget selberg'], planKey: 'new-2026-q1-gummies' },
  { slug: 'carrie-dodge',    name: 'Carrie Dodge',    lastName: 'Dodge',    section: 'New W2', region: 'West', tagVariants: ['carrie dodge'],    planKey: 'new-2026-q1-gummies' },
  { slug: 'morgan-hood',     name: 'Morgan Hood',     lastName: 'Hood',     section: 'New W2', region: 'East', tagVariants: ['morgan hood'],     planKey: 'new-2026-q1-gummies' },
  { slug: 'james-tuckett',   name: 'James Tuckett',   lastName: 'Tuckett',  section: 'New W2', region: 'West', tagVariants: ['james tuckett'],   planKey: 'new-2026-q1-gummies' },
];

export function getRepBySlug(slug) {
  if (!slug) return null;
  return REPS.find(r => r.slug === String(slug).toLowerCase()) || null;
}

// Lowercase, alphanumeric-only password from the rep's last name.
export function defaultPasswordFor(rep) {
  if (!rep || !rep.lastName) return null;
  return String(rep.lastName).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Match a Shopify order_tags string to a rep slug. Returns rep slug,
// '__EXCLUDE__' for ADCS-tagged orders, or null if no match.
export function matchRepFromTags(tags) {
  if (!tags) return null;
  const arr = Array.isArray(tags) ? tags : String(tags).split(/[,;]/);
  const norm = arr.map(t => String(t).trim().toLowerCase()).filter(Boolean);
  if (norm.some(t => t.includes('adcs') || t.includes('advanced derm'))) return '__EXCLUDE__';
  for (const rep of REPS) {
    for (const variant of rep.tagVariants) {
      if (norm.some(t => t === variant || t.includes(variant))) return rep.slug;
    }
  }
  return null;
}
