/**
 * Selection format utilities — transforms selected nodes into
 * copy-pasteable text strings.
 */

import type { AnalysisNode } from '@/lib/analysis/types';

/**
 * Formats a list of nodes into a multi-line string with one
 * `filePath#name` per line, sorted by file path then name.
 * Duplicate entries are removed.
 *
 * @param nodes - The nodes to format.
 * @returns A formatted string, one entry per line.
 */
export function formatCopyText(nodes: AnalysisNode[]): string {
  if (nodes.length === 0) return '';

  const seen = new Set<string>();
  const lines: string[] = [];

  const sorted = [...nodes].sort((a, b) => {
    const fp = a.filePath.localeCompare(b.filePath);
    if (fp !== 0) return fp;
    return a.name.localeCompare(b.name);
  });

  for (const node of sorted) {
    const key = `${node.filePath}#${node.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      lines.push(key);
    }
  }

  return lines.join('\n');
}