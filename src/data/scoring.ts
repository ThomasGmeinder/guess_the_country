/**
 * Points per country: less well-known (lower population rank) = more points.
 * Tier 1: top ~20 by population = 10 pts
 * Tier 2: next ~50 = 25 pts
 * Tier 3: rest = 50 pts
 */
const TIER1_POINTS = 10;
const TIER2_POINTS = 25;
const TIER3_POINTS = 50;

/** ISO_A2 codes of the ~20 most populous countries (order doesn't matter for tier). */
const TIER1_ISO = new Set([
  'IN', 'CN', 'US', 'ID', 'PK', 'NG', 'BR', 'BD', 'RU', 'ET', 'MX', 'JP', 'PH', 'EG', 'CD', 'VN', 'TR', 'IR', 'DE', 'TH',
]);

/** Next ~50 by population. */
const TIER2_ISO = new Set([
  'GB', 'TZ', 'FR', 'ZA', 'KE', 'KR', 'ES', 'AR', 'UG', 'DZ', 'SD', 'UA', 'IQ', 'CA', 'PL', 'MA', 'SA', 'UZ', 'PE', 'AF',
  'MY', 'AO', 'MZ', 'GH', 'YE', 'NP', 'VE', 'AU', 'MG', 'KP', 'CM', 'CI', 'NE', 'TW', 'LK', 'BF', 'ML', 'RO', 'MW', 'CL',
  'KZ', 'ZM', 'GT', 'EC', 'SY', 'NL', 'SN', 'KH', 'TD', 'SO',
]);

export function getPointsForCountry(iso: string, _popEst?: number): number {
  if (TIER1_ISO.has(iso)) return TIER1_POINTS;
  if (TIER2_ISO.has(iso)) return TIER2_POINTS;
  return TIER3_POINTS;
}

export function buildPointsMap(features: { properties: { ISO_A2: string; POP_EST?: number } }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const f of features) {
    const iso = f.properties.ISO_A2;
    if (iso && iso !== '-99') map.set(iso, getPointsForCountry(iso, f.properties.POP_EST));
  }
  return map;
}
