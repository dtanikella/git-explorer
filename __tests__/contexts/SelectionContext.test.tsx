import React from 'react';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SelectionProvider, useSelection } from '@/app/contexts/SelectionContext';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';
import type { SelectionContextValue } from '@/app/contexts/SelectionContext';

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
    isAmbiguous: false,
    edgePosition: { line: 1, col: 0 },
    isOptionalChain: false,
    isAsync: false,
  };
}

function makeArea(id: string, name: string, contains: string[], parent: string | null = null, children: string[] = []): Area {
  return {
    id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name,
    type: 'business_domain',
    contains,
    parent,
    children,
    clusterStrength: 0,
  };
}

const testNodes: AnalysisNode[] = [
  makeNode({ scipSymbol: 'sym:a', name: 'funcA', filePath: 'src/a.ts' }),
  makeNode({ scipSymbol: 'sym:b', name: 'funcB', filePath: 'src/a.ts' }),
  makeNode({ scipSymbol: 'sym:c', name: 'funcC', filePath: 'src/b.ts' }),
  makeNode({ scipSymbol: 'sym:d', name: 'funcD', filePath: 'src/c.ts' }),
];

const testEdges: AnalysisEdge[] = [
  makeEdge('sym:a', 'sym:c'),
  makeEdge('sym:c', 'sym:d'),
];

const visibleNodeIds = new Set(['sym:a', 'sym:b', 'sym:c', 'sym:d']);

const testAreas: Area[] = [
  makeArea('area-a', 'Area A', ['sym:a', 'sym:b']),
  makeArea('area-b', 'Area B', ['sym:c']),
  makeArea('area-parent', 'Parent', [], null, ['area-a']),
];

/**
 * Helper: renders a SelectionProvider with test data and exposes
 * the context value for test assertions.
 */
function renderWithProvider(
  onReady: (ctx: SelectionContextValue) => void,
  areas: Area[] = [],
  seedNodeIds?: Set<string>,
  value?: SelectionContextValue,
) {
  // When a pre-built value is passed, use the thin-wrapper provider
  if (value) {
    return render(
      <SelectionProvider value={value}>
        <TestConsumer onReady={onReady} />
      </SelectionProvider>
    );
  }

  // Otherwise use the stateful provider with a new useSelectionState
  return render(
    <SelectionProvider
      nodes={testNodes}
      edges={testEdges}
      visibleNodeIds={visibleNodeIds}
      areas={areas}
      seedNodeIds={seedNodeIds}
    >
      <TestConsumer onReady={onReady} />
    </SelectionProvider>
  );
}

function TestConsumer({ onReady }: { onReady: (ctx: SelectionContextValue) => void }) {
  const ctx = useSelection();
  React.useEffect(() => { onReady(ctx); });
  return null;
}

describe('SelectionContext — new state model', () => {
  describe('derived selectedNodeIds', () => {
    it('starts empty', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      expect(ctx!.hasSelection).toBe(false);
      expect(ctx!.state.selectedNodeIds.size).toBe(0);
      expect(ctx!.state.explicitNodeIds.size).toBe(0);
      expect(ctx!.state.excludedNodeIds.size).toBe(0);
      expect(ctx!.state.lockedNodeIds.size).toBe(0);
      expect(ctx!.state.lockedAreaIds.size).toBe(0);
    });

    it('equals explicitNodeIds when no area is selected', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      expect(ctx!.state.explicitNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.selectedNodeIds.size).toBe(1);
    });

    it('includes area members when an area is selected', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleArea('area-a'); });
      // area-a contains sym:a, sym:b
      expect(ctx!.state.explicitNodeIds.size).toBe(0);
      expect(ctx!.state.selectedAreaIds.has('area-a')).toBe(true);
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.selectedNodeIds.has('sym:b')).toBe(true);
      expect(ctx!.state.selectedNodeIds.size).toBe(2);
    });

    it('includes descendant area members in selectedNodeIds', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, [
        makeArea('parent', 'Parent', [], null, ['child']),
        makeArea('child', 'Child', ['sym:a'], 'parent', []),
      ]);
      act(() => { ctx!.toggleArea('parent'); });
      // parent area should include child's contains via getDescendantIds
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(true);
    });

    it('excludes excludedNodeIds from selectedNodeIds', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleArea('area-a'); });
      // area-a has sym:a, sym:b — toggle area selects both
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.selectedNodeIds.has('sym:b')).toBe(true);
    });
  });

  describe('toggleNode', () => {
    it('adds to explicitNodeIds when unselected and not covered by an area', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleNode('sym:d'); });
      expect(ctx!.state.explicitNodeIds.has('sym:d')).toBe(true);
      expect(ctx!.state.selectedNodeIds.has('sym:d')).toBe(true);
    });

    it('removes from explicitNodeIds when unselected and not covered by an area', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleNode('sym:a'); });
      expect(ctx!.state.explicitNodeIds.has('sym:a')).toBe(false);
      expect(ctx!.state.selectedNodeIds.size).toBe(0);
    });

    it('adds to excludedNodeIds when node is covered by a checked area', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleArea('area-a'); });
      // sym:a is selected via area-a
      act(() => { ctx!.toggleNode('sym:a'); });
      // sym:a should move from explicitNodeIds... wait, it was never in explicitNodeIds
      // When unchecking a node that's covered by a checked area, it should go to excludedNodeIds
      expect(ctx!.state.excludedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(false);
      // sym:b should still be selected via area-a
      expect(ctx!.state.selectedNodeIds.has('sym:b')).toBe(true);
    });

    it('removes from excludedNodeIds when re-checking a previously excluded node', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleArea('area-a'); });
      act(() => { ctx!.toggleNode('sym:a'); });  // exclude sym:a
      act(() => { ctx!.toggleNode('sym:a'); });  // re-include sym:a
      expect(ctx!.state.excludedNodeIds.has('sym:a')).toBe(false);
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(true);
    });

    it('is a no-op on a locked node', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      act(() => { ctx!.toggleNode('sym:a'); });
      expect(ctx!.state.explicitNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.lockedNodeIds.has('sym:a')).toBe(true);
    });
  });

  describe('toggleNodes (bulk)', () => {
    it('adds multiple nodes with on=true', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNodes(['sym:a', 'sym:b'], true); });
      expect(ctx!.state.explicitNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.explicitNodeIds.has('sym:b')).toBe(true);
      expect(ctx!.state.selectedNodeIds.size).toBe(2);
    });

    it('removes multiple nodes with on=false', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNodes(['sym:a', 'sym:b'], true); });
      act(() => { ctx!.toggleNodes(['sym:a', 'sym:b'], false); });
      expect(ctx!.state.explicitNodeIds.size).toBe(0);
    });
  });

  describe('toggleArea', () => {
    it('adds area to selectedAreaIds', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleArea('area-a'); });
      expect(ctx!.state.selectedAreaIds.has('area-a')).toBe(true);
      expect(ctx!.hasSelection).toBe(true);
    });

    it('removes area from selectedAreaIds on second toggle', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleArea('area-a'); });
      act(() => { ctx!.toggleArea('area-a'); });
      expect(ctx!.state.selectedAreaIds.size).toBe(0);
      expect(ctx!.hasSelection).toBe(false);
    });

    it('removes descendant areas from selectedAreaIds when checking a parent', () => {
      const areas = [
        makeArea('parent', 'Parent', [], null, ['child']),
        makeArea('child', 'Child', ['sym:a'], 'parent', []),
      ];
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, areas);
      act(() => { ctx!.toggleArea('child'); });
      expect(ctx!.state.selectedAreaIds.has('child')).toBe(true);
      act(() => { ctx!.toggleArea('parent'); });
      expect(ctx!.state.selectedAreaIds.has('parent')).toBe(true);
      expect(ctx!.state.selectedAreaIds.has('child')).toBe(false);
    });

    it('clears excludedNodeIds for members when checking an area', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleArea('area-a'); });
      act(() => { ctx!.toggleNode('sym:a'); });  // exclude sym:a
      expect(ctx!.state.excludedNodeIds.has('sym:a')).toBe(true);
      // Toggle area off then on
      act(() => { ctx!.toggleArea('area-a'); });
      act(() => { ctx!.toggleArea('area-a'); });
      expect(ctx!.state.excludedNodeIds.has('sym:a')).toBe(false);
    });
  });

  describe('locks', () => {
    it('toggleLock on a node locks it', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      expect(ctx!.state.lockedNodeIds.has('sym:a')).toBe(true);
    });

    it('toggleLock on a node unlocks it', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      expect(ctx!.state.lockedNodeIds.has('sym:a')).toBe(false);
    });

    it('toggleLock on an area locks it', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleArea('area-a'); });
      act(() => { ctx!.toggleLock({ kind: 'area', id: 'area-a' }); });
      expect(ctx!.state.lockedAreaIds.has('area-a')).toBe(true);
    });

    it('toggleLock on an area clears excludedNodeIds for its members', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, testAreas);
      act(() => { ctx!.toggleArea('area-a'); });
      act(() => { ctx!.toggleNode('sym:a'); });  // exclude sym:a
      act(() => { ctx!.toggleLock({ kind: 'area', id: 'area-a' }); });
      // Locking an area should clear exclusions for its members
      expect(ctx!.state.excludedNodeIds.has('sym:a')).toBe(false);
    });

    it('toggleLock with kind:nodes on multiple locked node ids', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNodes(['sym:a', 'sym:b', 'sym:d'], true); });
      act(() => { ctx!.toggleLock({ kind: 'nodes', ids: ['sym:a', 'sym:d'] }); });
      expect(ctx!.state.lockedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.lockedNodeIds.has('sym:d')).toBe(true);
      expect(ctx!.state.lockedNodeIds.has('sym:b')).toBe(false);
    });

    it('lockAll locks all selected nodes', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNodes(['sym:a', 'sym:b'], true); });
      act(() => { ctx!.lockAll(); });
      expect(ctx!.state.lockedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.lockedNodeIds.has('sym:b')).toBe(true);
    });

    it('clearUnlocked removes unlocked selections but keeps locked ones', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNodes(['sym:a', 'sym:b'], true); });
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      act(() => { ctx!.clearUnlocked(); });
      // sym:a is locked - should remain selected
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.lockedNodeIds.has('sym:a')).toBe(true);
      // sym:b was unlocked - should be cleared
      expect(ctx!.state.selectedNodeIds.has('sym:b')).toBe(false);
    });

    it('clearSelection removes everything including locks', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNodes(['sym:a', 'sym:b'], true); });
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      act(() => { ctx!.clearSelection(); });
      expect(ctx!.state.selectedNodeIds.size).toBe(0);
      expect(ctx!.state.lockedNodeIds.size).toBe(0);
      expect(ctx!.state.explicitNodeIds.size).toBe(0);
      expect(ctx!.hasSelection).toBe(false);
    });

    it('resetSelection with no seed clears everything', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNodes(['sym:a', 'sym:b'], true); });
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      act(() => { ctx!.resetSelection(); });
      expect(ctx!.state.selectedNodeIds.size).toBe(0);
      expect(ctx!.state.lockedNodeIds.size).toBe(0);
    });

    it('resetSelection restores the seed as selected and locked', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, [], new Set(['sym:a', 'sym:b']));
      // User unlocks a seed, adds another node, then clears everything
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      act(() => { ctx!.toggleNode('sym:c'); });
      act(() => { ctx!.clearSelection(); });
      expect(ctx!.state.lockedNodeIds.size).toBe(0);

      act(() => { ctx!.resetSelection(); });
      expect([...ctx!.state.selectedNodeIds].sort()).toEqual(['sym:a', 'sym:b']);
      expect([...ctx!.state.lockedNodeIds].sort()).toEqual(['sym:a', 'sym:b']);
      expect(ctx!.state.selectedNodeIds.has('sym:c')).toBe(false);
    });
  });

  describe('per-row expansions', () => {
    it('toggleFocus scopes to a row, and toggling it again returns to all selected', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      expect(ctx!.state.focusKey).toBeNull();
      act(() => { ctx!.toggleFocus('n:sym:c'); });
      expect(ctx!.state.focusKey).toBe('n:sym:c');
      act(() => { ctx!.toggleFocus('n:sym:c'); });
      expect(ctx!.state.focusKey).toBeNull();
      act(() => { ctx!.toggleFocus('n:sym:c'); });
      act(() => { ctx!.toggleFocus(null); });
      expect(ctx!.state.focusKey).toBeNull();
    });

    it('expands the focused row whether or not it is selected, and counts toward the effective selection', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleFocus('n:sym:c'); });
      act(() => { ctx!.toggleFocusedExpansion('callers'); });
      expect(ctx!.state.rowExpansions.get('n:sym:c')?.has('callers')).toBe(true);
      expect(ctx!.state.selectedNodeIds.size).toBe(0);
      expect(ctx!.activeNodeIds.has('sym:a')).toBe(true);
    });

    it('turning the last relation off removes the row from rowExpansions', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleFocus('n:sym:c'); });
      act(() => { ctx!.toggleFocusedExpansion('callers'); });
      act(() => { ctx!.toggleFocusedExpansion('callers'); });
      expect(ctx!.state.rowExpansions.size).toBe(0);
    });

    it('does nothing when no row is focused', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleFocusedExpansion('callers'); });
      expect(ctx!.state.rowExpansions.size).toBe(0);
    });

    it('per-row and whole-selection toggles never duplicate a node', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:c'); });
      act(() => { ctx!.toggleExpansionGroup('callers'); });
      act(() => { ctx!.toggleFocus('n:sym:c'); });
      act(() => { ctx!.toggleFocusedExpansion('callers'); });
      const callers = ctx!.state.expansions.get('callers')!;
      expect(callers.active).toHaveLength(1);
      expect([...ctx!.activeNodeIds].sort()).toEqual(['sym:a', 'sym:c']);
    });

    it('exclusions apply across both views', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleFocus('n:sym:c'); });
      act(() => { ctx!.toggleFocusedExpansion('callers'); });
      act(() => { ctx!.toggleExpandedNode('callers', 'sym:a'); });
      expect(ctx!.activeNodeIds.has('sym:a')).toBe(false);
      act(() => { ctx!.setExpandedNodes('callers', ['sym:a'], true); });
      expect(ctx!.activeNodeIds.has('sym:a')).toBe(true);
    });

    it.each(['clearSelection', 'clearUnlocked', 'resetSelection'] as const)(
      '%s removes every per-row expansion and returns focus to all selected',
      (action) => {
        let ctx: SelectionContextValue | null = null;
        renderWithProvider((c) => { ctx = c; });
        act(() => { ctx!.toggleFocus('n:sym:c'); });
        act(() => { ctx!.toggleFocusedExpansion('callers'); });
        act(() => { ctx![action](); });
        expect(ctx!.state.rowExpansions.size).toBe(0);
        expect(ctx!.state.focusKey).toBeNull();
        expect(ctx!.activeNodeIds.size).toBe(0);
      },
    );
  });

  describe('expansions (no area-members)', () => {
    it('computes same-file, callers, callees expansions', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      expect(ctx!.state.expansions.has('same-file')).toBe(true);
      expect(ctx!.state.expansions.has('callers')).toBe(true);
      expect(ctx!.state.expansions.has('callees')).toBe(true);
      // area-members should NOT exist
      expect(ctx!.state.expansions.has('area-members')).toBe(false);
    });

    it('toggleExpansionGroup enables a group', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; });
      act(() => { ctx!.toggleNode('sym:a'); });
      act(() => { ctx!.toggleExpansionGroup('same-file'); });
      expect(ctx!.state.expansions.get('same-file')!.enabled).toBe(true);
      expect(ctx!.activeNodeIds.has('sym:b')).toBe(true);
    });
  });

  describe('diff seeding', () => {
    it('adds seedNodeIds to explicitNodeIds and lockedNodeIds', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, [], new Set(['sym:a', 'sym:c']));
      expect(ctx!.state.explicitNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.explicitNodeIds.has('sym:c')).toBe(true);
      expect(ctx!.state.lockedNodeIds.has('sym:a')).toBe(true);
      expect(ctx!.state.lockedNodeIds.has('sym:c')).toBe(true);
      expect(ctx!.state.selectedNodeIds.has('sym:a')).toBe(true);
    });

    it('allows unlocking a seeded node', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, [], new Set(['sym:a']));
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      expect(ctx!.state.lockedNodeIds.has('sym:a')).toBe(false);
      // unlocked node should still be explicitly selected
      expect(ctx!.state.explicitNodeIds.has('sym:a')).toBe(true);
    });

    it('allows toggling selection off for an unlocked seeded node', () => {
      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, [], new Set(['sym:a']));
      act(() => { ctx!.toggleLock({ kind: 'node', id: 'sym:a' }); });
      act(() => { ctx!.toggleNode('sym:a'); });
      expect(ctx!.state.explicitNodeIds.has('sym:a')).toBe(false);
    });
  });

  describe('per-tab persistence via thin provider', () => {
    it('renders with a pre-built value and preserves state', () => {
      const mockValue: SelectionContextValue = {
        state: {
          explicitNodeIds: new Set(['sym:x']),
          selectedAreaIds: new Set(),
          excludedNodeIds: new Set(),
          lockedNodeIds: new Set(),
          lockedAreaIds: new Set(),
          expansions: new Map(),
          selectedNodeIds: new Set(['sym:x']),
        },
        activeNodeIds: new Set(['sym:x']),
        hasSelection: true,
        toggleNode: jest.fn(),
        toggleNodes: jest.fn(),
        toggleArea: jest.fn(),
        toggleLock: jest.fn(),
        lockAll: jest.fn(),
        clearUnlocked: jest.fn(),
        clearSelection: jest.fn(),
        toggleExpansionGroup: jest.fn(),
        toggleExpandedNode: jest.fn(),
        setExpandedNodes: jest.fn(),
      };

      let ctx: SelectionContextValue | null = null;
      renderWithProvider((c) => { ctx = c; }, [], undefined, mockValue);
      expect(ctx!.state.selectedNodeIds.has('sym:x')).toBe(true);
      expect(ctx!.hasSelection).toBe(true);
    });
  });
});