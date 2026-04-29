import {
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_FORCES,
  DEFAULT_EDGE_FORCES,
  DEFAULT_SIMULATION,
  DEFAULT_REPO_GRAPH_CONFIG,
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
