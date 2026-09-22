import {
  createClusterPullForce,
  createAreaAttractForce,
  createParentPullForce,
  createAnchorRepelForce,
  createAreaPinForce,
  createCrossAreaPullForce,
  createAreaHullCollisionForce,
  areAreasRelated,
  computeAreaRadii,
  resolveAreaRegion,
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

    const force = createAnchorRepelForce([a, b], [], new Map(), new Map(), 100);
    force(1);

    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.vx).toBeCloseTo(-b.vx!, 5);
  });

  it('pushes harder, at the same raw anchor distance, when the areas are bigger', () => {
    const authArea = makeArea({ id: 'auth' });
    const billingArea = makeArea({ id: 'billing' });
    const areasById = new Map([
      ['auth', authArea],
      ['billing', billingArea],
    ]);

    const runWithMembers = (memberOffsets: number[]) => {
      const a = makeAnchor('auth', 0, 0);
      const b = makeAnchor('billing', 100, 0);
      const nodes: ForceNode[] = memberOffsets.map((offset, i) => ({
        id: `auth-member-${i}`,
        x: offset,
        y: 0,
      }));
      const nodeToAreas = new Map(nodes.map((n) => [n.id, [authArea]]));
      const force = createAnchorRepelForce([a, b], nodes, nodeToAreas, areasById, 100);
      force(1);
      return Math.abs(a.vx!);
    };

    const smallAreaPush = runWithMembers([1]); // tiny footprint
    const bigAreaPush = runWithMembers([40]); // big footprint, same anchor distance

    expect(bigAreaPush).toBeGreaterThan(smallAreaPush);
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

describe('resolveAreaRegion', () => {
  it('gives a top-level area the full canvas', () => {
    const area = makeArea({ id: 'top', parent: null });
    const region = resolveAreaRegion(area, new Map([['top', area]]), 900, 300);
    expect(region).toEqual({ x: 0, y: 0, width: 900, height: 300 });
  });

  it("nests a child's region inside its pinned parent's selected cell", () => {
    const parent = makeArea({ id: 'parent', pinnedZones: [0] }); // top-left cell
    const child = makeArea({ id: 'child', parent: 'parent' });
    const areasById = new Map([
      ['parent', parent],
      ['child', child],
    ]);
    const region = resolveAreaRegion(child, areasById, 900, 300);
    expect(region).toEqual({ x: 0, y: 0, width: 300, height: 100 });
  });

  it('passes the region through unchanged when the parent has no pin of its own', () => {
    const parent = makeArea({ id: 'parent' }); // no pinnedZones
    const child = makeArea({ id: 'child', parent: 'parent' });
    const areasById = new Map([
      ['parent', parent],
      ['child', child],
    ]);
    const region = resolveAreaRegion(child, areasById, 900, 300);
    expect(region).toEqual({ x: 0, y: 0, width: 900, height: 300 });
  });
});

describe('createCrossAreaPullForce', () => {
  it('pulls a node toward the edge of its own region facing the outside area it interacts with', () => {
    const own = makeArea({ id: 'own', clusterStrength: 1 });
    const outside = makeArea({ id: 'outside' });
    const node: ForceNode = { id: 'sym-bridge', x: 300, y: 200, vx: 0, vy: 0 };
    const nodeToAreas = new Map([['sym-bridge', [own]]]);
    const crossTargets = new Map([['sym-bridge', new Map([['outside', 1]])]]);
    const outsideAnchor = makeAnchor('outside', 5000, 200); // far to the right
    const anchorsById = new Map([['outside', outsideAnchor]]);
    const areasById = new Map([
      ['own', own],
      ['outside', outside],
    ]);

    const force = createCrossAreaPullForce(
      [node],
      nodeToAreas,
      crossTargets,
      anchorsById,
      areasById,
      600,
      400,
      1,
    );
    force(1);

    // Own region is the full 600x400 canvas, center (300,200); outside anchor is due
    // east, so the node should be pulled toward the region's right edge (x=600).
    expect(node.vx).toBeGreaterThan(0);
    expect(node.vy).toBeCloseTo(0, 5);
  });

  it('leaves a node with no cross-area targets untouched', () => {
    const own = makeArea({ id: 'own', clusterStrength: 1 });
    const node: ForceNode = { id: 'sym-internal', x: 300, y: 200, vx: 0, vy: 0 };
    const nodeToAreas = new Map([['sym-internal', [own]]]);
    const areasById = new Map([['own', own]]);

    const force = createCrossAreaPullForce(
      [node],
      nodeToAreas,
      new Map(),
      new Map(),
      areasById,
      600,
      400,
      1,
    );
    force(1);

    expect(node.vx).toBe(0);
    expect(node.vy).toBe(0);
  });

  it('leaves a node with no area membership untouched', () => {
    const node: ForceNode = { id: 'sym-orphan', x: 300, y: 200, vx: 0, vy: 0 };
    const force = createCrossAreaPullForce(
      [node],
      new Map(),
      new Map([['sym-orphan', new Map([['outside', 1]])]]),
      new Map(),
      new Map(),
      600,
      400,
      1,
    );
    force(1);

    expect(node.vx).toBe(0);
    expect(node.vy).toBe(0);
  });
});

describe('computeAreaRadii', () => {
  it('is the distance to the farthest direct member', () => {
    const area = makeArea({ id: 'auth' });
    const anchor = makeAnchor('auth', 0, 0);
    const nodes: ForceNode[] = [
      { id: 'near', x: 3, y: 0 },
      { id: 'far', x: 10, y: 0 },
    ];
    const nodeToAreas = new Map([
      ['near', [area]],
      ['far', [area]],
    ]);
    const radii = computeAreaRadii(nodes, nodeToAreas, new Map([['auth', area]]), new Map([['auth', anchor]]));
    expect(radii.get('auth')).toBe(10);
  });

  it("extends a parent's radius to reach past its child's bounding circle", () => {
    const parent = makeArea({ id: 'parent', children: ['child'] });
    const child = makeArea({ id: 'child', parent: 'parent' });
    const parentAnchor = makeAnchor('parent', 0, 0);
    const childAnchor = makeAnchor('child', 100, 0);
    const nodes: ForceNode[] = [{ id: 'child-member', x: 110, y: 0 }]; // 10 from childAnchor
    const nodeToAreas = new Map([['child-member', [child]]]);
    const areasById = new Map([
      ['parent', parent],
      ['child', child],
    ]);
    const anchorsById = new Map([
      ['parent', parentAnchor],
      ['child', childAnchor],
    ]);
    const radii = computeAreaRadii(nodes, nodeToAreas, areasById, anchorsById);
    // parent has no direct members; its radius must reach past the child's
    // anchor (distance 100) plus the child's own radius (10) = 110
    expect(radii.get('parent')).toBe(110);
    expect(radii.get('child')).toBe(10);
  });

  it('is zero for an area with no members and no children', () => {
    const area = makeArea({ id: 'empty' });
    const anchor = makeAnchor('empty', 0, 0);
    const radii = computeAreaRadii([], new Map(), new Map([['empty', area]]), new Map([['empty', anchor]]));
    expect(radii.get('empty')).toBe(0);
  });
});

describe('areAreasRelated', () => {
  const grandparent = makeArea({ id: 'gp' });
  const parent = makeArea({ id: 'parent', parent: 'gp' });
  const child = makeArea({ id: 'child', parent: 'parent' });
  const sibling = makeArea({ id: 'sibling' });
  const areasById = new Map([
    ['gp', grandparent],
    ['parent', parent],
    ['child', child],
    ['sibling', sibling],
  ]);

  it('treats direct parent/child as related', () => {
    expect(areAreasRelated(parent, child, areasById)).toBe(true);
  });

  it('treats grandparent/grandchild (transitive) as related', () => {
    expect(areAreasRelated(grandparent, child, areasById)).toBe(true);
  });

  it('treats unrelated areas as not related', () => {
    expect(areAreasRelated(child, sibling, areasById)).toBe(false);
  });
});

describe('createAreaHullCollisionForce', () => {
  it('pushes overlapping unrelated areas apart', () => {
    const areaA = makeArea({ id: 'a', contains: ['node-a'] });
    const areaB = makeArea({ id: 'b', contains: ['node-b'] });
    const nodeA: ForceNode = { id: 'node-a', x: 0, y: 0, vx: 0, vy: 0 };
    const nodeB: ForceNode = { id: 'node-b', x: 5, y: 0, vx: 0, vy: 0 }; // well within hull padding
    const areasById = new Map([
      ['a', areaA],
      ['b', areaB],
    ]);

    const force = createAreaHullCollisionForce([nodeA, nodeB], [areaA, areaB], areasById, 1);
    force(1);

    expect(nodeA.vx).toBeLessThan(0);
    expect(nodeB.vx).toBeGreaterThan(0);
  });

  it('does nothing for two areas whose hulls do not overlap', () => {
    const areaA = makeArea({ id: 'a', contains: ['node-a'] });
    const areaB = makeArea({ id: 'b', contains: ['node-b'] });
    const nodeA: ForceNode = { id: 'node-a', x: 0, y: 0, vx: 0, vy: 0 };
    const nodeB: ForceNode = { id: 'node-b', x: 100000, y: 0, vx: 0, vy: 0 }; // far away
    const areasById = new Map([
      ['a', areaA],
      ['b', areaB],
    ]);

    const force = createAreaHullCollisionForce([nodeA, nodeB], [areaA, areaB], areasById, 1);
    force(1);

    expect(nodeA.vx).toBe(0);
    expect(nodeB.vx).toBe(0);
  });

  it('does not push a parent and child apart even when their hulls nest', () => {
    const parent = makeArea({ id: 'parent', contains: ['node-parent'], children: ['child'] });
    const child = makeArea({ id: 'child', parent: 'parent', contains: ['node-child'] });
    const nodeParent: ForceNode = { id: 'node-parent', x: 0, y: 0, vx: 0, vy: 0 };
    const nodeChild: ForceNode = { id: 'node-child', x: 1, y: 0, vx: 0, vy: 0 };
    const areasById = new Map([
      ['parent', parent],
      ['child', child],
    ]);

    const force = createAreaHullCollisionForce([nodeParent, nodeChild], [parent, child], areasById, 1);
    force(1);

    expect(nodeParent.vx).toBe(0);
    expect(nodeChild.vx).toBe(0);
  });
});

describe('simulation integration', () => {
  it('all seven area forces can be called sequentially without throwing (pinned parent + unpinned child + colliding sibling)', () => {
    const childArea = makeArea({ id: 'child', parent: 'parent' });
    const parentArea = makeArea({ id: 'parent', pinnedZones: [0, 1, 2] }); // top row
    const siblingArea = makeArea({ id: 'sibling' }); // unrelated to child/parent

    const childAnchor = makeAnchor('child', 10, 10);
    const parentAnchor = makeAnchor('parent', 100, 100);
    const siblingAnchor = makeAnchor('sibling', 51, 51);
    const anchors = [childAnchor, parentAnchor, siblingAnchor];

    const areasById = new Map([
      ['child', childArea],
      ['parent', parentArea],
      ['sibling', siblingArea],
    ]);
    const areas = [childArea, parentArea, siblingArea];

    const bridgeNode: ForceNode = { id: 'sym-bridge', x: 50, y: 50, vx: 0, vy: 0 };
    const siblingNode: ForceNode = { id: 'sym-sibling', x: 52, y: 52, vx: 0, vy: 0 };
    childArea.contains.push('sym-bridge');
    siblingArea.contains.push('sym-sibling');
    const allNodes = [bridgeNode, siblingNode];

    const nodeToAreas = new Map([
      ['sym-bridge', [childArea]],
      ['sym-sibling', [siblingArea]],
    ]);
    const nodeCrossAreaTargets = new Map([['sym-bridge', new Map([['parent', 1]])]]);
    const anchorsById = new Map([
      ['child', childAnchor],
      ['parent', parentAnchor],
      ['sibling', siblingAnchor],
    ]);

    const forces = [
      createAnchorRepelForce(anchors, allNodes, nodeToAreas, areasById, 4000),
      createAreaAttractForce(anchors, new Map(), 0.15),
      createParentPullForce(anchors, areasById, 0.5),
      createAreaPinForce(anchors, areasById, 800, 600, 0.7),
      createCrossAreaPullForce(
        allNodes,
        nodeToAreas,
        nodeCrossAreaTargets,
        anchorsById,
        areasById,
        800,
        600,
        0.25,
      ),
      createAreaHullCollisionForce(allNodes, areas, areasById, 0.5),
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

    // Bridge node (in child area, interacting with parent) should have nonzero
    // velocity from crossAreaPull
    expect(bridgeNode.vx).not.toBe(0);
    expect(bridgeNode.vy).not.toBe(0);

    // Bridge and sibling nodes started overlapping (unrelated areas) — hull
    // collision should have pushed them in opposite directions
    expect(bridgeNode.vx).toBeLessThan(0);
    expect(siblingNode.vx).toBeGreaterThan(0);
  });
});
