import { commonAncestor, treeCurve, treePath } from '@/lib/default/edge-arc';
import { parentMap } from '@/lib/default/hover';
import type { HierarchyNode } from '@/lib/default/types';

const n = (id: string, tier: HierarchyNode['tier'], children: HierarchyNode[] = []): HierarchyNode => ({ id, tier, name: id, path: id, depth: 0, children });
const s1 = n('s1', 'symbol');
const s2 = n('s2', 'symbol');
const s3 = n('s3', 'symbol');
const s4 = n('s4', 'symbol');
const x = n('x.ts', 'file', [s1, s2]);
const y = n('y.ts', 'file', [s3]);
const a = n('a', 'folder', [x, y]);
const z = n('z.ts', 'file', [s4]);
const lib = n('lib', 'folder', [a, z]);
const root = n('root', 'root', [lib]);
const parents = parentMap(root);

const at = (node: HierarchyNode, px: number, py: number) => ({ node, x: px, y: py });
const positions = new Map([
  ['x.ts', { x: 0, y: -100 }],
  ['a', { x: 10, y: -50 }],
  ['lib', { x: 20, y: -20 }],
  ['root', { x: 0, y: 0 }],
]);

describe('commonAncestor', () => {
  it('is the file for two symbols of one file', () => expect(commonAncestor(s1, s2, parents)).toBe(x));
  it('is the folder holding both files for symbols of different files', () => expect(commonAncestor(s1, s3, parents)).toBe(a));
  it('climbs as far as the hierarchy needs', () => expect(commonAncestor(s1, s4, parents)).toBe(lib));
});

describe('treePath', () => {
  const ids = (p: HierarchyNode[] | null) => p?.map((x) => x.id);
  it('goes up to the file and back down for symbols of one file', () => expect(ids(treePath(s1, s2, parents))).toEqual(['s1', 'x.ts', 's2']));
  it('crosses both files and the folder between them', () => expect(ids(treePath(s1, s3, parents))).toEqual(['s1', 'x.ts', 'a', 'y.ts', 's3']));
  it('climbs as far as the hierarchy needs', () => expect(ids(treePath(s1, s4, parents))).toEqual(['s1', 'x.ts', 'a', 'lib', 'z.ts', 's4']));
});

describe('treeCurve', () => {
  const positions = new Map([
    ['x.ts', { x: 0, y: -100 }],
    ['y.ts', { x: 80, y: -90 }],
    ['a', { x: 10, y: -50 }],
  ]);
  // every segment is "C c1x c1y c2x c2y x y"; the last pair is a node the curve passes through
  const through = (d: string) => d.split('C').slice(1).map((seg) => seg.trim().split(/\s+/).slice(-2).map(Number));

  it('passes exactly through every node on the way', () => {
    const { d } = treeCurve(at(s1, -30, -200), at(s3, 90, -180), parents, positions);
    expect(d.startsWith('M -30 -200')).toBe(true);
    expect(through(d)).toEqual([[0, -100], [10, -50], [80, -90], [90, -180]]);
  });

  it('tops out on the file for symbols in the same file', () => {
    const { d } = treeCurve(at(s1, -30, -200), at(s2, 30, -200), parents, positions);
    expect(through(d)).toEqual([[0, -100], [30, -200]]);
  });

  it('leaves the end tangent pointing from the last control point to the end', () => {
    const { tail } = treeCurve(at(s1, -30, -200), at(s2, 30, -200), parents, positions);
    expect(tail.x).toBeLessThan(30);
  });

  it('is a straight line when a node has no position', () => {
    expect(treeCurve(at(s1, 0, 0), at(s3, 10, 20), parents, new Map()).d).toBe('M 0 0 L 10 20');
  });
});
