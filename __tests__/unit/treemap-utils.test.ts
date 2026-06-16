import { filterAndSortNodes, normalizeInboundRefs, getTreemapColor } from '@/app/components/stats/treemap-utils';
import type { AnalysisNode } from '@/lib/analysis/types';
import { SyntaxType } from '@/lib/analysis/types';

function makeNode(overrides: Partial<AnalysisNode> = {}): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name: 'fn',
    filePath: 'src/a.ts',
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: 'sym-' + Math.random().toString(36).slice(2),
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
    ...overrides,
  };
}

describe('filterAndSortNodes', () => {
  it('returns top N nodes sorted by outboundRefs.length descending', () => {
    const nodes = [
      makeNode({ name: 'a', outboundRefs: [{ filePath: 'x', line: 1, col: 0, scipSymbol: 's' }], referencedAt: [{ filePath: 'x', line: 1, col: 0, scipSymbol: 's' }] }),
      makeNode({ name: 'b', outboundRefs: Array(5).fill({ filePath: 'x', line: 1, col: 0, scipSymbol: 's' }), referencedAt: [{ filePath: 'x', line: 1, col: 0, scipSymbol: 's' }] }),
      makeNode({ name: 'c', outboundRefs: Array(3).fill({ filePath: 'x', line: 1, col: 0, scipSymbol: 's' }), referencedAt: [{ filePath: 'x', line: 1, col: 0, scipSymbol: 's' }] }),
    ];
    const result = filterAndSortNodes(nodes, 2, false);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('b');
    expect(result[1].name).toBe('c');
  });

  it('filters out test files when hideTestFiles is true', () => {
    const nodes = [
      makeNode({ name: 'a', inTestFile: true, outboundRefs: Array(10).fill({ filePath: 'x', line: 1, col: 0, scipSymbol: 's' }) }),
      makeNode({ name: 'b', inTestFile: false, outboundRefs: Array(5).fill({ filePath: 'x', line: 1, col: 0, scipSymbol: 's' }) }),
    ];
    const result = filterAndSortNodes(nodes, 10, true);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('b');
  });

  it('excludes nodes with zero outboundRefs', () => {
    const nodes = [
      makeNode({ name: 'a', outboundRefs: [] }),
      makeNode({ name: 'b', outboundRefs: [{ filePath: 'x', line: 1, col: 0, scipSymbol: 's' }] }),
    ];
    const result = filterAndSortNodes(nodes, 10, false);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('b');
  });
});

describe('normalizeInboundRefs', () => {
  it('returns 0 when max is 0', () => {
    expect(normalizeInboundRefs(0, 0)).toBe(0);
  });

  it('normalizes to 0-1 range', () => {
    expect(normalizeInboundRefs(5, 10)).toBeCloseTo(0.5);
    expect(normalizeInboundRefs(10, 10)).toBeCloseTo(1);
    expect(normalizeInboundRefs(0, 10)).toBeCloseTo(0);
  });
});

describe('getTreemapColor', () => {
  it('returns a color string for normalized value', () => {
    const color = getTreemapColor(0.5);
    expect(typeof color).toBe('string');
    expect(color).toMatch(/^rgb/);
  });

  it('returns white-ish for 0', () => {
    const color = getTreemapColor(0);
    expect(color).toBeDefined();
  });
});
