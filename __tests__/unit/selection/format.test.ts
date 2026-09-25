import { formatCopyText } from '@/lib/selection/format';
import type { AnalysisNode } from '@/lib/analysis/types';
import { SyntaxType } from '@/lib/analysis/types';

function makeNode(sym: string, name: string, filePath: string): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name,
    filePath,
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: sym,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  };
}

describe('formatCopyText', () => {
  it('formats a single node as filePath#name', () => {
    const nodes = [makeNode('sym:a', 'funcA', 'src/a.ts')];
    expect(formatCopyText(nodes)).toBe('src/a.ts#funcA');
  });

  it('sorts multiple nodes by file path then name', () => {
    const nodes = [
      makeNode('sym:c', 'funcC', 'src/b.ts'),
      makeNode('sym:a', 'funcA', 'src/a.ts'),
      makeNode('sym:b', 'funcB', 'src/a.ts'),
    ];
    expect(formatCopyText(nodes)).toBe('src/a.ts#funcA\nsrc/a.ts#funcB\nsrc/b.ts#funcC');
  });

  it('returns empty string for empty array', () => {
    expect(formatCopyText([])).toBe('');
  });

  it('deduplicates nodes with same filePath and name', () => {
    const nodes = [
      makeNode('sym:a', 'funcA', 'src/a.ts'),
      makeNode('sym:a', 'funcA', 'src/a.ts'),
    ];
    expect(formatCopyText(nodes)).toBe('src/a.ts#funcA');
  });
});