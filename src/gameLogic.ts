import type { GeoJSONFeature } from './data/types';

const NAME_ALIASES: Record<string, string> = {
  usa: 'United States of America',
  'united states': 'United States of America',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  'the gambia': 'Gambia',
  gambia: 'Gambia',
  'republic of the congo': 'Republic of the Congo',
  'democratic republic of the congo': 'Democratic Republic of the Congo',
  drc: 'Democratic Republic of the Congo',
  congo: 'Republic of the Congo',
  'ivory coast': "Côte d'Ivoire",
  "côte d'ivoire": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  'taiwan': 'Taiwan',
  'vatican': 'Vatican City',
  'vatican city': 'Vatican City',
  'south korea': 'South Korea',
  'north korea': 'North Korea',
  'russia': 'Russian Federation',
  'russian federation': 'Russian Federation',
  'iran': 'Iran',
  'syria': 'Syria',
  'laos': 'Lao PDR',
  'lao pdr': 'Lao PDR',
  'bolivia': 'Bolivia',
  'venezuela': 'Venezuela',
  'tanzania': 'United Republic of Tanzania',
  'united republic of tanzania': 'United Republic of Tanzania',
  'brunei': 'Brunei Darussalam',
  'brunei darussalam': 'Brunei Darussalam',
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeCanonical(name: string): string {
  let n = normalize(name);
  if (n.startsWith('the ')) n = n.slice(4);
  return n;
}

export function getCanonicalName(properties: { ADMIN?: string; NAME_EN?: string }): string {
  return (properties.NAME_EN ?? properties.ADMIN ?? '').trim();
}

export function checkGuess(userInput: string, feature: GeoJSONFeature): boolean {
  const canonical = getCanonicalName(feature.properties);
  const normalizedCanonical = normalizeCanonical(canonical);
  const normalizedInput = normalize(userInput);

  const resolvedInput = NAME_ALIASES[normalizedInput] ?? userInput;
  const normalizedResolved = normalizeCanonical(resolvedInput);

  if (normalizedResolved === normalizedCanonical) return true;
  if (normalize(resolvedInput) === normalize(canonical)) return true;
  return false;
}
