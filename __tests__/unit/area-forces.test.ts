import {
  createClusterPullForce,
  createAreaAttractForce,
  createParentPullForce,
  createAnchorRepelForce,
  createAreaPinForce,
  zoneCentroid,
  type ForceNode,
} from '@/lib/areas/forces';
import type { AreaAnchorNode } from '@/lib/areas/anchors';
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
    clusterStrength: 1,
    ...overrides,
  };
}

function makeAnchor(areaId: string, x?: number, y?: number): AreaAnchorNode {
  return { kind: 'anchor', id: `area-anchor:${areaId}`, areaId, x, y, vx: 0, vy: 0 };
}

describe('createClusterPullForce', () => {
  it('pulls a single-area node toward its area anchor', () => {
    const auth = makeArea({ id: 'auth', clusterStrength: 1 });
    const node: ForceNode = { id: 'sym-login', x: 0, y: 0, vx: 0, vy: 0 };
    const anchor = makeAnchor('auth', 100, 0);
    const nodeToAreas = new Map([['sym-login', [auth]]]);
    const anchorsById = new Map([['auth', anchor]]);

    const force = createClusterPullForce([node], nodeToAreas, anchorsById, 1);
    force(1);

    expect(node.vx).toBeGreaterThan(0); // pulled toward anchor at x=100
    expect(node.vy).toBe(0);
  });

  it('leaves a node with no areas untouched', () => {
    const node: ForceNode = { id: 'sym-orphan', x: 0, y: 0, vx: 0, vy: 0 };
    const force = createClusterPullForce([node], new Map(), new Map(), 1);
    force(1);
    expect(node.vx).toBe(0);
    expect(node.vy).toBe(0);
  });

  it('pulls a multi-area node toward the clusterStrength-weighted average of its anchors', () => {
    const heavy = makeArea({ id: 'heavy', clusterStrength: 3 });
    const light = makeArea({ id: 'light', clusterStrength: 1 });
    const node: ForceNode = { id: 'sym-shared', x: 0, y: 0, vx: 0, vy: 0 };
    const nodeToAreas = new Map([['sym-shared', [heavy, light]]]);
    const anchorsById = new Map([
      ['heavy', makeAnchor('heavy', 100, 0)],
      ['light', makeAnchor('light', -100, 0)],
    ]);

    const force = createClusterPullForce([node], nodeToAreas, anchorsById, 1);
    force(1);

    // weighted average target = (100*3 + -100*1) / 4 = 50 -> node should move toward +x
    expect(node.vx).toBeGreaterThan(0);
  });
});

describe('createAreaAttractForce', () => {
  it('pulls two weighted anchors toward each other symmetrically', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 100, 0);
    const weights = new Map([['auth|billing', 5]]);

    const force = createAreaAttractForce([a, b], weights, 1);
    force(1);

    expect(a.vx).toBeGreaterThan(0);
    expect(b.vx).toBeLessThan(0);
    expect(a.vx).toBeCloseTo(-b.vx!, 5);
  });

  it('does nothing for area pairs with no weight entry', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 100, 0);
    const force = createAreaAttractForce([a, b], new Map(), 1);
    force(1);
    expect(a.vx).toBe(0);
    expect(b.vx).toBe(0);
  });
});

describe('createParentPullForce', () => {
  it('pulls a child anchor toward its parent anchor', () => {
    const parentArea = makeArea({ id: 'core', parent: null });
    const childArea = makeArea({ id: 'auth', parent: 'core' });
    const parentAnchor = makeAnchor('core', 100, 0);
    const childAnchor = makeAnchor('auth', 0, 0);
    const areasById = new Map([['core', parentArea], ['auth', childArea]]);

    const force = createParentPullForce([parentAnchor, childAnchor], areasById, 1);
    force(1);

    expect(childAnchor.vx).toBeGreaterThan(0);
    expect(parentAnchor.vx).toBe(0);
  });

  it('does nothing for an area with no parent', () => {
    const rootArea = makeArea({ id: 'core', parent: null });
    const rootAnchor = makeAnchor('core', 0, 0);
    const areasById = new Map([['core', rootArea]]);

    const force = createParentPullForce([rootAnchor], areasById, 1);
    force(1);

    expect(rootAnchor.vx).toBe(0);
    expect(rootAnchor.vy).toBe(0);
  });
});

describe('createAnchorRepelForce', () => {
  it('pushes two coincident-ish anchors apart symmetrically', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 10, 0);

    const force = createAnchorRepelForce([a, b], 100);
    force(1);

    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.vx).toBeCloseTo(-b.vx!, 5);
  });
});

describe('zoneCentroid', () => {
  it('returns exact center for single cell index 4', () => {
    const c = zoneCentroid([4], 600, 400);
    expect(c).toEqual({ x: 300, y: 200 });
  });

  it('averages multiple cells (bottom row)', () => {
    const c = zoneCentroid([6, 7, 8], 600, 600);
    expect(c).toEqual({ x: 300, y: 500 });
  });

  it('returns null for empty array', () => {
    expect(zoneCentroid([], 600, 400)).toBeNull();
  });
});

describe('createAreaPinForce', () => {
  it('pulls a pinned anchor toward the zone centroid', () => {
    const area = makeArea({ id: 'auth', pinnedZones: [4] });
    const anchor = makeAnchor('auth', 0, 0);
    const areasById = new Map([['auth', area]]);

    const force = createAreaPinForce([anchor], areasById, 600, 400, 1);
    force(1);

    // Zone 4 centroid at (300, 200) => vx and vy should increase
    expect(anchor.vx).toBeGreaterThan(0);
    expect(anchor.vy).toBeGreaterThan(0);
    // Exact: (300-0) * 1 * 1 = 300, (200-0) * 1 * 1 = 200
    expect(anchor.vx).toBeCloseTo(300, 5);
    expect(anchor.vy).toBeCloseTo(200, 5);
  });

  it('does nothing for an anchor whose area has pinnedZones: []', () => {
    const area = makeArea({ id: 'auth', pinnedZones: [] });
    const anchor = makeAnchor('auth', 0, 0);
    const areasById = new Map([['auth', area]]);

    const force = createAreaPinForce([anchor], areasById, 600, 400, 1);
    force(1);

    expect(anchor.vx).toBe(0);
    expect(anchor.vy).toBe(0);
  });

  it('does nothing for an area without pinnedZones field', () => {
    const area = makeArea({ id: 'auth' }); // no pinnedZones
    const anchor = makeAnchor('auth', 0, 0);
    const areasById = new Map([['auth', area]]);

    const force = createAreaPinForce([anchor], areasById, 600, 400, 1);
    force(1);

    expect(anchor.vx).toBe(0);
    expect(anchor.vy).toBe(0);
  });
});

describe('simulation integration', () => {
  it('all five area forces can be called sequentially without throwing (pinned parent + unpinned child)', () => {
    const childArea = makeArea({ id: 'child', parent: 'parent' });
    const parentArea = makeArea({ id: 'parent', pinnedZones: [0, 1, 2] }); // top row

    const childAnchor = makeAnchor('child', 10, 10);
    const parentAnchor = makeAnchor('parent', 100, 100);
    const anchors = [childAnchor, parentAnchor];

    const areasById = new Map([
      ['child', childArea],
      ['parent', parentArea],
    ]);

    const forces = [
      createAnchorRepelForce(anchors, 4000),
      createAreaAttractForce(anchors, new Map(), 0.15),
      createParentPullForce(anchors, areasById, 0.5),
      createAreaPinForce(anchors, areasById, 800, 600, 0.7),
    ];

    // Simulate 50 ticks by calling each force in sequence
    for (let tick = 1; tick <= 50; tick++) {
      const alpha = 0.1 * (1 - tick / 50); // decaying alpha
      for (const force of forces) {
        force(alpha);
      }
    }

    // Pinned parent anchor should have nonzero velocity from areaPin
    expect(parentAnchor.vx).not.toBe(0);
    expect(parentAnchor.vy).not.toBe(0);

    // Child anchor (unpinned) should have nonzero velocity from parentPull
    expect(childAnchor.vx).not.toBe(0);
    expect(childAnchor.vy).not.toBe(0);
  });
});
