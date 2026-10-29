import { rollupDiff } from '@/lib/default/diff';
import type { HierarchyNode } from '@/lib/default/types';

const sym = (id: string, diffStatus?: HierarchyNode['diffStatus']): HierarchyNode => ({ id, tier: 'symbol', name: id, path: '', depth: 4, children: [], ...(diffStatus && { diffStatus }) });
const node = (id: string, tier: HierarchyNode['tier'], children: HierarchyNode[]): HierarchyNode => ({ id, tier, name: id, path: id, depth: 0, children });

describe('rollupDiff', () => {
  const a = node('a.ts', 'file', [sym('1', 'added'), sym('2', 'added'), sym('3', 'modified'), sym('4', 'unchanged'), sym('5', 'deleted')]);
  const b = node('b.ts', 'file', [sym('6', 'unchanged'), sym('7')]);
  const c = node('c.ts', 'file', [sym('8', 'modified')]);
  const lib = node('lib', 'folder', [a, b]);
  const other = node('other', 'folder', [node('d.ts', 'file', [sym('9', 'unchanged')])]);
  const root = node('root', 'root', [lib, other, c]);

  it('counts added, modified and deleted symbols per changed file', () => {
    const { byFile } = rollupDiff(root);
    expect(byFile.get('a.ts')).toEqual({ added: 2, modified: 1, deleted: 1, changed: 4 });
    expect(byFile.get('c.ts')).toEqual({ added: 0, modified: 1, deleted: 0, changed: 1 });
    expect([...byFile.keys()].sort()).toEqual(['a.ts', 'c.ts']);
  });

  it('counts every changed symbol overall, leaving out unchanged and unmarked ones', () => {
    expect(rollupDiff(root).changed).toBe(5);
  });

  it('lists the files and folders that have a change beneath them', () => {
    expect([...rollupDiff(root).changedIds].sort()).toEqual(['a.ts', 'c.ts', 'lib', 'root']);
  });

  it('is empty for a hierarchy with no changes', () => {
    expect(rollupDiff(node('root', 'root', [other]))).toEqual({ byFile: new Map(), changedIds: new Set(), changed: 0 });
  });
});
