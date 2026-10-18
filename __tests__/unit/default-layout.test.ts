// d3-hierarchy ships ES modules that jest does not transform, so the test loads its UMD build instead
jest.mock('d3-hierarchy', () => jest.requireActual('../../node_modules/d3-hierarchy/dist/d3-hierarchy.js'));

import { buildHierarchy } from '@/lib/default/adapter';
import { fileOverlays, layoutRadial, nearestNode } from '@/lib/default/layout';
import { DEFAULT_VIEW_CONFIG } from '@/lib/default/config';
import type { DisplayConfig } from '@/lib/default/config';
import { SyntaxType } from '@/lib/analysis/types';
import type { AnalysisNode, AnalysisResult } from '@/lib/analysis/types';

const node = (filePath: string, scipSymbol: string): AnalysisNode => ({
  syntaxType: SyntaxType.FUNCTION,
  name: scipSymbol,
  filePath,
  startLine: 0,
  startCol: 0,
  isAsync: false,
  isExported: true,
  params: [],
  returnTypeText: null,
  scipSymbol,
  isDefinition: true,
  inTestFile: false,
  referencedAt: [],
  outboundRefs: [],
});

const data: AnalysisResult = {
  nodes: [node('lib/a/x.ts', 's1'), node('lib/a/x.ts', 's2'), node('lib/b.ts', 's3'), node('top.ts', 's4')],
  edges: [],
  metadata: { repoPath: '/r', language: 'typescript', nodeCount: 4, edgeCount: 0, analysisDurationMs: 0, missingNodeTypes: [], missingEdgeKinds: [] },
};

describe('layoutRadial', () => {
  it('places the root at the center and each node at parent radius plus its edge gap', () => {
    const { nodes, links } = layoutRadial(buildHierarchy(data));
    expect(nodes[0].radius).toBe(0);
    expect(Math.hypot(nodes[0].x, nodes[0].y)).toBe(0);
    for (const l of links) {
      expect(l.target.radius - l.source.radius).toBeCloseTo(300);
    }
    const r = (name: string) => nodes.find((n) => n.node.name === name)!.radius;
    expect(r('lib')).toBe(300);
    expect(r('a')).toBe(600);
    expect(r('x.ts')).toBe(900);
    expect(r('s1')).toBe(1200);
    expect(r('top.ts')).toBe(300);
  });

  it('follows a changed gap in the config', () => {
    const config: DisplayConfig = { ...DEFAULT_VIEW_CONFIG, edge: { ...DEFAULT_VIEW_CONFIG.edge, length: 10 } };
    const { nodes } = layoutRadial(buildHierarchy(data), config);
    expect(nodes.find((n) => n.node.name === 's1')!.radius).toBe(40);
  });

  it('keeps x and y consistent with angle and radius', () => {
    for (const p of layoutRadial(buildHierarchy(data)).nodes) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(p.radius);
    }
  });

  it('keeps neighbouring symbols at least their arc spacing apart', () => {
    const many: AnalysisResult = {
      ...data,
      nodes: Array.from({ length: 60 }, (_, i) => node(`lib/f${i % 6}.ts`, `s${i}`)),
    };
    const { nodes } = layoutRadial(buildHierarchy(many));
    const syms = nodes.filter((n) => n.node.tier === 'symbol').sort((a, b) => a.angle - b.angle);
    // symbols sit on one ring here, so neighbours' chord is bounded below by the configured spacing (20)
    for (let i = 1; i < syms.length; i++) {
      expect(Math.hypot(syms[i].x - syms[i - 1].x, syms[i].y - syms[i - 1].y)).toBeGreaterThanOrEqual(19.9);
    }
  });

  it('gives each file with symbols an overlay from its own ring out past its farthest symbol', () => {
    const layout = layoutRadial(buildHierarchy(data));
    const overlays = fileOverlays(layout);
    expect(overlays.map((o) => o.file.node.name).sort()).toEqual(['b.ts', 'top.ts', 'x.ts']);
    for (const o of overlays) {
      expect(o.inner).toBe(o.file.radius);
      expect(o.outer).toBe(Math.max(...o.symbols.map((s) => s.radius)) + 5);
      for (const s of o.symbols) {
        expect(s.angle).toBeGreaterThan(o.startAngle);
        expect(s.angle).toBeLessThan(o.endAngle);
      }
    }
    expect(overlays.find((o) => o.file.node.name === 'x.ts')!.symbols.map((s) => s.node.name)).toEqual(['s1', 's2']);
  });

  it('keeps neighbouring overlays from overlapping in angle', () => {
    const many: AnalysisResult = { ...data, nodes: Array.from({ length: 60 }, (_, i) => node(`lib/f${i % 6}.ts`, `s${i}`)) };
    const overlays = fileOverlays(layoutRadial(buildHierarchy(many))).sort((a, b) => a.startAngle - b.startAngle);
    for (let i = 1; i < overlays.length; i++) expect(overlays[i].startAngle).toBeGreaterThanOrEqual(overlays[i - 1].endAngle);
  });

  it('has no overlays without symbols', () => {
    expect(fileOverlays(layoutRadial(buildHierarchy({ ...data, nodes: [] })))).toEqual([]);
  });

  it('finds the nearest of the given nodes to a point', () => {
    const layout = layoutRadial(buildHierarchy(data));
    const first = fileOverlays(layout).find((o) => o.file.node.name === 'x.ts')!;
    const target = first.symbols[1];
    expect(nearestNode(first.symbols, target.x + 3, target.y - 2)).toBe(target);
    expect(nearestNode([], 0, 0)).toBeNull();
  });

  it('is deterministic', () => {
    const run = () => layoutRadial(buildHierarchy(data)).nodes.map((n) => [n.node.id, n.angle, n.radius]);
    expect(run()).toEqual(run());
  });
});
