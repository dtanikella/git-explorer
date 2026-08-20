import {
  legacyCharge,
  degreeScaledCharge,
  CHARGE_COEFFICIENT_K,
} from '@/lib/analysis/forces/charge';
import {
  DEFAULT_NODE_FORCES,
  DEFAULT_REPO_GRAPH_CONFIG,
  INTERNAL_PROCESSING_CONFIG,
} from '@/lib/analysis/graph-config';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';

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

function makeEdge(from: string, to: string): AnalysisEdge {
  return {
    kind: EdgeKind.CALLS,
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

describe('degreeScaledCharge', () => {
  it('gives charge 0 to a degree-0 (isolated) node', () => {
    const edges = [makeEdge('a', 'b')];
    const accessor = degreeScaledCharge({ nodes: [], edges });
    expect(accessor(makeNode('iso')).charge).toBe(0);
    expect(accessor(makeNode('a')).charge).toBeLessThan(0);
  });

  it('scales sub-linearly: charge(degree 100) / charge(degree 4) === sqrt(100)/sqrt(4) === 5', () => {
    // 'big' gets 100 incident edges, 'small' gets 4.
    const edges: AnalysisEdge[] = [];
    for (let i = 0; i < 100; i++) edges.push(makeEdge('big', `n${i}`));
    for (let i = 0; i < 4; i++) edges.push(makeEdge('small', `m${i}`));

    const accessor = degreeScaledCharge({ nodes: [], edges });
    const chargeBig = accessor(makeNode('big')).charge;
    const chargeSmall = accessor(makeNode('small')).charge;

    expect(chargeBig).toBeLessThan(0);
    expect(chargeSmall).toBeLessThan(0);
    // |ratio| must be sqrt(100)/sqrt(4) = 5 — NOT 25 (which linear scaling would give).
    expect(Math.abs(chargeBig / chargeSmall)).toBeCloseTo(5, 6);
  });

  it('uses -k·sqrt(degree) with the documented k coefficient', () => {
    const edges = [makeEdge('a', 'b')]; // degree 1
    const accessor = degreeScaledCharge({ nodes: [], edges });
    expect(accessor(makeNode('a')).charge).toBeCloseTo(-CHARGE_COEFFICIENT_K, 6);
  });

  it('returns the standard NodeForces shape (collideRadius/fx/fy unchanged)', () => {
    const accessor = degreeScaledCharge({ nodes: [], edges: [makeEdge('a', 'b')] });
    const forces = accessor(makeNode('a'));
    expect(forces.collideRadius).toBe(DEFAULT_NODE_FORCES.collideRadius);
    expect(forces.fx).toBeNull();
    expect(forces.fy).toBeNull();
  });
});

describe('legacyCharge (regression pin of current behavior, wrapped verbatim)', () => {
  it('matches the DEFAULT_REPO_GRAPH_CONFIG flat -200 accessor byte-for-byte', () => {
    const accessor = legacyCharge({ nodes: [], edges: [] });
    for (const node of [makeNode('a'), makeNode('b')]) {
      expect(accessor(node)).toEqual(DEFAULT_REPO_GRAPH_CONFIG.forces.node(node));
      expect(accessor(node)).toEqual(DEFAULT_NODE_FORCES);
    }
  });

  it('pins the INTERNAL_PROCESSING_CONFIG log-scaled charge range (moved not rewritten)', () => {
    // Base -300 for unreferenced nodes; scales down with referencedAt count; clamps at -1800.
    const unreferenced = makeNode('a');
    expect(INTERNAL_PROCESSING_CONFIG.forces.node(unreferenced).charge).toBe(-300);

    const manyRefs = makeNode('a');
    manyRefs.referencedAt = Array.from({ length: 1000 }, (_, i) => ({
      filePath: `/src/${i}.ts`,
      line: i,
      col: 0,
      scipSymbol: `s${i}`,
    }));
    expect(INTERNAL_PROCESSING_CONFIG.forces.node(manyRefs).charge).toBeGreaterThanOrEqual(-1800);

    const oneRef = makeNode('a');
    oneRef.referencedAt = [{ filePath: '/src/x.ts', line: 1, col: 0, scipSymbol: 's1' }];
    expect(INTERNAL_PROCESSING_CONFIG.forces.node(oneRef).charge).toBeLessThan(-300);
  });
});