import { createDiffViewConfig, saturate } from '@/lib/diff/diff-view-config';
import type { GitAnalysisNode } from '@/lib/diff/types';
import type { Area } from '@/lib/areas/types';
import { SyntaxType } from '@/lib/analysis/types';

function makeNode(overrides: Partial<GitAnalysisNode>): GitAnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name: 'test',
    filePath: 'test.ts',
    startLine: 0,
    startCol: 0,
    isAsync: false,
    isExported: false,
    params: [],
    returnTypeText: null,
    scipSymbol: 'test',
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
    diffStatus: 'unchanged',
    ...overrides,
  };
}

function makeArea(overrides: Partial<Area>): Area {
  return {
    id: 'area1',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    name: 'Test Area',
    type: 'business_domain',
    contains: [],
    parent: null,
    children: [],
    clusterStrength: 0.5,
    ...overrides,
  };
}

describe('diff-view-config', () => {
  describe('saturate', () => {
    it('returns the same color at saturation 1', () => {
      expect(saturate('#22a559', 1)).toBe('#22a559');
    });

    it('returns white at any saturation', () => {
      expect(saturate('#ffffff', 0.5)).toBe('#ffffff');
    });

    it('desaturates to gray at saturation 0', () => {
      const result = saturate('#22a559', 0);
      // At saturation 0: gray = round(0.2126*34 + 0.7152*165 + 0.0722*89) = 132 = 0x84
      expect(result).toBe('#848484');
    });
  });

  describe('createDiffViewConfig', () => {
    it('styles added nodes with green', () => {
      const nodes = [makeNode({ diffStatus: 'added' })];
      const config = createDiffViewConfig(nodes, []);
      const style = config.style.node(nodes[0], 0);
      expect(style.color).toBe('#22a559');
      expect(style.radius).toBe(8);
      expect(style.saturation).toBe(1);
      expect(style.opacity).toBe(1);
      expect(style.ghostRing).toBe(false);
    });

    it('styles modified nodes with blue', () => {
      const nodes = [makeNode({ diffStatus: 'modified' })];
      const config = createDiffViewConfig(nodes, []);
      const style = config.style.node(nodes[0], 0);
      expect(style.color).toBe('#3b82f6');
      expect(style.radius).toBe(8);
      expect(style.saturation).toBe(1);
    });

    it('styles deleted ghost nodes with red and ghost ring', () => {
      const nodes = [makeNode({ diffStatus: 'deleted', ghost: true })];
      const config = createDiffViewConfig(nodes, []);
      const style = config.style.node(nodes[0], 0);
      expect(style.color).toBe('#e5484d');
      expect(style.radius).toBe(8);
      expect(style.ghostRing).toBe(true);
    });

    it('styles deleted non-ghost nodes with red without ghost ring', () => {
      // A deleted node without ghost flag gets no ghost ring
      const nodes = [makeNode({ diffStatus: 'deleted' })];
      const config = createDiffViewConfig(nodes, []);
      const style = config.style.node(nodes[0], 0);
      expect(style.color).toBe('#e5484d');
      expect(style.radius).toBe(8);
      expect(style.ghostRing).toBe(false);
    });

    it('styles unchanged nodes with desaturated gray', () => {
      const nodes = [makeNode({ diffStatus: 'unchanged' })];
      const config = createDiffViewConfig(nodes, []);
      const style = config.style.node(nodes[0], 0);
      expect(style.color).toBe('#6b7280');
      expect(style.radius).toBe(6);
      expect(style.saturation).toBe(0.5);
      expect(style.opacity).toBe(0.75);
    });

    it('applies area color to added nodes in an area', () => {
      const area: Area = makeArea({
        contains: ['test'],
        color: '#9367e0',
      });
      const nodes = [makeNode({ diffStatus: 'added' })];
      const config = createDiffViewConfig(nodes, [area]);
      const style = config.style.node(nodes[0], 0);
      expect(style.color).toBe('#9367e0');
    });

    it('applies area color to modified nodes in an area', () => {
      const area: Area = makeArea({
        contains: ['test'],
        color: '#9367e0',
      });
      const nodes = [makeNode({ diffStatus: 'modified' })];
      const config = createDiffViewConfig(nodes, [area]);
      const style = config.style.node(nodes[0], 0);
      expect(style.color).toBe('#9367e0');
    });

    it('applies area color to unchanged nodes in an area', () => {
      const area: Area = makeArea({
        contains: ['test'],
        color: '#9367e0',
      });
      const nodes = [makeNode({ diffStatus: 'unchanged' })];
      const config = createDiffViewConfig(nodes, [area]);
      const style = config.style.node(nodes[0], 0);
      // Unchanged in area uses area color
      expect(style.color).toBe('#9367e0');
      expect(style.saturation).toBe(0.5);
    });

    it('handles loose deleted ghosts (in an area, no ghost ring)', () => {
      const area: Area = makeArea({
        contains: ['test'],
        color: '#9367e0',
      });
      const nodes = [makeNode({ diffStatus: 'deleted', ghost: true })];
      const config = createDiffViewConfig(nodes, [area]);
      const style = config.style.node(nodes[0], 0);
      // In an area, deleted gets area color; ghost flag exists but we don't draw ghost ring
      expect(style.color).toBe('#9367e0');
      expect(style.ghostRing).toBe(false);
    });

    it('provides default style for nodes without diffStatus', () => {
      const node = makeNode({ diffStatus: undefined } as any);
      const config = createDiffViewConfig([], []);
      const style = config.style.node(node as any, 0);
      expect(style.color).toBe('#6b7280');
    });

    it('returns a config with default edge styling', () => {
      const config = createDiffViewConfig([], []);
      const edge = { fromSymbol: 'a', toSymbol: 'b', kind: 0, isExternal: false } as any;
      const style = config.style.edge(edge);
      expect(style.color).toBeDefined();
      expect(style.width).toBeDefined();
    });

    it('passes through filters', () => {
      const config = createDiffViewConfig([], []);
      expect(config.filters.node({} as any)).toBe(true);
      expect(config.filters.edge({} as any)).toBe(true);
    });
  });
});