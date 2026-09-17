import {
  getAncestorIds,
  getDescendantIds,
  addNodeToArea,
  addNodesToArea,
  moveNodeToArea,
  computeRollupMemberCounts,
} from '@/lib/areas/containment';
import type { Area } from '@/lib/areas/types';

const NOW = '2026-09-15T00:00:00.000Z';

function makeArea(overrides: Partial<Area>): Area {
  return {
    id: 'area',
    created_at: NOW,
    updated_at: NOW,
    name: 'Area',
    type: 'business_domain',
    contains: [],
    parent: null,
    children: [],
    clusterStrength: 0,
    ...overrides,
  };
}

// UX (parent) > RepoGraph (child), UX (parent) > SearchSelect (child), Utils (unrelated top-level)
const nested: Area[] = [
  makeArea({ id: 'ux', name: 'UX', children: ['repograph', 'search-select'] }),
  makeArea({ id: 'repograph', name: 'RepoGraph', parent: 'ux' }),
  makeArea({ id: 'search-select', name: 'Search Select', parent: 'ux' }),
  makeArea({ id: 'utils', name: 'Utils' }),
];

describe('getAncestorIds', () => {
  it('returns every ancestor walking up parent', () => {
    const areas: Area[] = [
      makeArea({ id: 'a', children: ['b'] }),
      makeArea({ id: 'b', parent: 'a', children: ['c'] }),
      makeArea({ id: 'c', parent: 'b' }),
    ];
    expect(getAncestorIds(areas, 'c')).toEqual(new Set(['a', 'b']));
  });

  it('returns empty set for a top-level area', () => {
    expect(getAncestorIds(nested, 'ux')).toEqual(new Set());
  });
});

describe('getDescendantIds', () => {
  it('returns every descendant walking down children', () => {
    expect(getDescendantIds(nested, 'ux')).toEqual(new Set(['repograph', 'search-select']));
  });

  it('returns empty set for a leaf area', () => {
    expect(getDescendantIds(nested, 'repograph')).toEqual(new Set());
  });
});

describe('addNodeToArea', () => {
  it('adds a node to an unrelated area without touching others', () => {
    const result = addNodeToArea(nested, 'sym-a', 'utils', NOW);
    expect(result.find((a) => a.id === 'utils')!.contains).toEqual(['sym-a']);
  });

  it('does not duplicate-add a node already in the target area', () => {
    const areas = nested.map((a) => (a.id === 'utils' ? { ...a, contains: ['sym-a'] } : a));
    const result = addNodeToArea(areas, 'sym-a', 'utils', NOW);
    expect(result.find((a) => a.id === 'utils')!.contains).toEqual(['sym-a']);
  });

  it('adding to a child area removes the redundant direct membership from its ancestor', () => {
    const areas = nested.map((a) => (a.id === 'ux' ? { ...a, contains: ['sym-a'] } : a));
    const result = addNodeToArea(areas, 'sym-a', 'repograph', NOW);
    expect(result.find((a) => a.id === 'repograph')!.contains).toEqual(['sym-a']);
    expect(result.find((a) => a.id === 'ux')!.contains).toEqual([]);
  });

  it('adding to an ancestor removes the more specific membership from its descendant', () => {
    const areas = nested.map((a) => (a.id === 'repograph' ? { ...a, contains: ['sym-a'] } : a));
    const result = addNodeToArea(areas, 'sym-a', 'ux', NOW);
    expect(result.find((a) => a.id === 'ux')!.contains).toEqual(['sym-a']);
    expect(result.find((a) => a.id === 'repograph')!.contains).toEqual([]);
  });

  it('leaves genuinely unrelated sibling memberships alone (real multi-area case)', () => {
    const areas = nested.map((a) => (a.id === 'search-select' ? { ...a, contains: ['sym-a'] } : a));
    const result = addNodeToArea(areas, 'sym-a', 'repograph', NOW);
    expect(result.find((a) => a.id === 'repograph')!.contains).toEqual(['sym-a']);
    expect(result.find((a) => a.id === 'search-select')!.contains).toEqual(['sym-a']);
  });
});

describe('addNodesToArea', () => {
  it('adds every node in the batch to the target area', () => {
    const result = addNodesToArea(nested, ['sym-a', 'sym-b', 'sym-c'], 'utils', NOW);
    expect(result.find((a) => a.id === 'utils')!.contains).toEqual(['sym-a', 'sym-b', 'sym-c']);
  });

  it('dedupes each node against the target ancestor/descendant chain like a single add', () => {
    const areas = nested.map((a) => (a.id === 'ux' ? { ...a, contains: ['sym-a', 'sym-b'] } : a));
    const result = addNodesToArea(areas, ['sym-a', 'sym-b'], 'repograph', NOW);
    expect(result.find((a) => a.id === 'repograph')!.contains).toEqual(['sym-a', 'sym-b']);
    expect(result.find((a) => a.id === 'ux')!.contains).toEqual([]);
  });
});

describe('moveNodeToArea', () => {
  it('removes from the source area and adds to the target area', () => {
    const areas = nested.map((a) => (a.id === 'repograph' ? { ...a, contains: ['sym-a'] } : a));
    const result = moveNodeToArea(areas, 'sym-a', 'repograph', 'search-select', NOW);
    expect(result.find((a) => a.id === 'repograph')!.contains).toEqual([]);
    expect(result.find((a) => a.id === 'search-select')!.contains).toEqual(['sym-a']);
  });

  it('is a no-op when source and target are the same area', () => {
    const areas = nested.map((a) => (a.id === 'repograph' ? { ...a, contains: ['sym-a'] } : a));
    const result = moveNodeToArea(areas, 'sym-a', 'repograph', 'repograph', NOW);
    expect(result).toBe(areas);
  });

  it('also dedupes against the target ancestor/descendant chain when moving', () => {
    const areas = nested.map((a) => {
      if (a.id === 'repograph') return { ...a, contains: ['sym-a'] };
      if (a.id === 'utils') return { ...a, contains: ['sym-a'] };
      return a;
    });
    const result = moveNodeToArea(areas, 'sym-a', 'utils', 'ux', NOW);
    expect(result.find((a) => a.id === 'ux')!.contains).toEqual(['sym-a']);
    expect(result.find((a) => a.id === 'repograph')!.contains).toEqual([]);
    expect(result.find((a) => a.id === 'utils')!.contains).toEqual([]);
  });
});

describe('computeRollupMemberCounts', () => {
  it('rolls up descendant members into an ancestor count', () => {
    const areas = nested.map((a) => {
      if (a.id === 'ux') return { ...a, contains: ['sym-own'] };
      if (a.id === 'repograph') return { ...a, contains: ['sym-a', 'sym-b'] };
      if (a.id === 'search-select') return { ...a, contains: ['sym-c'] };
      return a;
    });
    const counts = computeRollupMemberCounts(areas);
    expect(counts.get('ux')).toBe(4);
    expect(counts.get('repograph')).toBe(2);
    expect(counts.get('search-select')).toBe(1);
    expect(counts.get('utils')).toBe(0);
  });

  it('counts a node once even if it is redundantly present at both levels (stale data)', () => {
    const areas = nested.map((a) => {
      if (a.id === 'ux') return { ...a, contains: ['sym-a'] };
      if (a.id === 'repograph') return { ...a, contains: ['sym-a'] };
      return a;
    });
    const counts = computeRollupMemberCounts(areas);
    expect(counts.get('ux')).toBe(1);
  });
});
