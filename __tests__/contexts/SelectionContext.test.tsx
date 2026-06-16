import React from 'react';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SelectionProvider, useSelection } from '@/app/contexts/SelectionContext';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';

function makeNode(overrides: Partial<AnalysisNode> & { scipSymbol: string; name: string; filePath: string }): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
    ...overrides,
  };
}

function makeEdge(from: string, to: string, kind: EdgeKind = EdgeKind.CALLS): AnalysisEdge {
  return {
    kind,
    fromFile: 'a.ts',
    fromName: from.split('/').pop()!,
    fromSymbol: from,
    toText: to.split('/').pop()!,
    toFile: 'b.ts',
    toName: to.split('/').pop()!,
    toSymbol: to,
    isExternal: false,
    edgePosition: { line: 1, col: 0 },
    isOptionalChain: false,
    isAsync: false,
  };
}

const testNodes: AnalysisNode[] = [
  makeNode({ scipSymbol: 'sym:a', name: 'funcA', filePath: 'src/a.ts' }),
  makeNode({ scipSymbol: 'sym:b', name: 'funcB', filePath: 'src/a.ts' }),
  makeNode({ scipSymbol: 'sym:c', name: 'funcC', filePath: 'src/b.ts' }),
  makeNode({ scipSymbol: 'sym:d', name: 'funcD', filePath: 'src/c.ts' }),
];

const testEdges: AnalysisEdge[] = [
  makeEdge('sym:a', 'sym:c'),  // a calls c
  makeEdge('sym:c', 'sym:d'),  // c calls d
];

const visibleNodeIds = new Set(['sym:a', 'sym:b', 'sym:c', 'sym:d']);

function TestConsumer({ onReady }: { onReady: (ctx: ReturnType<typeof useSelection>) => void }) {
  const ctx = useSelection();
  React.useEffect(() => { onReady(ctx); });
  return null;
}

function renderWithProvider(onReady: (ctx: ReturnType<typeof useSelection>) => void) {
  return render(
    <SelectionProvider nodes={testNodes} edges={testEdges} visibleNodeIds={visibleNodeIds}>
      <TestConsumer onReady={onReady} />
    </SelectionProvider>
  );
}

describe('SelectionContext', () => {
  describe('core selection', () => {
    it('starts with no selection', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      expect(ctx!.hasSelection).toBe(false);
      expect(ctx!.activeNodeIds.size).toBe(0);
      expect(ctx!.state.selectedNodeIds.size).toBe(0);
    });

    it('toggleNode adds a node to selection', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      expect(ctx!.hasSelection).toBe(true);
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.activeNodeIds.has('sym:a')).toBe(true);
    });

    it('toggleNode removes a node that is already selected', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleNode('sym:a'); });
      expect(ctx!.hasSelection).toBe(false);
      expect(ctx!.state.selectedNodeIds.size).toBe(0);
    });

    it('supports multi-select', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleNode('sym:c'); });
      expect(ctx!.state.selectedNodeIds.size).toBe(2);
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.selectedNodeIds.has('sym:c')).toBe(true);
    });

    it('clearSelection removes all selections', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleNode('sym:c'); });
      act(() => { ctx!.clearSelection(); });
      expect(ctx!.hasSelection).toBe(false);
      expect(ctx!.state.selectedNodeIds.size).toBe(0);
      expect(ctx!.activeNodeIds.size).toBe(0);
    });
  });

  describe('expansion groups', () => {
    it('computes same-file candidates when a node is selected', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); }); // filePath: src/a.ts
      const sameFile = ctx!.state.expansions.get('same-file')!;
      expect(sameFile.candidates.length).toBe(1);
      expect(sameFile.candidates[0].nodeId).toBe('sym:b'); // also in src/a.ts
      expect(sameFile.candidates[0].sourceNodeIds).toContain('sym:a');
    });

    it('computes caller candidates', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:c'); }); // sym:a calls sym:c
      const callers = ctx!.state.expansions.get('callers')!;
      expect(callers.candidates.length).toBe(1);
      expect(callers.candidates[0].nodeId).toBe('sym:a');
    });

    it('computes callee candidates', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:c'); }); // sym:c calls sym:d
      const callees = ctx!.state.expansions.get('callees')!;
      expect(callees.candidates.length).toBe(1);
      expect(callees.candidates[0].nodeId).toBe('sym:d');
    });

    it('toggleExpansionGroup enables a group and adds candidates to activeNodeIds', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleExpansionGroup('same-file'); });
      expect(ctx!.state.expansions.get('same-file')!.enabled).toBe(true);
      expect(ctx!.activeNodeIds.has('sym:b')).toBe(true); // same file as sym:a
    });

    it('toggleExpansionGroup disables a group and removes candidates from activeNodeIds', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleExpansionGroup('same-file'); });
      act(() => { ctx!.toggleExpansionGroup('same-file'); });
      expect(ctx!.state.expansions.get('same-file')!.enabled).toBe(false);
      expect(ctx!.activeNodeIds.has('sym:b')).toBe(false);
    });

    it('toggleExpandedNode disables an individual candidate', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleExpansionGroup('same-file'); });
      act(() => { ctx!.toggleExpandedNode('same-file', 'sym:b'); });
      expect(ctx!.activeNodeIds.has('sym:b')).toBe(false);
      expect(ctx!.state.expansions.get('same-file')!.disabledIds.has('sym:b')).toBe(true);
    });

    it('toggleExpandedNode re-enables a disabled candidate', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleExpansionGroup('same-file'); });
      act(() => { ctx!.toggleExpandedNode('same-file', 'sym:b'); });
      act(() => { ctx!.toggleExpandedNode('same-file', 'sym:b'); });
      expect(ctx!.activeNodeIds.has('sym:b')).toBe(true);
    });

    it('clearSelection resets all expansion groups', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleExpansionGroup('same-file'); });
      act(() => { ctx!.clearSelection(); });
      expect(ctx!.state.expansions.size).toBe(0);
      expect(ctx!.activeNodeIds.size).toBe(0);
    });

    it('does not include selected nodes as expansion candidates', () => {
      let ctx: ReturnType<typeof useSelection> | null = null;
      renderWithProvider((c) => { ctx = c; });
      // Select both sym:a and sym:b (same file)
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleNode('sym:b'); });
      const sameFile = ctx!.state.expansions.get('same-file')!;
      // Neither sym:a nor sym:b should appear as candidates since both are selected
      expect(sameFile.candidates.find((c) => c.nodeId === 'sym:a')).toBeUndefined();
      expect(sameFile.candidates.find((c) => c.nodeId === 'sym:b')).toBeUndefined();
    });
  });
});
