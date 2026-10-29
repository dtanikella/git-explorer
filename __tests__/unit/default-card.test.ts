import { buildSignature, cardContent, connectionsView, defaultDirection, groupByLocation, kindLabel } from '@/lib/default/card';
import { EdgeKind, SyntaxType } from '@/lib/analysis/types';
import type { DotConnections } from '@/lib/default/types';
import type { HierarchyNode } from '@/lib/default/types';
import { rollupDiff } from '@/lib/default/diff';

const sym = (name: string, type: SyntaxType = SyntaxType.FUNCTION, over: Partial<NonNullable<HierarchyNode['symbol']>> = {}): HierarchyNode => ({
  id: name, tier: 'symbol', name, path: 'x.ts', depth: 4, children: [], symbol: { syntaxType: type, params: [], returnTypeText: null, ...over },
});
const node = (id: string, tier: HierarchyNode['tier'], children: HierarchyNode[] = []): HierarchyNode => ({ id, tier, name: id, path: id, depth: 0, children });

describe('buildSignature', () => {
  it('assembles params and return type', () => {
    const n = sym('getCachedIndex', SyntaxType.FUNCTION, {
      params: [{ name: 'repoPath', typeText: 'string', isOptional: false }, { name: 'n', typeText: 'number', isOptional: true }],
      returnTypeText: 'Promise<CacheResult | null>',
    });
    expect(buildSignature(n)).toBe('function getCachedIndex(repoPath: string, n?: number): Promise<CacheResult | null>');
  });

  it('handles no params, an untyped param and no return type', () => {
    expect(buildSignature(sym('f'))).toBe('function f()');
    expect(buildSignature(sym('f', SyntaxType.FUNCTION, { params: [{ name: 'a', typeText: null, isOptional: false }] }))).toBe('function f(a)');
  });

  it('uses a keyword and name for non-function kinds', () => {
    expect(buildSignature(sym('Area', SyntaxType.INTERFACE))).toBe('interface Area');
    expect(buildSignature(sym('T', SyntaxType.TYPE_ALIAS))).toBe('type T');
  });
});

describe('kindLabel', () => {
  it('is the syntax type of a symbol and the tier otherwise', () => {
    expect(kindLabel(sym('f'))).toBe('function');
    expect(kindLabel(node('d', 'folder'))).toBe('folder');
  });
});

describe('cardContent', () => {
  const f1 = sym('f1');
  const c1 = sym('C1', SyntaxType.CLASS);
  const f2 = sym('f2');
  const x = node('x.ts', 'file', [f1, c1, f2]);
  const y = node('y.ts', 'file', [sym('g')]);
  const analysis = node('analysis', 'folder', [x, y]);
  const lib = node('lib', 'folder', [analysis, node('z.ts', 'file', [sym('h')])]);
  const root = node('root', 'root', [lib]);

  it('describes a symbol with its signature and position, breadcrumb of its ancestors', () => {
    const c = cardContent(c1, root);
    expect(c).toMatchObject({ breadcrumb: 'lib › analysis › x.ts', name: 'C1', signature: 'class C1', position: '2nd of 3 symbols' });
    expect(c.pill.label).toBe('class');
    expect(c.pill.color).not.toBeNull();
    expect(cardContent(f1, root).position).toBe('1st of 3 symbols');
  });

  it('describes a file with symbols, kinds, share of its folder and the kind mix', () => {
    const c = cardContent(x, root);
    expect(c.breadcrumb).toBe('lib › analysis');
    expect(c.pill).toEqual({ label: 'file', color: null });
    expect(c.tiles).toEqual([{ label: 'symbols', value: '3' }, { label: 'kinds', value: '2' }, { label: 'of folder', value: '75%' }]);
    expect(c.kindMix.map((k) => [k.kind, k.count])).toEqual([['function', 2], ['class', 1]]);
  });

  it('describes a folder with counts of folders, files and symbols', () => {
    const c = cardContent(lib, root);
    expect(c.breadcrumb).toBe('repo root');
    expect(c.tiles).toEqual([{ label: 'folders', value: '1' }, { label: 'files', value: '3' }, { label: 'symbols', value: '5' }]);
    expect(c.pill.label).toBe('folder');
  });

  it('cuts a long breadcrumb from the left', () => {
    const deep = node('deep.ts', 'file', [sym('q')]);
    const names = ['alpha-folder', 'bravo-folder', 'charlie-folder', 'delta-folder'];
    const chain = names.reduceRight((child, name) => node(name, 'folder', [child]), deep);
    const c = cardContent(deep, node('root', 'root', [chain]));
    expect(c.breadcrumb.length).toBeLessThanOrEqual(34);
    expect(c.breadcrumb.startsWith('…')).toBe(true);
    expect(c.breadcrumb.endsWith('delta-folder')).toBe(true);
  });
});

describe('connectionsView', () => {
  const byId = new Map(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => [id, { ...sym(id), path: `src/${id}.ts` }]));
  const conn: DotConnections = {
    out: new Map([[EdgeKind.CALLS, ['a', 'b', 'c', 'd', 'e', 'f', 'g']], [EdgeKind.USES_TYPE, ['a']]]),
    in: new Map([[EdgeKind.IMPORTS, ['b']]]),
    undrawn: 2,
  };

  it('ranks rows by count with direction-specific labels and lists every symbol by location', () => {
    const v = connectionsView(conn, 'out', byId);
    expect(v.rows.map((r) => [r.label, r.count])).toEqual([['Calls', 7], ['Uses type', 1]]);
    expect(v.rows[0].locations).toHaveLength(1);
    expect(v.rows[0].locations[0]).toMatchObject({ label: 'src/', kind: 'folder', count: 7 });
    expect(v.undrawn).toBe(2);
  });

  it('counts distinct connected symbols per direction and omits kinds with none', () => {
    expect(connectionsView(conn, 'out', byId).counts).toEqual({ out: 7, in: 1 });
    const incoming = connectionsView(conn, 'in', byId);
    expect(incoming.rows.map((r) => r.label)).toEqual(['Imported by']);
  });

  it('has no rows for a symbol without connections', () => {
    expect(connectionsView(undefined, 'out', byId)).toMatchObject({ rows: [], counts: { out: 0, in: 0 }, undrawn: 0 });
  });
});

describe('defaultDirection', () => {
  it('opens on out, or on in when nothing leaves the symbol', () => {
    expect(defaultDirection({ out: new Map([[EdgeKind.CALLS, ['a']]]), in: new Map(), undrawn: 0 })).toBe('out');
    expect(defaultDirection({ out: new Map(), in: new Map([[EdgeKind.CALLS, ['a']]]), undrawn: 0 })).toBe('in');
    expect(defaultDirection(undefined)).toBe('out');
  });

  describe('in diff mode', () => {
    const d = (n: HierarchyNode, diffStatus: NonNullable<HierarchyNode['diffStatus']>, ghost = false): HierarchyNode => ({ ...n, diffStatus, ...(ghost && { ghost }) });
    const added = d(sym('a'), 'added');
    const ghost = d(sym('gone'), 'deleted', true);
    const same = d(sym('same'), 'unchanged');
    const file = node('x.ts', 'file', [added, same, ghost]);
    const diffRoot = node('root', 'root', [file]);
    const rollups = rollupDiff(diffRoot);

    it('adds a status pill and a changed count to a changed symbol', () => {
      const c = cardContent(added, diffRoot, rollups);
      expect(c.status).toMatchObject({ label: 'Added' });
      expect(c.position).toBe('1st of 3 symbols in file · 2 changed');
      expect(c.ghostNote).toBeUndefined();
    });

    it('shows no pill on an unchanged symbol but still gives the changed count', () => {
      const c = cardContent(same, diffRoot, rollups);
      expect(c.status).toBeUndefined();
      expect(c.position).toBe('2nd of 3 symbols in file · 2 changed');
    });

    it('marks a deleted ghost with the base-commit note', () => {
      const c = cardContent(ghost, diffRoot, rollups);
      expect(c.status).toMatchObject({ label: 'Deleted' });
      expect(c.ghostNote).toBe('Shown from the base commit');
    });

    it('is unchanged when diff mode is off', () => {
      const c = cardContent(added, diffRoot);
      expect(c.status).toBeUndefined();
      expect(c.ghostNote).toBeUndefined();
      expect(c.position).toBe('1st of 3 symbols');
    });
  });
});

describe('groupByLocation', () => {
  const at = (id: string, path: string): [string, HierarchyNode] => [id, { ...sym(id), path }];
  const byId = new Map([
    at('a', 'lib/default/layout.ts'),
    at('b', 'lib/default/layout.ts'),
    at('c', 'lib/default/types.ts'),
    at('d', 'lib/git/analyzer.ts'),
    at('e', 'app/page.tsx'),
    at('f', 'main.ts'),
  ]);

  it('nests folders then files then symbols, folders first and each alphabetical, and counts what is under each', () => {
    const g = groupByLocation(['f', 'e', 'd', 'c', 'b', 'a'], byId);
    expect(g.map((x) => [x.label, x.kind, x.count])).toEqual([['app/', 'folder', 1], ['lib/', 'folder', 4], ['main.ts', 'file', 1]]);
    const lib = g.find((x) => x.label === 'lib/')!;
    expect(lib.children.map((x) => [x.label, x.count])).toEqual([['default/', 3], ['git/', 1]]);
    expect(lib.children[0].children.map((x) => x.label)).toEqual(['layout.ts', 'types.ts']);
    expect(lib.children[0].children[0].symbols.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('joins a folder that holds only one folder to it', () => {
    const g = groupByLocation(['a', 'c'], new Map([at('a', 'lib/default/layout.ts'), at('c', 'lib/default/types.ts')]));
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ label: 'lib/default/', key: 'lib/default', count: 2 });
  });

  it('puts a file at the top level when it is in no folder', () => {
    expect(groupByLocation(['f'], byId)).toMatchObject([{ label: 'main.ts', kind: 'file', symbols: [{ id: 'f' }] }]);
  });
});
