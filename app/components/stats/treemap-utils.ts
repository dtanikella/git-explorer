import { interpolateReds } from 'd3-scale-chromatic';
import type { AnalysisNode } from '@/lib/analysis/types';

/**
 * Filters, sorts, and limits analysis nodes for treemap display.
 *
 * @remarks
 * Removes nodes with zero references, optionally filters out test files,
 * sorts by descending reference count, and returns the top N nodes.
 *
 * @param nodes - All analysis nodes to process.
 * @param topN - Maximum number of nodes to return.
 * @param hideTestFiles - When true, excludes nodes whose file is in a test directory.
 * @returns At most `topN` nodes sorted by reference count descending.
 * @see commit b2a8402
 */
export function filterAndSortNodes(
  nodes: AnalysisNode[],
  topN: number,
  hideTestFiles: boolean,
): AnalysisNode[] {
  let filtered = nodes.filter((n) => n.referencedAt.length > 0);
  if (hideTestFiles) {
    filtered = filtered.filter((n) => !n.inTestFile);
  }
  filtered.sort((a, b) => b.referencedAt.length - a.referencedAt.length);
  return filtered.slice(0, topN);
}

/**
 * Normalizes a count against a maximum value to produce a 0-1 ratio.
 *
 * @remarks
 * Used to map a node's reference count to a color intensity. Returns 0 when
 * max is 0 (no references).
 *
 * @param count - The raw count to normalize.
 * @param max - The maximum count in the dataset.
 * @returns A value between 0 and 1 inclusive.
 * @see commit b2a8402
 */
export function normalizeOutboundRefs(count: number, max: number): number {
  if (max === 0) return 0;
  return count / max;
}

/**
 * Maps a 0-1 normalized value to a red color using d3's interpolateReds.
 *
 * @remarks
 * Returns a CSS-compatible color string. The darkest red corresponds to
 * the highest reference density.
 *
 * @param normalizedValue - A 0-1 value typically from {@link normalizeOutboundRefs}.
 * @returns A color string like `"rgb(255, 245, 240)"` (light) to `"rgb(203, 24, 29)"` (dark).
 * @see commit b2a8402
 */
export function getTreemapColor(normalizedValue: number): string {
  return interpolateReds(normalizedValue);
}
