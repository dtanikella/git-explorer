import {
  computeAnchorRepel,
  createComputedAnchorRepelForce,
  createEmbeddednessClusterPullForce,
  createNullModelAreaAttractForce,
  createHierarchyParentPullForce,
} from '@/lib/analysis/forces/areaForces';
import type { ForceNode } from '@/lib/areas/forces';
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

describe('computeAnchorRepel', () => {
  it('scales inversely with numCommunities (canvasArea / numCommunities)', () => {
    const canvasArea = 800 * 600;
    expect(computeAnchorRepel(canvasArea, 4)).toBe(canvasArea / 4);
    expect(computeAnchorRepel(canvasArea, 8)).toBe(canvasArea / 8);
    expect(computeAnchorRepel(canvasArea, 4)).toBeCloseTo(
      2 * computeAnchorRepel(canvasArea, 8),
      6,
    );
  });

  it('scales linearly with canvasArea', () => {
    expect(computeAnchorRepel(1000, 2)).toBeCloseTo(2 * computeAnchorRepel(500, 2), 6);
  });

  it('returns 0 for the degenerate zero-community case instead of dividing by zero', () => {
    expect(computeAnchorRepel(480000, 0)).toBe(0);
    expect(Number.isFinite(computeAnchorRepel(480000, 0))).toBe(true);
  });

  it('wires the computed strength into the force factory', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 10, 0);
    const force = createComputedAnchorRepelForce([a, b], 800 * 600, 2);
    force(1);
    expect(a.vx).toBeLessThan(0); // pushed apart
    expect(b.vx).toBeGreaterThan(0);
    expect(a.vx).toBeCloseTo(-b.vx!, 5);
  });
});

describe('createEmbeddednessClusterPullForce', () => {
  it('pulls a high-embeddedness node harder than a bridge node with the same anchors', () => {
    const area = makeArea({ id: 'auth' });
    const nodeToAreas = new Map<string, Area[]>([
      ['sym-core', [area]],
      ['sym-bridge', [area]],
    ]);
    const anchor = makeAnchor('auth', 100, 0);
    const anchorsById = new Map([['auth', anchor]]);

    const core: ForceNode = { id: 'sym-core', x: 0, y: 0, vx: 0, vy: 0 };
    const bridge: ForceNode = { id: 'sym-bridge', x: 0, y: 0, vx: 0, vy: 0 };
    const embeddedness = new Map([
      ['sym-core', 1],
      ['sym-bridge', 0.1],
    ]);

    const force = createEmbeddednessClusterPullForce(
      [core, bridge],
      nodeToAreas,
      anchorsById,
      embeddedness,
      1,
    );
    force(1);

    // Both move toward +x, but the embedded node gets the full-strength pull.
    expect(core.vx).toBeGreaterThan(0);
    expect(bridge.vx).toBeGreaterThan(0);
    expect(core.vx).toBeGreaterThan(bridge.vx);
  });

  it('leaves nodes with no areas untouched', () => {
    const node: ForceNode = { id: 'sym-orphan', x: 0, y: 0, vx: 0, vy: 0 };
    const force = createEmbeddednessClusterPullForce([node], new Map(), new Map(), new Map(), 1);
    force(1);
    expect(node.vx).toBe(0);
    expect(node.vy).toBe(0);
  });

  it('leaves degree-0 (embeddedness 0) nodes untouched', () => {
    const area = makeArea({ id: 'auth' });
    const node: ForceNode = { id: 'sym-iso', x: 0, y: 0, vx: 0, vy: 0 };
    const nodeToAreas = new Map([['sym-iso', [area]]]);
    const anchor = makeAnchor('auth', 100, 0);
    const force = createEmbeddednessClusterPullForce(
      [node],
      nodeToAreas,
      new Map([['auth', anchor]]),
      new Map([['sym-iso', 0]]),
      1,
    );
    force(1);
    expect(node.vx).toBe(0);
    expect(node.vy).toBe(0);
  });
});

describe('createNullModelAreaAttractForce', () => {
  it('pulls two weighted anchors toward each other symmetrically (null-model weights)', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 100, 0);
    const crossWeights = new Map([['auth|billing', 2.5]]); // null-model-normalized weight

    const force = createNullModelAreaAttractForce([a, b], crossWeights, 1);
    force(1);

    expect(a.vx).toBeGreaterThan(0);
    expect(b.vx).toBeLessThan(0);
    expect(a.vx).toBeCloseTo(-b.vx!, 5);
  });

  it('does nothing for pairs with no weight entry (including negative-weight pairs kept out)', () => {
    const a = makeAnchor('auth', 0, 0);
    const b = makeAnchor('billing', 100, 0);
    const force = createNullModelAreaAttractForce([a, b], new Map(), 1);
    force(1);
    expect(a.vx).toBe(0);
    expect(b.vx).toBe(0);
  });
});

describe('createHierarchyParentPullForce', () => {
  it('pulls a child anchor toward its parent anchor per the hierarchy parentOf map', () => {
    const parentAnchor = makeAnchor('core', 100, 0);
    const childAnchor = makeAnchor('auth', 0, 0);
    const parentOf = new Map([
      ['auth', 'core'],
      ['core', null],
    ]);

    const force = createHierarchyParentPullForce([parentAnchor, childAnchor], parentOf, 1);
    force(1);

    expect(childAnchor.vx).toBeGreaterThan(0);
    expect(parentAnchor.vx).toBe(0);
  });

  it('does nothing for anchors without a parent in the map', () => {
    const rootAnchor = makeAnchor('core', 0, 0);
    const force = createHierarchyParentPullForce([rootAnchor], new Map([['core', null]]), 1);
    force(1);
    expect(rootAnchor.vx).toBe(0);
    expect(rootAnchor.vy).toBe(0);
  });

  it('does nothing when the parent anchor is missing', () => {
    const childAnchor = makeAnchor('auth', 0, 0);
    const force = createHierarchyParentPullForce(
      [childAnchor],
      new Map([['auth', 'missing-parent']]),
      1,
    );
    force(1);
    expect(childAnchor.vx).toBe(0);
  });
});