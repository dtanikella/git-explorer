import { computeAreaHull, expandHull } from '@/lib/areas/renderer';
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
