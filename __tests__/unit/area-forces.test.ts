import {
  createClusterPullForce,
  createAreaAttractForce,
  createParentPullForce,
  createAnchorRepelForce,
  type ForceNode,
} from '@/lib/areas/forces';
import type { AreaAnchorNode } from '@/lib/areas/anchors';
import type { Area } from '@/lib/areas/types';

// jest.setup.js mocks `d3-force` and `d3` globally (and their ESM sources aren't transformed),
// so the settle tests load the real force simulation from d3's self-contained UMD bundle.
const d3: typeof import('d3-force') = jest.requireActual('../../node_modules/d3/dist/d3.js');

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

    const force = createParentPullForce([parentAnchor, childAnchor], areasById, { current: 1 });
    force(1);

    expect(childAnchor.vx).toBeGreaterThan(0);
    expect(parentAnchor.vx).toBe(0);
  });

  it('does nothing for an area with no parent', () => {
    const rootArea = makeArea({ id: 'core', parent: null });
    const rootAnchor = makeAnchor('core', 0, 0);
    const areasById = new Map([['core', rootArea]]);

    const force = createParentPullForce([rootAnchor], areasById, { current: 1 });
    force(1);

    expect(rootAnchor.vx).toBe(0);
    expect(rootAnchor.vy).toBe(0);
  });
});

describe('createAnchorRepelForce', () => {
  const EPSILON = 1e-6;

  function siblingSetup(ids: string[], parent: string | null = null) {
    const areas = ids.map((id) => makeArea({ id, parent }));
    return new Map(areas.map((a) => [a.id, a]));
  }

  it('pushes two sibling anchors apart symmetrically when inside the threshold', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 10, 0);
    const areasById = siblingSetup(['auth', 'billing']);
    const radii = { current: new Map([['auth', 30], ['billing', 30]]) };

    createAnchorRepelForce([a, b], areasById, radii, { current: { marginPx: 20, repelStrength: 100 } })(1);

    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.vx).toBeCloseTo(-b.vx!, 5);
  });

  it('applies zero force once dist >= rA + rB + marginPx', () => {
    // threshold = 30 + 30 + 20 = 80; place anchors exactly at the threshold
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 80, 0);
    const areasById = siblingSetup(['auth', 'billing']);
    const radii = { current: new Map([['auth', 30], ['billing', 30]]) };

    createAnchorRepelForce([a, b], areasById, radii, { current: { marginPx: 20, repelStrength: 100 } })(1);

    expect(a.vx).toBe(0);
    expect(a.vy).toBe(0);
    expect(b.vx).toBe(0);
    expect(b.vy).toBe(0);
  });

  it('applies force just inside the threshold', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 79, 0);
    const areasById = siblingSetup(['auth', 'billing']);
    const radii = { current: new Map([['auth', 30], ['billing', 30]]) };

    createAnchorRepelForce([a, b], areasById, radii, { current: { marginPx: 20, repelStrength: 100 } })(1);

    expect(a.vx).not.toBe(0);
  });

  it('does not repel anchors with different parents', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 10, 0);
    const areasById = new Map([
      ['auth', makeArea({ id: 'auth', parent: 'core' })],
      ['billing', makeArea({ id: 'billing', parent: 'other' })],
    ]);
    const radii = { current: new Map([['auth', 30], ['billing', 30]]) };

    createAnchorRepelForce([a, b], areasById, radii, { current: { marginPx: 20, repelStrength: 100 } })(1);

    expect(a.vx).toBe(0);
    expect(b.vx).toBe(0);
  });

  it('does not repel a parent from its own child', () => {
    const a = makeAnchor('core', 0, 0);
    const b = makeAnchor('auth', 10, 0);
    const areasById = new Map([
      ['core', makeArea({ id: 'core', parent: null })],
      ['auth', makeArea({ id: 'auth', parent: 'core' })],
    ]);
    const radii = { current: new Map([['core', 60], ['auth', 30]]) };

    createAnchorRepelForce([a, b], areasById, radii, { current: { marginPx: 20, repelStrength: 100 } })(1);

    expect(a.vx).toBe(0);
    expect(b.vx).toBe(0);
  });

  it('treats an area with no hull radius as radius 0 rather than skipping the pair', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 10, 0);
    const areasById = siblingSetup(['auth', 'billing']);

    createAnchorRepelForce([a, b], areasById, { current: new Map() }, { current: { marginPx: 20, repelStrength: 100 } })(1);

    expect(a.vx).toBeLessThan(0);
  });

  it('reads tuning values fresh on every call', () => {
    const areasById = siblingSetup(['auth', 'billing']);
    const radii = { current: new Map([['auth', 30], ['billing', 30]]) };
    const tuning = { current: { marginPx: 0, repelStrength: 100 } };
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 70, 0);
    const force = createAnchorRepelForce([a, b], areasById, radii, tuning);

    force(1);
    expect(a.vx).toBe(0); // 70 >= 30 + 30 + 0

    tuning.current = { marginPx: 20, repelStrength: 100 };
    force(1);
    expect(a.vx).toBeLessThan(0); // 70 < 30 + 30 + 20
  });

  describe('settled simulation separates sibling anchors', () => {
    const MARGIN = 20;
    const STRENGTH = 4000;

    function settle(anchors: AreaAnchorNode[], areasById: Map<string, Area>, radii: Map<string, number>) {
      const tuning = { current: { marginPx: MARGIN, repelStrength: STRENGTH } };
      const sim = d3
        .forceSimulation(anchors as any[])
        .force('anchorRepel', createAnchorRepelForce(anchors, areasById, { current: radii }, tuning))
        .stop();
      while (sim.alpha() > sim.alphaMin()) sim.tick();
    }

    function expectSiblingsSeparated(
      anchors: AreaAnchorNode[],
      areasById: Map<string, Area>,
      radii: Map<string, number>,
    ) {
      for (let i = 0; i < anchors.length; i++) {
        for (let j = i + 1; j < anchors.length; j++) {
          const a = anchors[i];
          const b = anchors[j];
          if (areasById.get(a.areaId)!.parent !== areasById.get(b.areaId)!.parent) continue;
          const dist = Math.hypot(a.x! - b.x!, a.y! - b.y!);
          const threshold = radii.get(a.areaId)! + radii.get(b.areaId)! + MARGIN;
          expect(dist).toBeGreaterThanOrEqual(threshold - EPSILON);
        }
      }
    }

    it('two equal-size siblings', () => {
      const areasById = siblingSetup(['a', 'b'], 'core');
      const radii = new Map([['a', 50], ['b', 50]]);
      const anchors = [makeAnchor('a', 0, 0), makeAnchor('b', 10, 5)];
      settle(anchors, areasById, radii);
      expectSiblingsSeparated(anchors, areasById, radii);
    });

    it('two very-different-size siblings', () => {
      const areasById = siblingSetup(['small', 'big'], 'core');
      const radii = new Map([['small', 20], ['big', 80]]);
      const anchors = [makeAnchor('small', 0, 0), makeAnchor('big', 10, 5)];
      settle(anchors, areasById, radii);
      expectSiblingsSeparated(anchors, areasById, radii);
    });

    it('3+ siblings sharing a parent', () => {
      const areasById = siblingSetup(['a', 'b', 'c', 'd'], 'core');
      const radii = new Map([['a', 40], ['b', 60], ['c', 30], ['d', 50]]);
      const anchors = [
        makeAnchor('a', 0, 0),
        makeAnchor('b', 10, 5),
        makeAnchor('c', -5, 12),
        makeAnchor('d', 4, -9),
      ];
      settle(anchors, areasById, radii);
      expectSiblingsSeparated(anchors, areasById, radii);
    });

    it('a top-level group where every parent is null', () => {
      const areasById = siblingSetup(['a', 'b', 'c'], null);
      const radii = new Map([['a', 45], ['b', 45], ['c', 70]]);
      const anchors = [makeAnchor('a', 0, 0), makeAnchor('b', 8, 3), makeAnchor('c', -6, 10)];
      settle(anchors, areasById, radii);
      expectSiblingsSeparated(anchors, areasById, radii);
    });
  });
});
