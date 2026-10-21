import type { HierarchyNode } from './types';

/** One fuzzy match of a query against a piece of text. */
export interface FuzzyMatch {
  score: number;
  /** indices into the text of the matched characters, ascending */
  positions: number[];
}

/** A symbol that matched a search query. */
export interface SearchResult {
  node: HierarchyNode;
  score: number;
  /** matched character indices in `node.name`, for highlighting */
  namePositions: number[];
}

/** A name match counts double and a path match this much, so a hit in the name outranks the same hit in the folders. */
const NAME_WEIGHT = 2;
const PATH_WEIGHT = 0.6;

const isAlnum = (c: string) => /[A-Za-z0-9]/.test(c);

/** Whether `j` starts a word: the first character, after a separator, or a lower-to-upper camelCase step. */
function isWordStart(s: string, j: number): boolean {
  if (j === 0 || !isAlnum(s[j - 1])) return true;
  return s[j - 1] === s[j - 1].toLowerCase() && s[j] !== s[j].toLowerCase() && /[A-Za-z]/.test(s[j]);
}

/**
 * Fuzzy-matches one lower-case token against a text.
 *
 * @remarks
 * A contiguous substring match is preferred (best at a word start, then at the very start), scored by its length and
 * tightness. Failing that, the token must appear as a subsequence; consecutive characters and word starts score more,
 * and a long gap between the first and last matched character costs a little.
 *
 * @param token - Lower-case query token.
 * @param text - The text to search, in its original case.
 * @returns The score and matched positions, or `null` when the token does not match.
 */
export function fuzzyMatch(token: string, text: string): FuzzyMatch | null {
  if (!token) return null;
  const lower = text.toLowerCase();
  const first = lower.indexOf(token);
  if (first >= 0) {
    let best = first;
    for (let j = first; j >= 0; j = lower.indexOf(token, j + 1)) {
      if (isWordStart(text, j)) {
        best = j;
        break;
      }
    }
    const score = 20 + token.length * 2 + (isWordStart(text, best) ? 8 : 0) + (best === 0 ? 6 : 0) - (text.length - token.length) * 0.1;
    return { score, positions: Array.from({ length: token.length }, (_, k) => best + k) };
  }

  const positions: number[] = [];
  let score = 0;
  let prev = -2;
  for (let j = 0, q = 0; j < lower.length && q < token.length; j++) {
    if (lower[j] !== token[q]) continue;
    positions.push(j);
    score += 1 + (j === prev + 1 ? 3 : 0) + (isWordStart(text, j) ? 4 : 0);
    prev = j;
    q++;
  }
  if (positions.length < token.length) return null;
  const spread = positions[positions.length - 1] - positions[0];
  return { score: score - (text.length - token.length) * 0.05 - spread * 0.1, positions };
}

/**
 * Ranks symbols against a whitespace-separated query.
 *
 * @remarks
 * Every token must match the symbol's name or its file path; each token takes whichever scores higher, with the name
 * weighted above the path. Matching is case-insensitive. Ties go to the shorter name, then alphabetical order, so the
 * order is stable. A blank query matches nothing.
 *
 * @param symbols - Symbol nodes to search.
 * @param query - What the user typed.
 * @returns Matches, best first.
 */
export function searchSymbols(symbols: readonly HierarchyNode[], query: string): SearchResult[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const results: SearchResult[] = [];
  for (const node of symbols) {
    let score = 0;
    const namePositions: number[] = [];
    let matched = true;
    for (const token of tokens) {
      const byName = fuzzyMatch(token, node.name);
      const byPath = fuzzyMatch(token, node.path);
      if (!byName && !byPath) {
        matched = false;
        break;
      }
      score += Math.max(byName ? byName.score * NAME_WEIGHT : -Infinity, byPath ? byPath.score * PATH_WEIGHT : -Infinity);
      if (byName) namePositions.push(...byName.positions);
    }
    if (matched) results.push({ node, score, namePositions: [...new Set(namePositions)].sort((a, b) => a - b) });
  }
  return results.sort((a, b) => b.score - a.score || a.node.name.length - b.node.name.length || a.node.name.localeCompare(b.node.name));
}

/** Splits text into runs that are, or are not, in `positions`, for highlighting the matched characters. */
export function highlightRuns(text: string, positions: readonly number[]): { text: string; match: boolean }[] {
  const set = new Set(positions);
  const runs: { text: string; match: boolean }[] = [];
  for (let j = 0; j < text.length; j++) {
    const match = set.has(j);
    const last = runs[runs.length - 1];
    if (last && last.match === match) last.text += text[j];
    else runs.push({ text: text[j], match });
  }
  return runs;
}
