import {
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_FORCES,
  DEFAULT_EDGE_FORCES,
  DEFAULT_SIMULATION,
  DEFAULT_REPO_GRAPH_CONFIG,
  INTERNAL_PROCESSING_CONFIG,
  combineFilters,
  createNodeStyler,
  createEdgeForcer,
  mergeConfigs,
  type NodeStyler,
} from '@/lib/analysis/graph-config';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';

describe('graph-config defaults', () => {
  describe('DEFAULT_NODE_STYLE', () => {
    it('has a hex color string', () => {
      expect(DEFAULT_NODE_STYLE.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('has a positive radius', () => {
      expect(DEFAULT_NODE_STYLE.radius).toBeGreaterThan(0);
    });

    it('has opacity between 0 and 1', () => {
      expect(DEFAULT_NODE_STYLE.opacity).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_NODE_STYLE.opacity).toBeLessThanOrEqual(1);
    });

    it('has label disabled by default', () => {
      expect(DEFAULT_NODE_STYLE.label).toBe(false);
    });
  });

  describe('DEFAULT_EDGE_STYLE', () => {
    it('has a hex color string', () => {
      expect(DEFAULT_EDGE_STYLE.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('has a positive width', () => {
      expect(DEFAULT_EDGE_STYLE.width).toBeGreaterThan(0);
    });

    it('has opacity between 0 and 1', () => {
      expect(DEFAULT_EDGE_STYLE.opacity).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_EDGE_STYLE.opacity).toBeLessThanOrEqual(1);
    });
  });

  describe('DEFAULT_NODE_FORCES', () => {
    it('has negative charge (repulsive)', () => {
      expect(DEFAULT_NODE_FORCES.charge).toBeLessThan(0);
    });

    it('has positive collide radius', () => {
      expect(DEFAULT_NODE_FORCES.collideRadius).toBeGreaterThan(0);
    });

    it('has null fixed positions (free movement)', () => {
      expect(DEFAULT_NODE_FORCES.fx).toBeNull();
      expect(DEFAULT_NODE_FORCES.fy).toBeNull();
    });
  });

  describe('DEFAULT_EDGE_FORCES', () => {
    it('has positive distance', () => {
      expect(DEFAULT_EDGE_FORCES.distance).toBeGreaterThan(0);
    });

    it('has strength between 0 and 1', () => {
      expect(DEFAULT_EDGE_FORCES.strength).toBeGreaterThan(0);
      expect(DEFAULT_EDGE_FORCES.strength).toBeLessThanOrEqual(1);
    });
  });

  describe('DEFAULT_SIMULATION', () => {
    it('has positive centerStrength', () => {
      expect(DEFAULT_SIMULATION.centerStrength).toBeGreaterThan(0);
    });

    it('has positive collisionPadding', () => {
      expect(DEFAULT_SIMULATION.collisionPadding).toBeGreaterThan(0);
    });

    it('has positive alphaDecay', () => {
      expect(DEFAULT_SIMULATION.alphaDecay).toBeGreaterThan(0);
    });

    it('has positive velocityDecay', () => {
      expect(DEFAULT_SIMULATION.velocityDecay).toBeGreaterThan(0);
    });
  });
});

const makeNode = (overrides?: Partial<AnalysisNode>): AnalysisNode => ({
  syntaxType: SyntaxType.FUNCTION,
  name: 'testFn',
  filePath: '/src/test.ts',
  startLine: 1,
  startCol: 0,
  isAsync: false,
  isExported: true,
  params: [],
  returnTypeText: null,
  scipSymbol: 'test#testFn.',
  isDefinition: true,
  inTestFile: false,
  referencedAt: [],
  outboundRefs: [],
  ...overrides,
});

const makeEdge = (overrides?: Partial<AnalysisEdge>): AnalysisEdge => ({
  kind: EdgeKind.CALLS,
  fromFile: '/src/a.ts',
  fromName: 'foo',
  fromSymbol: 'test#foo.',
  toText: 'bar',
  toFile: '/src/b.ts',
  toName: 'bar',
  toSymbol: 'test#bar.',
  isExternal: false,
  edgePosition: { line: 1, col: 0 },
  isOptionalChain: false,
  isAsync: false,
  ...overrides,
});

describe('DEFAULT_REPO_GRAPH_CONFIG', () => {
  it('passes all nodes through the node filter', () => {
    const node = makeNode();
    expect(DEFAULT_REPO_GRAPH_CONFIG.filters.node(node)).toBe(true);
  });

  it('passes all edges through the edge filter', () => {
    const edge = makeEdge();
    expect(DEFAULT_REPO_GRAPH_CONFIG.filters.edge(edge)).toBe(true);
  });

  it('returns default node style for an unknown syntax type', () => {
    const node = makeNode({ syntaxType: 'UNKNOWN' as SyntaxType });
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.node(node, 0);
    expect(style).toEqual(DEFAULT_NODE_STYLE);
  });

  it('returns a color for FUNCTION nodes', () => {
    const node = makeNode({ syntaxType: SyntaxType.FUNCTION });
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.node(node, 0);
    expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('returns a color for CLASS nodes', () => {
    const node = makeNode({ syntaxType: SyntaxType.CLASS });
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.node(node, 0);
    expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('returns a color for INTERFACE nodes', () => {
    const node = makeNode({ syntaxType: SyntaxType.INTERFACE });
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.node(node, 0);
    expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('returns default edge style', () => {
    const edge = makeEdge();
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.edge(edge);
    expect(style).toEqual(DEFAULT_EDGE_STYLE);
  });

  it('returns default node forces', () => {
    const node = makeNode();
    const forces = DEFAULT_REPO_GRAPH_CONFIG.forces.node(node);
    expect(forces).toEqual(DEFAULT_NODE_FORCES);
  });

  it('returns default edge forces', () => {
    const edge = makeEdge();
    const forces = DEFAULT_REPO_GRAPH_CONFIG.forces.edge(edge);
    expect(forces).toEqual(DEFAULT_EDGE_FORCES);
  });

  it('has default simulation params', () => {
    expect(DEFAULT_REPO_GRAPH_CONFIG.simulation).toEqual(DEFAULT_SIMULATION);
  });
});

describe('combineFilters', () => {
  it('returns a predicate that ANDs all predicates together', () => {
    const isExported = (n: AnalysisNode) => n.isExported;
    const isNotTest = (n: AnalysisNode) => !n.inTestFile;
    const combined = combineFilters(isExported, isNotTest);

    expect(combined(makeNode({ isExported: true, inTestFile: false }))).toBe(true);
    expect(combined(makeNode({ isExported: false, inTestFile: false }))).toBe(false);
    expect(combined(makeNode({ isExported: true, inTestFile: true }))).toBe(false);
  });

  it('returns true for all inputs when no predicates are provided', () => {
    const combined = combineFilters<AnalysisNode>();
    expect(combined(makeNode())).toBe(true);
  });

  it('works with edge predicates', () => {
    const isNotExternal = (e: AnalysisEdge) => !e.isExternal;
    const isCalls = (e: AnalysisEdge) => e.kind === EdgeKind.CALLS;
    const combined = combineFilters(isNotExternal, isCalls);

    expect(combined(makeEdge({ isExternal: false, kind: EdgeKind.CALLS }))).toBe(true);
    expect(combined(makeEdge({ isExternal: true, kind: EdgeKind.CALLS }))).toBe(false);
    expect(combined(makeEdge({ isExternal: false, kind: EdgeKind.IMPORTS }))).toBe(false);
  });
});

describe('createNodeStyler', () => {
  it('returns overridden style for mapped SyntaxType', () => {
    const styler = createNodeStyler({
      [SyntaxType.CLASS]: { color: '#ef4444', radius: 14 },
    });
    const style = styler(makeNode({ syntaxType: SyntaxType.CLASS }), 5);
    expect(style.color).toBe('#ef4444');
    expect(style.radius).toBe(14);
    expect(style.opacity).toBe(DEFAULT_NODE_STYLE.opacity);
    expect(style.label).toBe(DEFAULT_NODE_STYLE.label);
  });

  it('returns default style for unmapped SyntaxType', () => {
    const styler = createNodeStyler({
      [SyntaxType.CLASS]: { color: '#ef4444' },
    });
    const style = styler(makeNode({ syntaxType: SyntaxType.FUNCTION }), 5);
    expect(style).toEqual(DEFAULT_NODE_STYLE);
  });

  it('uses sizeFn to override radius for all nodes', () => {
    const styler = createNodeStyler(
      { [SyntaxType.FUNCTION]: { color: '#3b82f6' } },
      (degree) => degree * 2 + 4,
    );
    const style = styler(makeNode({ syntaxType: SyntaxType.FUNCTION }), 10);
    expect(style.radius).toBe(24);
    expect(style.color).toBe('#3b82f6');
  });

  it('applies sizeFn even for unmapped types', () => {
    const styler = createNodeStyler(
      {},
      (degree) => degree + 1,
    );
    const style = styler(makeNode({ syntaxType: SyntaxType.MODULE }), 5);
    expect(style.radius).toBe(6);
    expect(style.color).toBe(DEFAULT_NODE_STYLE.color);
  });

  it('handles empty mapping', () => {
    const styler = createNodeStyler({});
    const style = styler(makeNode(), 0);
    expect(style).toEqual(DEFAULT_NODE_STYLE);
  });
});

describe('createEdgeForcer', () => {
  it('returns overridden forces for mapped EdgeKind', () => {
    const forcer = createEdgeForcer({
      [EdgeKind.CALLS]: { distance: 30, strength: 0.8 },
    });
    const forces = forcer(makeEdge({ kind: EdgeKind.CALLS }));
    expect(forces.distance).toBe(30);
    expect(forces.strength).toBe(0.8);
  });

  it('returns default forces for unmapped EdgeKind', () => {
    const forcer = createEdgeForcer({
      [EdgeKind.CALLS]: { distance: 30 },
    });
    const forces = forcer(makeEdge({ kind: EdgeKind.IMPORTS }));
    expect(forces).toEqual(DEFAULT_EDGE_FORCES);
  });

  it('partially overrides — fills remaining from defaults', () => {
    const forcer = createEdgeForcer({
      [EdgeKind.USES_TYPE]: { distance: 120 },
    });
    const forces = forcer(makeEdge({ kind: EdgeKind.USES_TYPE }));
    expect(forces.distance).toBe(120);
    expect(forces.strength).toBe(DEFAULT_EDGE_FORCES.strength);
  });

  it('handles empty mapping', () => {
    const forcer = createEdgeForcer({});
    const forces = forcer(makeEdge());
    expect(forces).toEqual(DEFAULT_EDGE_FORCES);
  });
});

describe('mergeConfigs', () => {
  it('returns base config when no overrides are provided', () => {
    const result = mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG);
    expect(result.simulation).toEqual(DEFAULT_SIMULATION);
    expect(result.filters.node(makeNode())).toBe(true);
  });

  it('overrides simulation params', () => {
    const result = mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
      simulation: { centerStrength: 0.5 },
    });
    expect(result.simulation.centerStrength).toBe(0.5);
    expect(result.simulation.collisionPadding).toBe(DEFAULT_SIMULATION.collisionPadding);
    expect(result.simulation.alphaDecay).toBe(DEFAULT_SIMULATION.alphaDecay);
    expect(result.simulation.velocityDecay).toBe(DEFAULT_SIMULATION.velocityDecay);
  });

  it('replaces accessor functions entirely', () => {
    const customFilter = (n: AnalysisNode) => n.isExported;
    const result = mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
      filters: { node: customFilter },
    });
    expect(result.filters.node).toBe(customFilter);
    expect(result.filters.edge(makeEdge())).toBe(true);
  });

  it('applies multiple overrides in order (last wins)', () => {
    const result = mergeConfigs(
      DEFAULT_REPO_GRAPH_CONFIG,
      { simulation: { centerStrength: 0.3 } },
      { simulation: { centerStrength: 0.9 } },
    );
    expect(result.simulation.centerStrength).toBe(0.9);
  });

  it('does not mutate the base config', () => {
    const originalCenter = DEFAULT_REPO_GRAPH_CONFIG.simulation.centerStrength;
    mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
      simulation: { centerStrength: 99 },
    });
    expect(DEFAULT_REPO_GRAPH_CONFIG.simulation.centerStrength).toBe(originalCenter);
  });

  it('merges style layer with node override only', () => {
    const customNodeStyler: NodeStyler = (_node, _degree) => ({
      color: '#ff0000', radius: 20, opacity: 0.5, label: true,
    });
    const result = mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
      style: { node: customNodeStyler },
    });
    expect(result.style.node).toBe(customNodeStyler);
    const edgeStyle = result.style.edge(makeEdge());
    expect(edgeStyle).toEqual(DEFAULT_EDGE_STYLE);
  });
});

describe('INTERNAL_PROCESSING_CONFIG', () => {
  describe('node filter', () => {
    it('accepts FUNCTION nodes', () => {
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(makeNode({ syntaxType: SyntaxType.FUNCTION }))).toBe(true);
    });

    it('accepts METHOD nodes', () => {
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(makeNode({ syntaxType: SyntaxType.METHOD }))).toBe(true);
    });

    it('accepts CLASS nodes', () => {
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(makeNode({ syntaxType: SyntaxType.CLASS }))).toBe(true);
    });

    it('rejects INTERFACE nodes', () => {
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(makeNode({ syntaxType: SyntaxType.INTERFACE }))).toBe(false);
    });

    it('rejects TYPE_ALIAS nodes', () => {
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(makeNode({ syntaxType: SyntaxType.TYPE_ALIAS }))).toBe(false);
    });

    it('rejects MODULE nodes', () => {
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(makeNode({ syntaxType: SyntaxType.MODULE }))).toBe(false);
    });
  });

  describe('edge filter', () => {
    it('accepts non-external edges', () => {
      expect(INTERNAL_PROCESSING_CONFIG.filters.edge(makeEdge({ isExternal: false }))).toBe(true);
    });

    it('rejects external edges', () => {
      expect(INTERNAL_PROCESSING_CONFIG.filters.edge(makeEdge({ isExternal: true }))).toBe(false);
    });
  });

  describe('node style', () => {
    it('scales radius with outboundRefs count', () => {
      const nodeWith0 = makeNode({ outboundRefs: [] });
      const nodeWith5 = makeNode({
        outboundRefs: Array.from({ length: 5 }, (_, i) => ({
          filePath: '/src/x.ts', line: i, col: 0, scipSymbol: `test#x${i}.`,
        })),
      });
      const style0 = INTERNAL_PROCESSING_CONFIG.style.node(nodeWith0, 0);
      const style5 = INTERNAL_PROCESSING_CONFIG.style.node(nodeWith5, 0);
      expect(style5.radius).toBeGreaterThan(style0.radius);
    });

    it('clamps radius to a minimum of 3', () => {
      const node = makeNode({ outboundRefs: [] });
      const style = INTERNAL_PROCESSING_CONFIG.style.node(node, 0);
      expect(style.radius).toBeGreaterThanOrEqual(3);
    });

    it('clamps radius to a maximum of 30', () => {
      const manyRefs = Array.from({ length: 1000 }, (_, i) => ({
        filePath: '/src/x.ts',
        line: i,
        col: 0,
        scipSymbol: `test#x${i}.`,
      }));
      const node = makeNode({ outboundRefs: manyRefs });
      const style = INTERNAL_PROCESSING_CONFIG.style.node(node, 0);
      expect(style.radius).toBeLessThanOrEqual(30);
    });

    it('uses syntax type colors (FUNCTION → blue)', () => {
      const node = makeNode({ syntaxType: SyntaxType.FUNCTION });
      const style = INTERNAL_PROCESSING_CONFIG.style.node(node, 0);
      expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(style.color).not.toBe(DEFAULT_NODE_STYLE.color);
    });

    it('uses syntax type colors (CLASS)', () => {
      const node = makeNode({ syntaxType: SyntaxType.CLASS });
      const style = INTERNAL_PROCESSING_CONFIG.style.node(node, 0);
      expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('node forces', () => {
    it('uses base charge of -100 for a node with no references', () => {
      const node = makeNode({ referencedAt: [] });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.node(node);
      expect(forces.charge).toBe(-100);
    });

    it('scales charge with referencedAt count', () => {
      const refs = [{ filePath: '/src/x.ts', line: 1, col: 0, scipSymbol: 'test#x.' }];
      const nodeOne = makeNode({ referencedAt: refs });
      const nodeZero = makeNode({ referencedAt: [] });
      const forcesOne = INTERNAL_PROCESSING_CONFIG.forces.node(nodeOne);
      const forcesZero = INTERNAL_PROCESSING_CONFIG.forces.node(nodeZero);
      expect(forcesOne.charge).toBeLessThan(forcesZero.charge);
    });

    it('clamps charge to a minimum of -600', () => {
      const manyRefs = Array.from({ length: 1000 }, (_, i) => ({
        filePath: '/src/x.ts',
        line: i,
        col: 0,
        scipSymbol: `test#x${i}.`,
      }));
      const node = makeNode({ referencedAt: manyRefs });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.node(node);
      expect(forces.charge).toBeGreaterThanOrEqual(-600);
    });
  });

  describe('edge forces', () => {
    it('CALLS edges have distance 60 and strength 0.5', () => {
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(makeEdge({ kind: EdgeKind.CALLS }));
      expect(forces.distance).toBe(60);
      expect(forces.strength).toBe(0.5);
    });

    it('EXTENDS edges have distance 100 and strength 0.3', () => {
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(makeEdge({ kind: EdgeKind.EXTENDS }));
      expect(forces.distance).toBe(100);
      expect(forces.strength).toBe(0.3);
    });

    it('IMPLEMENTS edges have distance 100 and strength 0.3', () => {
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(makeEdge({ kind: EdgeKind.IMPLEMENTS }));
      expect(forces.distance).toBe(100);
      expect(forces.strength).toBe(0.3);
    });

    it('INSTANTIATES edges have distance 100 and strength 0.3', () => {
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(makeEdge({ kind: EdgeKind.INSTANTIATES }));
      expect(forces.distance).toBe(100);
      expect(forces.strength).toBe(0.3);
    });

    it('IMPORTS edges have distance 200 and strength 0.1', () => {
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(makeEdge({ kind: EdgeKind.IMPORTS }));
      expect(forces.distance).toBe(200);
      expect(forces.strength).toBe(0.1);
    });

    it('USES_TYPE edges have distance 200 and strength 0.1', () => {
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(makeEdge({ kind: EdgeKind.USES_TYPE }));
      expect(forces.distance).toBe(200);
      expect(forces.strength).toBe(0.1);
    });
  });

  describe('simulation', () => {
    it('uses DEFAULT_SIMULATION params', () => {
      expect(INTERNAL_PROCESSING_CONFIG.simulation).toEqual(DEFAULT_SIMULATION);
    });
  });
});