import { emphasisedOpacity, emphasisOf, parentMap, sliceOf } from '@/lib/default/hover';
import type { HierarchyNode } from '@/lib/default/types';

const n = (id: string, tier: HierarchyNode['tier'], children: HierarchyNode[] = []): HierarchyNode => ({ id, tier, name: id, path: id, depth: 0, children });
const s1 = n('s1', 'symbol');
const s2 = n('s2', 'symbol');
const x = n('x.ts', 'file', [s1, s2]);
const y = n('y.ts', 'file', [n('s3', 'symbol')]);
const a = n('a', 'folder', [x, y]);
const b = n('b.ts', 'file', [n('s4', 'symbol')]);
const lib = n('lib', 'folder', [a, b]);
const app = n('app', 'folder', [n('m.ts', 'file', [n('s5', 'symbol')])]);
const root = n('root', 'root', [lib, app]);
const parents = parentMap(root);

describe('sliceOf', () => {
  it('takes a hovered folder, its ancestors and everything beneath it', () => {
    const slice = sliceOf(a, parents);
    expect([...slice.chain].sort()).toEqual(['a', 'lib']);
    expect([...slice.below].sort()).toEqual(['x.ts', 'y.ts']);
  });

  it('takes a hovered file and its ancestors only', () => {
    const slice = sliceOf(x, parents);
    expect([...slice.chain].sort()).toEqual(['a', 'lib', 'x.ts']);
    expect(slice.below.size).toBe(0);
  });

  it('takes a hovered symbol as its file band and the ancestors above', () => {
    expect([...sliceOf(s1, parents).chain].sort()).toEqual(['a', 'lib', 'x.ts']);
  });

  it('never includes the root', () => {
    expect(sliceOf(lib, parents).chain.has('root')).toBe(false);
    expect(sliceOf(app, parents).chain.has('root')).toBe(false);
  });
});

describe('emphasis', () => {
  const slice = sliceOf(lib, parents);
  it('labels bands as slice, descendant or rest', () => {
    expect(emphasisOf('lib', slice)).toBe('slice');
    expect(emphasisOf('a', slice)).toBe('descendant');
    expect(emphasisOf('app', slice)).toBe('rest');
  });

  it('scales the resting opacity and caps it at 1', () => {
    expect(emphasisedOpacity(0.3, 'lib', slice)).toBeCloseTo(0.435);
    expect(emphasisedOpacity(0.3, 'a', slice)).toBeCloseTo(0.36);
    expect(emphasisedOpacity(0.3, 'app', slice)).toBeCloseTo(0.15);
    expect(emphasisedOpacity(0.9, 'lib', slice)).toBe(1);
    expect(emphasisedOpacity(0.3, 'app', null)).toBe(0.3);
  });
});
