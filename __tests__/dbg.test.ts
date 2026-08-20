import { buildCommunityGraph } from '@/lib/analysis/communities/graph';
import { computeCrossCommunityWeight } from '@/lib/analysis/communities/metrics';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';
const mk = (id: string): any => ({ syntaxType: SyntaxType.FUNCTION, name: id, filePath: `/s/${id}.ts`, startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, scipSymbol: id, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] });
const me = (f: string, t: string): any => ({ kind: EdgeKind.CALLS, fromFile: `/s/${f}.ts`, fromName: f, fromSymbol: f, toText: t, toFile: `/s/${t}.ts`, toName: t, toSymbol: t, isExternal: false, edgePosition: { line: 1, col: 0 }, isOptionalChain: false, isAsync: false });
describe('dbg', () => {
  it('debug', () => {
    const graph = buildCommunityGraph(['a','b','c','d'].map(mk), [me('a','c')]);
    const communityOf = new Map([['a','C1'],['b','C1'],['c','C2'],['d','C2']]);
    const w = computeCrossCommunityWeight(graph, communityOf);
    console.log('DBG weights=', JSON.stringify(Object.fromEntries(w)), 'size', graph.size, 'nodes keys', JSON.stringify(Array.from(graph.nodes())));
  });
});
