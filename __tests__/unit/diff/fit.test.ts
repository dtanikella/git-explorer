import { fitToChanges } from '@/lib/diff/fit';
import type { GitAnalysisNode } from '@/lib/diff/types';
import type { Area } from '@/lib/areas/types';
import { SyntaxType } from '@/lib/analysis/types';

function makeNode(id: string, diffStatus: string, x: number, y: number, radius = 6): GitAnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name: id,
    filePath: 'test.ts',
    startLine: 0,
    startCol: 0,
    isAsync: false,
    isExported: false,
    params: [],
    returnTypeText: null,
    scipSymbol: id,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
    diffStatus: diffStatus as any,
  };
}

describe('fitToChanges', () => {
  const viewportW = 1024;
  const viewportH = 456;

  it('returns null when no nodes have changed', () => {
    const nodes = [makeNode('a', 'unchanged', 100, 100)];
    const positions = new Map([['a', { x: 100, y: 100, radius: 6 }]]);
    const result = fitToChanges(nodes, [], positions, viewportW, viewportH);
    expect(result).toBeNull();
  });

  it('returns a transform for one changed node', () => {
    const nodes = [makeNode('a', 'added', 200, 300)];
    const positions = new Map([['a', { x: 200, y: 300, radius: 8 }]]);
    const result = fitToChanges(nodes, [], positions, viewportW, viewportH);
    expect(result).not.toBeNull();
    const [tx, ty, scale] = result!;
    expect(tx).toBeDefined();
    expect(ty).toBeDefined();
    expect(scale).toBeGreaterThan(0);
  });

  it('fits multiple changed nodes', () => {
    const nodes = [
      makeNode('a', 'added', 0, 0),
      makeNode('b', 'modified', 400, 300),
      makeNode('c', 'deleted', 100, 200),
    ];
    const positions = new Map([
      ['a', { x: 0, y: 0, radius: 8 }],
      ['b', { x: 400, y: 300, radius: 8 }],
      ['c', { x: 100, y: 200, radius: 8 }],
    ]);
    const result = fitToChanges(nodes, [], positions, viewportW, viewportH);
    expect(result).not.toBeNull();
  });

  it('includes touched area hull in the bounding box', () => {
    const nodes = [makeNode('a', 'added', 100, 100)];
    const area: Area = {
      id: 'area1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      name: 'Test',
      type: 'business_domain',
      contains: ['a'],
      parent: null,
      children: [],
      clusterStrength: 0.5,
    };
    const positions = new Map([['a', { x: 100, y: 100, radius: 8 }]]);

    const withArea = fitToChanges(nodes, [area], positions, viewportW, viewportH);
    const withoutArea = fitToChanges(nodes, [], positions, viewportW, viewportH);

    expect(withArea).not.toBeNull();
    expect(withoutArea).not.toBeNull();
    // With area the scale should be smaller (zoom out) because bbox is larger
    // Only check when both are non-null
    if (withArea && withoutArea) {
      expect(withArea[2]).toBeLessThan(withoutArea[2]);
    }
  });

  it('handles wide bounding box', () => {
    const nodes = [
      makeNode('a', 'added', -500, 0),
      makeNode('b', 'added', 500, 0),
    ];
    const positions = new Map([
      ['a', { x: -500, y: 0, radius: 8 }],
      ['b', { x: 500, y: 0, radius: 8 }],
    ]);
    const result = fitToChanges(nodes, [], positions, viewportW, viewportH);
    expect(result).not.toBeNull();
    if (result) {
      // The scale should be constrained by the wide dimension
      expect(result[2]).toBeLessThan(2);
    }
  });

  it('handles tall bounding box', () => {
    const nodes = [
      makeNode('a', 'added', 0, -300),
      makeNode('b', 'added', 0, 300),
    ];
    const positions = new Map([
      ['a', { x: 0, y: -300, radius: 8 }],
      ['b', { x: 0, y: 300, radius: 8 }],
    ]);
    const result = fitToChanges(nodes, [], positions, viewportW, viewportH);
    expect(result).not.toBeNull();
    if (result) {
      // The scale should be constrained by the tall dimension
      expect(result[2]).toBeLessThan(2);
    }
  });

  it('ignores unchanged nodes', () => {
    const nodes = [
      makeNode('a', 'unchanged', 0, 0),
      makeNode('b', 'unchanged', 500, 500),
    ];
    const positions = new Map([
      ['a', { x: 0, y: 0, radius: 6 }],
      ['b', { x: 500, y: 500, radius: 6 }],
    ]);
    const result = fitToChanges(nodes, [], positions, viewportW, viewportH);
    expect(result).toBeNull();
  });
});