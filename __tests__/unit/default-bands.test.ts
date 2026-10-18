// d3-hierarchy ships ES modules that jest does not transform, so the test loads its UMD build instead
jest.mock('d3-hierarchy', () => jest.requireActual('../../node_modules/d3-hierarchy/dist/d3-hierarchy.js'));

import { buildHierarchy } from '@/lib/default/adapter';
import { layoutRadial } from '@/lib/default/layout';
import { layoutBands } from '@/lib/default/bands';
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

const result = (paths: string[]): AnalysisResult => ({
  nodes: paths.map((p, i) => node(p, `s${i}`)),
  edges: [],
  metadata: { repoPath: '/r', language: 'typescript', nodeCount: paths.length, edgeCount: 0, analysisDurationMs: 0, missingNodeTypes: [], missingEdgeKinds: [] },
});

// lib holds a subfolder (a) and a file (b.ts), which sit on the same ring
const mixed = result(['lib/a/x.ts', 'lib/a/x.ts', 'lib/a/y.ts', 'lib/b.ts', 'top.ts']);
const bandsOf = (r: AnalysisResult, config: DisplayConfig = DEFAULT_VIEW_CONFIG) => layoutBands(layoutRadial(buildHierarchy(r), config), config);
const named = (bands: ReturnType<typeof bandsOf>, name: string, tier?: 'folder' | 'file') => bands.filter((b) => b.node.node.name === name && (!tier || b.tier === tier));

describe('layoutBands', () => {
  it('gives every file with symbols a file band from its ring out past its farthest symbol', () => {
    const bands = bandsOf(mixed);
    const files = bands.filter((b) => b.tier === 'file');
    expect(files.map((b) => b.node.node.name).sort()).toEqual(['b.ts', 'top.ts', 'x.ts', 'y.ts']);
    for (const b of files) {
      expect(b.inner).toBe(b.node.radius);
      expect(b.outer).toBe(Math.max(...b.symbols.map((s) => s.radius)) + 5);
    }
  });

  it('runs a folder band from the folder ring to the ring of its children, 300 thick', () => {
    const [a] = named(bandsOf(mixed), 'a', 'folder');
    expect(a.inner).toBe(600);
    expect(a.outer).toBe(900); // files x.ts and y.ts sit 300 beyond a
    for (const b of bandsOf(mixed).filter((x) => x.tier === 'folder')) expect(b.outer - b.inner).toBe(300);
    for (const b of bandsOf(mixed).filter((x) => x.tier === 'file')) expect(b.outer - b.inner).toBe(305);
  });

  it('gives a folder holding both subfolders and files exactly one band, over every symbol beneath it', () => {
    const lib = named(bandsOf(mixed), 'lib', 'folder');
    expect(lib).toHaveLength(1);
    expect([lib[0].inner, lib[0].outer]).toEqual([300, 600]);
    expect(lib[0].symbols.map((s) => s.node.name).sort()).toEqual(['s0', 's1', 's2', 's3']);
    for (const name of ['lib', 'a']) expect(named(bandsOf(mixed), name, 'folder')).toHaveLength(1);
  });

  it('spans a folder band over the angles of the symbols beneath it', () => {
    const bands = bandsOf(mixed);
    const [lib] = named(bands, 'lib', 'folder');
    const files = ['x.ts', 'y.ts', 'b.ts'].map((n) => named(bands, n, 'file')[0]);
    expect(lib.startAngle).toBeCloseTo(Math.min(...files.map((f) => f.startAngle)), 6);
    expect(lib.endAngle).toBeCloseTo(Math.max(...files.map((f) => f.endAngle)), 6);
  });

  it('gives the root no band', () => {
    expect(bandsOf(mixed).some((b) => b.node.node.tier === 'root')).toBe(false);
  });

  it('has no bands without symbols', () => {
    expect(bandsOf(result([]))).toEqual([]);
  });

  it('draws shallower bands first', () => {
    const depths = bandsOf(mixed).map((b) => b.depth);
    expect(depths).toEqual([...depths].sort((p, q) => p - q));
  });

  it('keeps bands that share a ring from overlapping in angle', () => {
    const many = result(Array.from({ length: 60 }, (_, i) => `lib/f${i % 6}.ts`));
    const files = bandsOf(many).filter((b) => b.tier === 'file').sort((p, q) => p.startAngle - q.startAngle);
    for (let i = 1; i < files.length; i++) expect(files[i].startAngle).toBeGreaterThan(files[i - 1].endAngle);
  });
});

describe('band colors', () => {
  const tree = result(['lib/a/x.ts', 'lib/a/y.ts', 'lib/a/z.ts', 'lib/b/p.ts', 'lib/c/q.ts', 'app/m.ts']);
  const hueGap = (p: number, q: number) => Math.min(Math.abs(p - q), 360 - Math.abs(p - q));

  it('keeps a child in the neighbourhood of its parent hue', () => {
    const bands = bandsOf(tree);
    const lib = named(bands, 'lib', 'folder')[0];
    for (const name of ['a', 'b', 'c']) expect(hueGap(named(bands, name, 'folder')[0].hue, lib.hue)).toBeLessThanOrEqual(70);
    const a = named(bands, 'a', 'folder')[0];
    for (const f of ['x.ts', 'y.ts', 'z.ts']) expect(named(bands, f, 'file')[0].hue).toBe(a.hue);
  });

  it('gives sibling subfolders and sibling files different colors', () => {
    const bands = bandsOf(tree);
    const folders = ['a', 'b', 'c'].map((n) => named(bands, n, 'folder')[0].color);
    expect(new Set(folders).size).toBe(3);
    const files = ['x.ts', 'y.ts', 'z.ts'].map((n) => named(bands, n, 'file')[0].color);
    expect(new Set(files).size).toBe(3);
  });

  it('gives different top-level folders clearly different hues', () => {
    const bands = bandsOf(tree);
    expect(hueGap(named(bands, 'lib', 'folder')[0].hue, named(bands, 'app', 'folder')[0].hue)).toBeGreaterThan(60);
  });

  it('makes the first file of a folder lighter than the folder band', () => {
    const bands = bandsOf(tree);
    const lightness = (c: string) => Number(/(\d+(?:\.\d+)?)%\)$/.exec(c)![1]);
    const a = named(bands, 'a', 'folder')[0];
    expect(lightness(named(bands, 'x.ts', 'file')[0].color)).toBeGreaterThan(lightness(a.color));
  });

  it('picks up a changed color rule', () => {
    const config: DisplayConfig = { ...DEFAULT_VIEW_CONFIG, band: { ...DEFAULT_VIEW_CONFIG.band, color: (c) => (c.tier === 'file' ? '#111111' : '#222222'), opacity: 0.5 } };
    const bands = bandsOf(mixed, config);
    expect(bands.filter((b) => b.tier === 'file').every((b) => b.color === '#111111' && b.opacity === 0.5)).toBe(true);
    expect(bands.filter((b) => b.tier === 'folder').every((b) => b.color === '#222222')).toBe(true);
  });
});
