import { buildSignature, cardContent, connectionsView, defaultDirection, kindLabel } from '@/lib/default/card';
import { EdgeKind, SyntaxType } from '@/lib/analysis/types';
import type { DotConnections } from '@/lib/default/types';
import type { HierarchyNode } from '@/lib/default/types';

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

  it('ranks rows by count with direction-specific labels, five names and the remainder', () => {
    const v = connectionsView(conn, 'out', byId);
    expect(v.rows.map((r) => [r.label, r.count])).toEqual([['Calls', 7], ['Uses type', 1]]);
    expect(v.rows[0].names).toHaveLength(5);
    expect(v.rows[0].names[0]).toEqual({ id: 'a', name: 'a', file: 'a.ts' });
    expect(v.rows[0].more).toBe(2);
    expect(v.rows[1].more).toBe(0);
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
});
