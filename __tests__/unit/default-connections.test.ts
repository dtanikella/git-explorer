import { EdgeKind } from '@/lib/analysis/types';
import type { AnalysisEdge } from '@/lib/analysis/types';
import { buildConnections, distinctConnected, rankedKinds } from '@/lib/default/connections';

const PKG = 'scip-typescript npm p 1 ';
const sym = (name: string) => `${PKG}src/\`a.ts\`/${name}`;
const A = sym('A#');
const B = sym('B#');
const C = sym('C().');
const DOTS = new Set([A, B, C]);

const edge = (kind: EdgeKind, fromSymbol: string, toSymbol: string, over: Partial<AnalysisEdge> = {}): AnalysisEdge => ({
  kind, fromFile: 'a.ts', fromName: '', fromSymbol, toText: '', toFile: 'a.ts', toName: '', toSymbol,
  isExternal: false, isAmbiguous: false, edgePosition: { line: 0, col: 0 }, isOptionalChain: false, isAsync: false, ...over,
});

describe('buildConnections', () => {
  it('records an edge in both directions', () => {
    const m = buildConnections([edge(EdgeKind.CALLS, C, A)], DOTS);
    expect(m.edges).toEqual([{ kind: EdgeKind.CALLS, from: C, to: A }]);
    expect(m.byDot.get(C)!.out.get(EdgeKind.CALLS)).toEqual([A]);
    expect(m.byDot.get(A)!.in.get(EdgeKind.CALLS)).toEqual([C]);
  });

  it('rolls members up to their owner', () => {
    const m = buildConnections([edge(EdgeKind.CALLS, `${A}run().`, `${B}<constructor>().`)], DOTS);
    expect(m.edges).toEqual([{ kind: EdgeKind.CALLS, from: A, to: B }]);
  });

  it('rolls a nested owner up to the nearest owner that has a dot', () => {
    const m = buildConnections([edge(EdgeKind.CALLS, C, `${A}Inner#go().`)], DOTS);
    expect(m.edges).toEqual([{ kind: EdgeKind.CALLS, from: C, to: A }]);
  });

  it('drops self-edges, including those that only become self-edges after roll-up', () => {
    const m = buildConnections([edge(EdgeKind.CALLS, A, A), edge(EdgeKind.CALLS, `${A}a().`, `${A}b().`)], DOTS);
    expect(m.edges).toEqual([]);
    expect(m.byDot.size).toBe(0);
  });

  it('collapses duplicate edges of the same kind but keeps other kinds apart', () => {
    const m = buildConnections(
      [edge(EdgeKind.CALLS, C, A), edge(EdgeKind.CALLS, C, `${A}x().`), edge(EdgeKind.USES_TYPE, C, A)],
      DOTS,
    );
    expect(m.edges).toHaveLength(2);
    expect(rankedKinds(m.byDot.get(C), 'out')).toEqual([{ kind: EdgeKind.CALLS, count: 1 }, { kind: EdgeKind.USES_TYPE, count: 1 }]);
  });

  it('draws INCLUDES like any other kind', () => {
    const m = buildConnections([edge(EdgeKind.INCLUDES, A, B)], DOTS);
    expect(m.byDot.get(B)!.in.get(EdgeKind.INCLUDES)).toEqual([A]);
  });

  it('counts external, unresolved and dot-less edges as undrawn on the end that has a dot', () => {
    const m = buildConnections(
      [
        edge(EdgeKind.CALLS, A, 'npm other 1 x/foo().', { isExternal: true }),
        edge(EdgeKind.CALLS, A, ''),
        edge(EdgeKind.CALLS, A, sym('Gone#')),
        edge(EdgeKind.CALLS, sym('Gone#'), B),
        edge(EdgeKind.CALLS, sym('Gone#'), sym('Gone2#')),
      ],
      DOTS,
    );
    expect(m.byDot.get(A)!.undrawn).toBe(3);
    expect(m.byDot.get(B)!.undrawn).toBe(1);
    expect(m.edges).toEqual([]);
  });

  it('adds dropped external edge counts to undrawn after rolling up to a dot', () => {
    const m = buildConnections([edge(EdgeKind.CALLS, A, B)], DOTS, { [`${A}run().`]: 2, [C]: 1, [sym('Gone#')]: 5 });
    expect(m.byDot.get(A)!.undrawn).toBe(2);
    expect(m.byDot.get(C)!.undrawn).toBe(1);
    expect(m.byDot.get(B)!.undrawn).toBe(0);
    expect(m.edges).toEqual([{ kind: EdgeKind.CALLS, from: A, to: B }]);
  });
});

describe('rankedKinds and distinctConnected', () => {
  const m = buildConnections(
    [edge(EdgeKind.CALLS, A, B), edge(EdgeKind.CALLS, A, C), edge(EdgeKind.USES_TYPE, A, B), edge(EdgeKind.IMPORTS, C, A)],
    DOTS,
  );

  it('ranks kinds by count and leaves out kinds with none in that direction', () => {
    expect(rankedKinds(m.byDot.get(A), 'out')).toEqual([{ kind: EdgeKind.CALLS, count: 2 }, { kind: EdgeKind.USES_TYPE, count: 1 }]);
    expect(rankedKinds(m.byDot.get(A), 'in')).toEqual([{ kind: EdgeKind.IMPORTS, count: 1 }]);
    expect(rankedKinds(undefined, 'out')).toEqual([]);
  });

  it('counts distinct connected symbols across kinds', () => {
    expect(distinctConnected(m.byDot.get(A), 'out')).toBe(2);
    expect(distinctConnected(m.byDot.get(A), 'in')).toBe(1);
    expect(distinctConnected(undefined, 'in')).toBe(0);
  });
});
