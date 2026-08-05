import { buildAreaAnchors } from '@/lib/areas/anchors';
import type { Area } from '@/lib/areas/types';

function makeArea(overrides: Partial<Area>): Area {
  return {
    id: 'a',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'A',
    type: 'business_domain',
    contains: [],
    parent: null,
    children: [],
    clusterStrength: 0.5,
    ...overrides,
  };
}

describe('buildAreaAnchors', () => {
  it('creates a fresh anchor for a new area with no x/y set', () => {
    const areas = [makeArea({ id: 'auth' })];
    const anchors = buildAreaAnchors(areas, new Map());

    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toMatchObject({ kind: 'anchor', areaId: 'auth', id: 'area-anchor:auth' });
    expect(anchors[0].x).toBeUndefined();
    expect(anchors[0].y).toBeUndefined();
  });

  it('reuses the same anchor object (preserving position) for an area seen before', () => {
    const areas = [makeArea({ id: 'auth' })];
    const previousAnchor = { kind: 'anchor' as const, id: 'area-anchor:auth', areaId: 'auth', x: 42, y: 99, vx: 1, vy: 2 };
    const previous = new Map([['auth', previousAnchor]]);

    const anchors = buildAreaAnchors(areas, previous);

    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toBe(previousAnchor);
    expect(anchors[0].x).toBe(42);
    expect(anchors[0].y).toBe(99);
  });

  it('drops anchors for areas that no longer exist', () => {
    const previous = new Map([
      ['auth', { kind: 'anchor' as const, id: 'area-anchor:auth', areaId: 'auth', x: 1, y: 1 }],
      ['billing', { kind: 'anchor' as const, id: 'area-anchor:billing', areaId: 'billing', x: 2, y: 2 }],
    ]);
    const areas = [makeArea({ id: 'auth' })];

    const anchors = buildAreaAnchors(areas, previous);

    expect(anchors).toHaveLength(1);
    expect(anchors[0].areaId).toBe('auth');
  });

  it('returns an empty array for no areas', () => {
    expect(buildAreaAnchors([], new Map())).toEqual([]);
  });
});
