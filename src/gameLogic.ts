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

/**
 * Calculate Levenshtein distance between two strings
 * (minimum number of single-character edits required to change one string into another)
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Check if two strings are similar enough to be considered the same (fuzzy matching)
 * Uses Levenshtein distance with a threshold based on string length
 */
function isSimilarEnough(a: string, b: string): boolean {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  
  // Allow up to 2 errors for strings under 10 chars, or 30% of length for longer strings
  const threshold = maxLength < 10 ? 2 : Math.ceil(maxLength * 0.3);
  
  return distance <= threshold;
}

export interface GuessResult {
  correct: boolean;
  correctSpelling?: string; // Only set if spelling was wrong but close
}

export function checkGuess(userInput: string, feature: GeoJSONFeature): GuessResult {
  const canonical = getCanonicalName(feature.properties);
  const normalizedCanonical = normalizeCanonical(canonical);
  const normalizedInput = normalize(userInput);

  const resolvedInput = NAME_ALIASES[normalizedInput] ?? userInput;
  const normalizedResolved = normalizeCanonical(resolvedInput);

  // Exact matches (original logic)
  if (normalizedResolved === normalizedCanonical) return { correct: true };
  if (normalize(resolvedInput) === normalize(canonical)) return { correct: true };
  
  // Fuzzy matching for spelling mistakes
  if (isSimilarEnough(normalizedResolved, normalizedCanonical)) {
    return { correct: true, correctSpelling: canonical };
  }
  if (isSimilarEnough(normalize(resolvedInput), normalize(canonical))) {
    return { correct: true, correctSpelling: canonical };
  }
  
  return { correct: false };
}
