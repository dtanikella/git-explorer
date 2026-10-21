import { fuzzyMatch, highlightRuns, searchSymbols } from '@/lib/default/search';
import { SyntaxType } from '@/lib/analysis/types';
import type { HierarchyNode } from '@/lib/default/types';

const sym = (name: string, path = 'lib/x.ts'): HierarchyNode => ({
  id: `${path}#${name}`, tier: 'symbol', name, path, depth: 4, children: [], symbol: { syntaxType: SyntaxType.FUNCTION, params: [], returnTypeText: null },
});
const names = (rs: { node: HierarchyNode }[]) => rs.map((r) => r.node.name);

describe('fuzzyMatch', () => {
  it('matches a contiguous substring and reports its positions', () => {
    expect(fuzzyMatch('hier', 'buildHierarchy')?.positions).toEqual([5, 6, 7, 8]);
  });

  it('matches camelCase initials as a subsequence', () => {
    expect(fuzzyMatch('bldh', 'buildHierarchy')?.positions).toEqual([0, 3, 4, 5]);
  });

  it('returns null when the characters are not all there in order', () => {
    expect(fuzzyMatch('hb', 'buildHierarchy')).toBeNull();
    expect(fuzzyMatch('xyz', 'buildHierarchy')).toBeNull();
    expect(fuzzyMatch('', 'anything')).toBeNull();
  });

  it('scores a prefix above the same substring in the middle', () => {
    expect(fuzzyMatch('area', 'areaPair')!.score).toBeGreaterThan(fuzzyMatch('area', 'getArea')!.score);
  });

  it('scores a word-start substring above one inside a word', () => {
    expect(fuzzyMatch('tree', 'selectionTree')!.score).toBeGreaterThan(fuzzyMatch('tree', 'streeter')!.score);
  });

  it('scores tight subsequences above scattered ones', () => {
    expect(fuzzyMatch('abc', 'axbxc')!.score).toBeLessThan(fuzzyMatch('abc', 'abxxc')!.score);
  });
});

describe('searchSymbols', () => {
  const all = [sym('buildHierarchy', 'lib/default/adapter.ts'), sym('buildDirectoryHubs', 'lib/graph/hubs.ts'), sym('areaPair', 'lib/areas/pairs.ts'), sym('getArea', 'lib/areas/get.ts'), sym('SelectionTree', 'app/components/selection/SelectionTree.tsx')];

  it('matches nothing for a blank query', () => {
    expect(searchSymbols(all, '')).toEqual([]);
    expect(searchSymbols(all, '   ')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(names(searchSymbols(all, 'SELECTIONTREE'))).toEqual(['SelectionTree']);
  });

  it('finds a symbol by its camelCase initials', () => {
    expect(names(searchSymbols(all, 'bldh'))[0]).toBe('buildHierarchy');
  });

  it('ranks a prefix match above a mid-word match', () => {
    expect(names(searchSymbols(all, 'area'))).toEqual(['areaPair', 'getArea']);
  });

  it('requires every token to match the name or the path', () => {
    expect(names(searchSymbols(all, 'tree selection'))).toEqual(['SelectionTree']);
    expect(names(searchSymbols(all, 'lib hubs'))).toEqual(['buildDirectoryHubs']);
    expect(searchSymbols(all, 'hubs nonsense')).toEqual([]);
  });

  it('matches on the path alone, with nothing highlighted in the name', () => {
    const rs = searchSymbols(all, 'adapter');
    expect(names(rs)).toEqual(['buildHierarchy']);
    expect(rs[0].namePositions).toEqual([]);
  });

  it('weights a name hit above the same hit in the path', () => {
    const rs = searchSymbols([sym('other', 'lib/pairs.ts'), sym('pairs', 'lib/other.ts')], 'pairs');
    expect(names(rs)).toEqual(['pairs', 'other']);
  });

  it('breaks ties by shorter name, then alphabetically', () => {
    const rs = searchSymbols([sym('fooBb'), sym('fooA'), sym('fooB')], 'foo');
    expect(names(rs)).toEqual(['fooA', 'fooB', 'fooBb']);
  });

  it('merges the name positions of several tokens', () => {
    expect(searchSymbols([sym('buildHierarchy')], 'bui hier')[0].namePositions).toEqual([0, 1, 2, 5, 6, 7, 8]);
  });
});

describe('highlightRuns', () => {
  it('splits text into matched and unmatched runs', () => {
    expect(highlightRuns('buildHierarchy', [0, 1, 5])).toEqual([
      { text: 'bu', match: true },
      { text: 'ild', match: false },
      { text: 'H', match: true },
      { text: 'ierarchy', match: false },
    ]);
  });

  it('returns one unmatched run when nothing matched, and none for empty text', () => {
    expect(highlightRuns('abc', [])).toEqual([{ text: 'abc', match: false }]);
    expect(highlightRuns('', [])).toEqual([]);
  });
});
