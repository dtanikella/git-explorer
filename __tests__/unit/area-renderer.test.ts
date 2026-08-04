import { computeAreaHull, expandHull, getTransitiveContains } from '@/lib/areas/renderer';
import type { Area } from '@/lib/areas/types';

const area: Area = {
  id: 'auth',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  name: 'Auth',
  type: 'business_domain',
  contains: ['a', 'b', 'c', 'd'],
  parent: null,
  children: [],
  clusterStrength: 0,
};

describe('computeAreaHull', () => {
  it('returns null for 0 positioned members', () => {
    const positions = new Map<string, { x: number; y: number; radius: number }>();
    expect(computeAreaHull(area, positions)).toBeNull();
  });

  it('returns a circle descriptor for 1 positioned member', () => {
    const positions = new Map([['a', { x: 10, y: 20, radius: 5 }]]);
    const result = computeAreaHull(area, positions);
    expect(result).toEqual({ type: 'circle', cx: 10, cy: 20, r: expect.any(Number) });
  });

  it('returns a polygon for 3+ positioned members', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0, radius: 5 }],
      ['b', { x: 100, y: 0, radius: 5 }],
      ['c', { x: 50, y: 80, radius: 5 }],
    ]);
    const result = computeAreaHull(area, positions);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('polygon');
    if (result!.type === 'polygon') {
      expect(result!.points.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('expandHull', () => {
  it('expands a triangle outward by padding amount', () => {
    const triangle: [number, number][] = [
      [0, 0],
      [100, 0],
      [50, 80],
    ];
    const expanded = expandHull(triangle, 10);
    // Each expanded point should be further from centroid than the original
    const cx = 50, cy = 80 / 3;
    for (let i = 0; i < triangle.length; i++) {
      const origDist = Math.hypot(triangle[i][0] - cx, triangle[i][1] - cy);
      const expDist = Math.hypot(expanded[i][0] - cx, expanded[i][1] - cy);
      expect(expDist).toBeGreaterThan(origDist);
    }
  });
});

describe('getTransitiveContains', () => {
  const parent: Area = { ...area, id: 'core', contains: ['p1'], children: ['child'] };
  const child: Area = { ...area, id: 'child', contains: ['c1'], parent: 'core', children: [] };

  it('includes the area\'s own members plus descendants\' members', () => {
    const areasById = new Map([['core', parent], ['child', child]]);
    const result = getTransitiveContains(parent, areasById);
    expect(result.sort()).toEqual(['c1', 'p1']);
  });

  it('returns just its own members when it has no children', () => {
    const areasById = new Map([['child', child]]);
    expect(getTransitiveContains(child, areasById)).toEqual(['c1']);
  });

  it('does not infinite-loop on a self-referencing children cycle', () => {
    const cyclic: Area = { ...area, id: 'x', contains: ['x1'], children: ['x'] };
    const areasById = new Map([['x', cyclic]]);
    expect(getTransitiveContains(cyclic, areasById)).toEqual(['x1']);
  });

  it('recurses through grandchildren', () => {
    const grandchild: Area = { ...area, id: 'grandchild', contains: ['g1'], parent: 'child', children: [] };
    const childWithKid: Area = { ...child, children: ['grandchild'] };
    const areasById = new Map([
      ['core', parent],
      ['child', childWithKid],
      ['grandchild', grandchild],
    ]);
    const result = getTransitiveContains(parent, areasById);
    expect(result.sort()).toEqual(['c1', 'g1', 'p1']);
  });
});

describe('computeAreaHull with areasById (containment)', () => {
  it('includes descendant member positions in the parent hull', () => {
    const parentArea: Area = { ...area, id: 'core', contains: ['p1'], children: ['child'] };
    const childArea: Area = { ...area, id: 'child', contains: ['c1'], parent: 'core', children: [] };
    const areasById = new Map([['core', parentArea], ['child', childArea]]);
    const positions = new Map([
      ['p1', { x: 0, y: 0, radius: 5 }],
      ['c1', { x: 200, y: 200, radius: 5 }],
    ]);

    const withoutChildren = computeAreaHull(parentArea, positions);
    const withChildren = computeAreaHull(parentArea, positions, areasById);

    // Without transitive lookup, only p1 is a member -> circle around p1 alone.
    expect(withoutChildren).toEqual({ type: 'circle', cx: 0, cy: 0, r: expect.any(Number) });
    // With transitive lookup, both members are included -> circle spans p1 and c1.
    expect(withChildren).not.toEqual(withoutChildren);
  });
});
