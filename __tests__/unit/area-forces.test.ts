import {
  createClusterPullForce,
  createAreaAttractForce,
  createParentPullForce,
  createAnchorRepelForce,
  type ForceNode,
} from '@/lib/areas/forces';
import type { AreaAnchorNode } from '@/lib/areas/anchors';
import type { Area } from '@/lib/areas/types';
import * as d3 from 'd3-force';

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

    expect(node.vx).toBeGreaterThan(0);
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
    const strengthRef = { current: 1 };

    const force = createParentPullForce([parentAnchor, childAnchor], areasById, strengthRef);
    force(1);

    expect(childAnchor.vx).toBeGreaterThan(0);
    expect(parentAnchor.vx).toBe(0);
  });

  it('does nothing for an area with no parent', () => {
    const rootArea = makeArea({ id: 'core', parent: null });
    const rootAnchor = makeAnchor('core', 0, 0);
    const areasById = new Map([['core', rootArea]]);
    const strengthRef = { current: 1 };

    const force = createParentPullForce([rootAnchor], areasById, strengthRef);
    force(1);

    expect(rootAnchor.vx).toBe(0);
    expect(rootAnchor.vy).toBe(0);
  });
});

describe('createAnchorRepelForce', () => {
  it('pushes two coincident-ish sibling anchors apart symmetrically', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 10, 0);
    const areasById = new Map([
      ['auth', makeArea({ id: 'auth', parent: null })],
      ['billing', makeArea({ id: 'billing', parent: null })],
    ]);
    const hullRadiusRef = { current: new Map([['auth', 0], ['billing', 0]]) };
    const tuningRef = { current: { marginPx: 20, repelStrength: 100 } };

    const force = createAnchorRepelForce([a, b], areasById, hullRadiusRef, tuningRef);
    force(1);

    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.vx).toBeCloseTo(-b.vx!, 5);
  });

  it('skips non-sibling pairs (different parent)', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 10, 0);
    const areasById = new Map([
      ['auth', makeArea({ id: 'auth', parent: 'core' })],
      ['billing', makeArea({ id: 'billing', parent: 'payments' })],
    ]);
    const hullRadiusRef = { current: new Map([['auth', 0], ['billing', 0]]) };
    const tuningRef = { current: { marginPx: 20, repelStrength: 100 } };

    const force = createAnchorRepelForce([a, b], areasById, hullRadiusRef, tuningRef);
    force(1);

    expect(a.vx).toBe(0);
    expect(b.vx).toBe(0);
  });

  it('applies zero force when distance >= rA + rB + marginPx (above threshold)', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 200, 0);
    const areasById = new Map([
      ['auth', makeArea({ id: 'auth', parent: null })],
      ['billing', makeArea({ id: 'billing', parent: null })],
    ]);
    const hullRadiusRef = { current: new Map([['auth', 30], ['billing', 30]]) };
    const tuningRef = { current: { marginPx: 20, repelStrength: 100 } };

    const force = createAnchorRepelForce([a, b], areasById, hullRadiusRef, tuningRef);
    force(1);

    expect(a.vx).toBe(0);
    expect(a.vy).toBe(0);
    expect(b.vx).toBe(0);
    expect(b.vy).toBe(0);
  });

  it('applies nonzero force when distance < rA + rB + marginPx (below threshold)', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 60, 0);
    const areasById = new Map([
      ['auth', makeArea({ id: 'auth', parent: null })],
      ['billing', makeArea({ id: 'billing', parent: null })],
    ]);
    const hullRadiusRef = { current: new Map([['auth', 30], ['billing', 30]]) };
    const tuningRef = { current: { marginPx: 20, repelStrength: 100 } };

    const force = createAnchorRepelForce([a, b], areasById, hullRadiusRef, tuningRef);
    force(1);

    expect(a.vx).not.toBe(0);
    expect(b.vx).not.toBe(0);
  });
});

describe('createAnchorRepelForce — settle-and-check via manual tick simulation', () => {
  const EPSILON = 0.5;

  function settle(
    anchors: AreaAnchorNode[],
    areasById: Map<string, Area>,
    hullRadiusRef: { current: Map<string, number> },
    tuningRef: { current: { marginPx: number; repelStrength: number } },
    alphaDecay: number = 0.0228,
    alphaMin: number = 0.001,
  ) {
    const force = createAnchorRepelForce(anchors, areasById, hullRadiusRef, tuningRef);
    let alpha = 1.0;
    while (alpha > alphaMin) {
      for (const a of anchors) { a.vx = 0; a.vy = 0; }
      force(alpha);
      for (const a of anchors) {
        if (a.vx == null || a.vy == null) continue;
        a.x = (a.x ?? 0) + (a.vx ?? 0);
        a.y = (a.y ?? 0) + (a.vy ?? 0);
      }
      alpha *= 1 - alphaDecay;
    }
  }

  function settleAndCheck(
    anchors: AreaAnchorNode[],
    areas: Area[],
    hullRadii: [string, number][],
    marginPx: number,
    repelStrength: number,
  ) {
    const areasById = new Map(areas.map((a) => [a.id, a]));
    const hullRadiusRef = { current: new Map(hullRadii) };
    const tuningRef = { current: { marginPx, repelStrength } };

    settle(anchors, areasById, hullRadiusRef, tuningRef);

    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const a = anchors[i];
        const b = anchors[j];
        const areaA = areasById.get(a.areaId)!;
        const areaB = areasById.get(b.areaId)!;
        if (areaA.parent !== areaB.parent) continue;
        if (a.x == null || a.y == null || b.x == null || b.y == null) continue;

        const rA = hullRadiusRef.current.get(a.areaId) ?? 0;
        const rB = hullRadiusRef.current.get(b.areaId) ?? 0;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        expect(dist).toBeGreaterThanOrEqual(rA + rB + marginPx - EPSILON);
      }
    }
  }

  it('two equal-size siblings (radii 30) settle apart', () => {
    const anchors = [makeAnchor('auth', 0, 0), makeAnchor('billing', 10, 60)];
    const areas = [
      makeArea({ id: 'auth', parent: null }),
      makeArea({ id: 'billing', parent: null }),
    ];
    settleAndCheck(anchors, areas, [['auth', 30], ['billing', 30]], 10, 5000);
  });

  it('two very-different-size siblings (radii 20 and 80) settle apart', () => {
    const anchors = [makeAnchor('small', 0, 0), makeAnchor('large', 10, 60)];
    const areas = [
      makeArea({ id: 'small', parent: null }),
      makeArea({ id: 'large', parent: null }),
    ];
    settleAndCheck(anchors, areas, [['small', 20], ['large', 80]], 10, 10000);
  });

  it('three siblings sharing a parent settle apart', () => {
    const anchors = [makeAnchor('a', 0, 0), makeAnchor('b', 10, 60), makeAnchor('c', -20, 20)];
    const areas = [
      makeArea({ id: 'a', parent: 'parent' }),
      makeArea({ id: 'b', parent: 'parent' }),
      makeArea({ id: 'c', parent: 'parent' }),
    ];
    settleAndCheck(anchors, areas, [['a', 25], ['b', 25], ['c', 25]], 10, 5000);
  });

  it('top-level (parent null) siblings settle apart', () => {
    const anchors = [makeAnchor('x', 0, 0), makeAnchor('y', 10, 60)];
    const areas = [
      makeArea({ id: 'x', parent: null }),
      makeArea({ id: 'y', parent: null }),
    ];
    settleAndCheck(anchors, areas, [['x', 30], ['y', 30]], 10, 5000);
  });
});