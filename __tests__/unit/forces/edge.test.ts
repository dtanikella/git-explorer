import {
  weightModulatedEdge,
  legacyEdge,
  callWeightOf,
  maxCallWeight,
  normalizeCallWeight,
  RHO_DEFAULT,
  BETA_DEFAULT,
  BASE_DISTANCE_DEFAULT,
} from '@/lib/analysis/forces/edge';
import {
  DEFAULT_EDGE_FORCES,
  DEFAULT_REPO_GRAPH_CONFIG,
  INTERNAL_PROCESSING_CONFIG,
} from '@/lib/analysis/graph-config';
import type { AnalysisEdge } from '@/lib/analysis/types';
import { EdgeKind } from '@/lib/analysis/types';

function makeEdge(
  from: string,
  to: string,
  kind: EdgeKind = EdgeKind.CALLS,
): AnalysisEdge {
  return {
    kind,
    fromFile: `/src/${from}.ts`,
    fromName: from,
    fromSymbol: from,
    toText: to,
    toFile: `/src/${to}.ts`,
    toName: to,
    toSymbol: to,
    isExternal: false,
    edgePosition: { line: 1, col: 0 },
    isOptionalChain: false,
    isAsync: false,
  };
}

describe('weightModulatedEdge', () => {
  it('same-community edges are exactly 1/ρ stronger and 1/β closer than identical cross-community edges', () => {
    // a-b same community; a-c cross community; identical call weight (1 each).
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c')];
    const communityOf = new Map([
      ['a', 'C1'], ['b', 'C1'],
      ['c', 'C2'],
    ]);
    const accessor = weightModulatedEdge({ nodes: [], edges, communityOf });

    const sameCommunity = accessor(makeEdge('a', 'b'));
    const crossCommunity = accessor(makeEdge('a', 'c'));

    expect(sameCommunity.strength).toBeCloseTo(crossCommunity.strength / RHO_DEFAULT, 6);
    expect(sameCommunity.distance).toBeCloseTo(crossCommunity.distance / BETA_DEFAULT, 6);
    // Sanity: cross-community is weaker and farther.
    expect(sameCommunity.strength).toBeGreaterThan(crossCommunity.strength);
    expect(sameCommunity.distance).toBeLessThan(crossCommunity.distance);
  });

  it('normalizes call weights into [0,1] with the max-weight edge at 1', () => {
    // edge a→b appears once, c→d five times, e→f ten times.
    const edges = [
      ...Array.from({ length: 1 }, () => makeEdge('a', 'b')),
      ...Array.from({ length: 5 }, () => makeEdge('c', 'd')),
      ...Array.from({ length: 10 }, () => makeEdge('e', 'f')),
    ];
    const communityOf = new Map([
      ['a', 'C1'], ['b', 'C2'],
      ['c', 'C1'], ['d', 'C2'],
      ['e', 'C1'], ['f', 'C2'],
    ]);
    const accessor = weightModulatedEdge({ nodes: [], edges, communityOf });

    const weight1 = callWeightOf(edges, makeEdge('a', 'b'));
    const weight5 = callWeightOf(edges, makeEdge('c', 'd'));
    const weight10 = callWeightOf(edges, makeEdge('e', 'f'));
    const max = maxCallWeight(edges);

    expect(weight1).toBe(1);
    expect(weight5).toBe(5);
    expect(weight10).toBe(10);
    expect(max).toBe(10);

    const normalized = [weight1, weight5, weight10].map((w) => normalizeCallWeight(w, max));
    expect(normalized[0]).toBeCloseTo(0.1, 6);
    expect(normalized[1]).toBeCloseTo(0.5, 6);
    expect(normalized[2]).toBeCloseTo(1, 6);
    for (const n of normalized) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }

    // All edges here are cross-community, so strength = normalized × ρ.
    expect(accessor(makeEdge('e', 'f')).strength).toBeCloseTo(RHO_DEFAULT, 6);
    expect(accessor(makeEdge('a', 'b')).strength).toBeCloseTo(RHO_DEFAULT * 0.1, 6);
  });

  it('applies the optional kind multiplier for EXTENDS edges', () => {
    const edges = [makeEdge('a', 'b', EdgeKind.EXTENDS)];
    const communityOf = new Map([['a', 'C1'], ['b', 'C1']]);
    const accessor = weightModulatedEdge({ nodes: [], edges, communityOf });
    const forces = accessor(makeEdge('a', 'b', EdgeKind.EXTENDS));
    expect(forces.distance).toBeCloseTo(BASE_DISTANCE_DEFAULT * 1.25, 6);
    expect(forces.strength).toBeCloseTo(1 * 0.8, 6);
  });

  it('handles an empty edge list without dividing by zero', () => {
    const accessor = weightModulatedEdge({ nodes: [], edges: [], communityOf: new Map() });
    const forces = accessor(makeEdge('a', 'b'));
    expect(Number.isFinite(forces.distance)).toBe(true);
    expect(Number.isFinite(forces.strength)).toBe(true);
  });
});

describe('legacyEdge (regression pin of current behavior, wrapped verbatim)', () => {
  it('matches the DEFAULT_REPO_GRAPH_CONFIG accessor (80 / 0.5 for any kind)', () => {
    const accessor = legacyEdge({ nodes: [], edges: [], communityOf: new Map() });
    const edge = makeEdge('a', 'b', EdgeKind.IMPORTS);
    expect(accessor(edge)).toEqual(DEFAULT_REPO_GRAPH_CONFIG.forces.edge(edge));
    expect(accessor(edge)).toEqual(DEFAULT_EDGE_FORCES);
  });

  it('pins the INTERNAL_PROCESSING_CONFIG per-kind table (moved not rewritten)', () => {
    const rows: Array<[EdgeKind, number, number]> = [
      [EdgeKind.CALLS, 60, 0.5],
      [EdgeKind.EXTENDS, 100, 0.3],
      [EdgeKind.IMPLEMENTS, 100, 0.3],
      [EdgeKind.INSTANTIATES, 100, 0.3],
      [EdgeKind.IMPORTS, 200, 0.1],
      [EdgeKind.USES_TYPE, 200, 0.1],
    ];
    for (const [kind, distance, strength] of rows) {
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(makeEdge('a', 'b', kind));
      expect(forces.distance).toBe(distance);
      expect(forces.strength).toBe(strength);
    }
  });
});