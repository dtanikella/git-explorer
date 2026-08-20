import {
  DEFAULT_REPO_GRAPH_CONFIG,
  INTERNAL_PROCESSING_CONFIG,
  withForceScheme,
  DEFAULT_NODE_FORCES,
  DEFAULT_EDGE_FORCES,
  type RepoGraphConfig,
} from '@/lib/analysis/graph-config';
import { CHARGE_COEFFICIENT_K } from '@/lib/analysis/forces/charge';
import { RHO_DEFAULT, BASE_DISTANCE_DEFAULT } from '@/lib/analysis/forces/edge';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';

// This file is the single most important test in the plan: it proves the
// scheme wiring introduced zero behavioral change while the toggle is off
// ("isolated, revertible"), and that the v2 mode installs the derived
// factories when flipped on.

function makeNode(id: string): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name: id,
    filePath: `/src/${id}.ts`,
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: id,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  };
}

function makeEdge(from: string, to: string, kind: EdgeKind = EdgeKind.CALLS): AnalysisEdge {
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

const context = {
  nodes: [makeNode('a'), makeNode('b')],
  edges: [makeEdge('a', 'b'), makeEdge('a', 'b')],
  communityOf: new Map<string, string>([['a', 'C1'], ['b', 'C1']]),
};

describe('withForceScheme — legacy mode (unchanged behavior)', () => {
  it('returns the config untouched (identity) for legacy — byte-for-byte parity', () => {
    expect(withForceScheme(DEFAULT_REPO_GRAPH_CONFIG, context, 'legacy')).toBe(DEFAULT_REPO_GRAPH_CONFIG);
    expect(withForceScheme(INTERNAL_PROCESSING_CONFIG, context, 'legacy')).toBe(INTERNAL_PROCESSING_CONFIG);
  });

  it('legacy accessors still produce the pre-Phase-3 values', () => {
    const cfg = withForceScheme(INTERNAL_PROCESSING_CONFIG, context, 'legacy') as RepoGraphConfig;
    // Charge: -300 base for unreferenced nodes (unchanged).
    expect(cfg.forces.node(makeNode('a')).charge).toBe(-300);
    // Per-kind table unchanged.
    expect(cfg.forces.edge(makeEdge('a', 'b', EdgeKind.CALLS))).toEqual(
      INTERNAL_PROCESSING_CONFIG.forces.edge(makeEdge('a', 'b', EdgeKind.CALLS)),
    );
    expect(cfg.forces.edge(makeEdge('a', 'b', EdgeKind.IMPORTS))).toEqual({ distance: 200, strength: 0.1 });
    // Default config unchanged too.
    const defaultCfg = withForceScheme(DEFAULT_REPO_GRAPH_CONFIG, context, 'legacy') as RepoGraphConfig;
    expect(defaultCfg.forces.node(makeNode('a'))).toEqual(DEFAULT_NODE_FORCES);
    expect(defaultCfg.forces.edge(makeEdge('a', 'b'))).toEqual(DEFAULT_EDGE_FORCES);
  });
});

describe('withForceScheme — v2 mode (derived forces installed)', () => {
  it('replaces node/edge accessors with the v2 factories', () => {
    const cfg = withForceScheme(DEFAULT_REPO_GRAPH_CONFIG, context, 'v2') as RepoGraphConfig;
    // degreeScaledCharge: -k·sqrt(2) for a node with 2 incident edges.
    const charge = cfg.forces.node(makeNode('a')).charge;
    expect(charge).toBeCloseTo(-CHARGE_COEFFICIENT_K * Math.sqrt(2), 6);
    // weightModulatedEdge: same-community CALLS edge → distance d0, strength 1.
    const forces = cfg.forces.edge(makeEdge('a', 'b'));
    expect(forces.distance).toBe(BASE_DISTANCE_DEFAULT);
    expect(forces.strength).toBeCloseTo(1, 6);
    // Cross-community edges get ρ/β modulation.
    const crossCfg = withForceScheme(DEFAULT_REPO_GRAPH_CONFIG, {
      ...context,
      communityOf: new Map([['a', 'C1'], ['b', 'C2']]),
    }, 'v2') as RepoGraphConfig;
    const cross = crossCfg.forces.edge(makeEdge('a', 'b'));
    expect(cross.distance).toBeCloseTo(BASE_DISTANCE_DEFAULT * 2, 6); // β default 2
    expect(cross.strength).toBeCloseTo(RHO_DEFAULT, 6); // ρ default 0.4
  });

  it('leaves everything else untouched (filters, style, simulation, area constants)', () => {
    const cfg = withForceScheme(DEFAULT_REPO_GRAPH_CONFIG, context, 'v2') as RepoGraphConfig;
    expect(cfg.filters.node).toBe(DEFAULT_REPO_GRAPH_CONFIG.filters.node);
    expect(cfg.filters.edge).toBe(DEFAULT_REPO_GRAPH_CONFIG.filters.edge);
    expect(cfg.style.node).toBe(DEFAULT_REPO_GRAPH_CONFIG.style.node);
    expect(cfg.style.edge).toBe(DEFAULT_REPO_GRAPH_CONFIG.style.edge);
    expect(cfg.simulation).toEqual(DEFAULT_REPO_GRAPH_CONFIG.simulation);
    expect(cfg.forces.areaCluster).toBe(DEFAULT_REPO_GRAPH_CONFIG.forces.areaCluster);
    expect(cfg.forces.areaAttract).toBe(DEFAULT_REPO_GRAPH_CONFIG.forces.areaAttract);
    expect(cfg.forces.areaParent).toBe(DEFAULT_REPO_GRAPH_CONFIG.forces.areaParent);
    expect(cfg.forces.anchorRepel).toBe(DEFAULT_REPO_GRAPH_CONFIG.forces.anchorRepel);
  });
});