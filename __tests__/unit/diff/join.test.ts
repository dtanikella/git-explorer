import { joinDiffToAnalysis, countDiff } from '@/lib/diff/join';
import type { AnalysisResult, AnalysisNode } from '@/lib/analysis/types';
import type { LabelledDeclaration, GitAnalysisResult } from '@/lib/diff/types';
import { SyntaxType } from '@/lib/analysis/types';

function makeNode(overrides: Partial<AnalysisNode> & { filePath: string; startLine: number; startCol: number }): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name: 'test',
    isAsync: false,
    isExported: false,
    params: [],
    returnTypeText: null,
    scipSymbol: 'local 0',
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
    ...overrides,
  };
}

function makeResult(nodes: AnalysisNode[]): AnalysisResult {
  return {
    nodes,
    edges: [],
    metadata: {
      repoPath: '/test',
      language: 'typescript',
      nodeCount: nodes.length,
      edgeCount: 0,
      analysisDurationMs: 10,
      missingNodeTypes: [],
      missingEdgeKinds: [],
    },
  };
}

function makeLabel(key: string, status: 'added' | 'deleted' | 'modified' | 'unchanged', side: 'old' | 'new', absorbedBy: number | null = null): LabelledDeclaration {
  const [path, rowStr, colStr] = key.split(':');
  return {
    unit: {
      side,
      path,
      index: 0,
      kind: SyntaxType.FUNCTION,
      name: 'test',
      qualifiedName: 'test',
      namePos: { row: parseInt(rowStr), column: parseInt(colStr) },
      start: { row: parseInt(rowStr), column: parseInt(colStr) },
      end: { row: parseInt(rowStr), column: parseInt(colStr) + 10 },
      parentIndex: null,
      absorbedBy,
    },
    status,
  };
}

describe('joinDiffToAnalysis', () => {
  const baseSha = 'aaaaaa';
  const headSha = 'bbbbbb';

  it('covers added, modified, unchanged, deleted, and unmatched declarations', () => {
    // Head nodes: file1.ts at (0, 0) -> added, (0, 10) -> modified, (0, 20) -> unchanged
    // Base nodes: file1.ts at (0, 0) -> added will match, (0, 30) -> deleted
    // Head has node at (0, 20) that has no label -> unchanged
    const headNode = makeNode({ filePath: 'file1.ts', startLine: 0, startCol: 0, name: 'addedNode' });
    const modifiedNode = makeNode({ filePath: 'file1.ts', startLine: 0, startCol: 10, name: 'modifiedNode' });
    const unchangedNode = makeNode({ filePath: 'file1.ts', startLine: 0, startCol: 20, name: 'unchangedNode' });
    const baseNode = makeNode({ filePath: 'file1.ts', startLine: 0, startCol: 30, name: 'deletedNode' });

    const head = makeResult([headNode, modifiedNode, unchangedNode]);
    const base = makeResult([headNode, baseNode]);

    const labels: LabelledDeclaration[] = [
      makeLabel('file1.ts:0:0', 'added', 'new'),
      makeLabel('file1.ts:0:10', 'modified', 'new'),
      makeLabel('file1.ts:0:30', 'deleted', 'old'),
      makeLabel('file1.ts:0:50', 'added', 'new'), // unmatched
    ];

    const { result, unmatched } = joinDiffToAnalysis(labels, head, base, {
      base: baseSha,
      head: headSha,
    });

    expect(result.base).toBe(baseSha);
    expect(result.head).toBe(headSha);
    expect(result.edges).toEqual(head.edges);
    expect(result.metadata).toEqual(head.metadata);

    // Check node statuses
    const addedResult = result.nodes.find(n => n.name === 'addedNode');
    expect(addedResult?.diffStatus).toBe('added');
    expect(addedResult?.ghost).toBeUndefined();

    const modifiedResult = result.nodes.find(n => n.name === 'modifiedNode');
    expect(modifiedResult?.diffStatus).toBe('modified');

    const unchangedResult = result.nodes.find(n => n.name === 'unchangedNode');
    expect(unchangedResult?.diffStatus).toBe('unchanged');

    const deletedResult = result.nodes.find(n => n.name === 'deletedNode');
    expect(deletedResult?.diffStatus).toBe('deleted');
    expect(deletedResult?.ghost).toBe(true);
    expect(deletedResult?.referencedAt).toEqual([]);
    expect(deletedResult?.outboundRefs).toEqual([]);

    // Check unmatched
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].unit.namePos.row).toBe(0);
    expect(unmatched[0].unit.namePos.column).toBe(50);
  });

  it('skips deleted absorbed units (no ghost)', () => {
    // Head has 'a' (function), base has 'a' and 't' (absorbed inside a)
    const headA = makeNode({ filePath: 'f.ts', startLine: 0, startCol: 0, name: 'a' });
    const baseA = makeNode({ filePath: 'f.ts', startLine: 0, startCol: 0, name: 'a' });
    const baseT = makeNode({ filePath: 'f.ts', startLine: 0, startCol: 12, name: 't' });

    const head = makeResult([headA]);
    const base = makeResult([baseA, baseT]);

    const labels: LabelledDeclaration[] = [
      // a on old side paired -> unchanged
      makeLabel('f.ts:0:0', 'unchanged', 'old'),
      makeLabel('f.ts:0:0', 'unchanged', 'new'),
      // t on old side, absorbedBy=0 (absorbed by 'a'), status deleted -> should NOT create ghost
      // We need to create a label for t
    ];
    const tLabel: LabelledDeclaration = {
      unit: {
        side: 'old',
        path: 'f.ts',
        index: 1,
        kind: SyntaxType.VARIABLE,
        name: 't',
        qualifiedName: 'a.t',
        namePos: { row: 0, column: 12 },
        start: { row: 0, column: 12 },
        end: { row: 0, column: 20 },
        parentIndex: 0,
        absorbedBy: 0,
      },
      status: 'deleted',
    };
    labels.push(tLabel);

    const { result } = joinDiffToAnalysis(labels, head, base, {
      base: baseSha,
      head: headSha,
    });

    // 't' should NOT appear as a ghost
    const tResult = result.nodes.find(n => n.name === 't');
    expect(tResult).toBeUndefined();
  });

  it('prefixes ghost symbol when same symbol exists in head', () => {
    // Both head and base have a node with same scipSymbol at different positions
    const headNode = makeNode({
      filePath: 'h.ts',
      startLine: 5,
      startCol: 0,
      scipSymbol: 'symb://same',
      name: 'headSym',
    });
    const baseNode = makeNode({
      filePath: 'b.ts',
      startLine: 0,
      startCol: 0,
      scipSymbol: 'symb://same',
      name: 'baseSym',
    });

    const head = makeResult([headNode]);
    const base = makeResult([baseNode]);

    const labels: LabelledDeclaration[] = [
      makeLabel('b.ts:0:0', 'deleted', 'old'),
    ];

    const { result } = joinDiffToAnalysis(labels, head, base, {
      base: baseSha,
      head: headSha,
    });

    // The ghost should be present
    const ghost = result.nodes.find(n => n.name === 'baseSym');
    expect(ghost).toBeDefined();
    expect(ghost!.ghost).toBe(true);
    expect(ghost!.diffStatus).toBe('deleted');
    // referencedAt and outboundRefs should be empty
    expect(ghost!.referencedAt).toEqual([]);
    expect(ghost!.outboundRefs).toEqual([]);
  });
});

describe('countDiff', () => {
  it('counts added, modified, and deleted nodes', () => {
    const result: GitAnalysisResult = {
      nodes: [
        { diffStatus: 'added' } as any,
        { diffStatus: 'added' } as any,
        { diffStatus: 'modified' } as any,
        { diffStatus: 'deleted' } as any,
        { diffStatus: 'deleted' } as any,
        { diffStatus: 'deleted' } as any,
        { diffStatus: 'unchanged' } as any,
      ],
      edges: [],
      metadata: {} as any,
      base: '',
      head: '',
    };

    const counts = countDiff(result);
    expect(counts.added).toBe(2);
    expect(counts.modified).toBe(1);
    expect(counts.deleted).toBe(3);
  });
});