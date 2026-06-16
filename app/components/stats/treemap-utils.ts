import { interpolateReds } from 'd3-scale-chromatic';
import type { AnalysisNode } from '@/lib/analysis/types';

export function filterAndSortNodes(
  nodes: AnalysisNode[],
  topN: number,
  hideTestFiles: boolean,
): AnalysisNode[] {
  let filtered = nodes.filter((n) => n.outboundRefs.length > 0);
  if (hideTestFiles) {
    filtered = filtered.filter((n) => !n.inTestFile);
  }
  filtered.sort((a, b) => b.outboundRefs.length - a.outboundRefs.length);
  return filtered.slice(0, topN);
}

export function normalizeInboundRefs(count: number, max: number): number {
  if (max === 0) return 0;
  return count / max;
}

export function getTreemapColor(normalizedValue: number): string {
  return interpolateReds(normalizedValue);
}
