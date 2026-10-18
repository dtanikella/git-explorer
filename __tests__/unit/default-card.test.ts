import { buildSignature, cardContent, kindLabel } from '@/lib/default/card';
import { SyntaxType } from '@/lib/analysis/types';
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
