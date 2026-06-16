# Highlight Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the transient highlight mechanism with a persistent selection system featuring multi-select, expansion by relationship, and a right sidebar with expansion controls.

**Architecture:** React Context Provider (`SelectionContext`) manages selection state. `RepoGraph` consumes the context for click handling and opacity rendering on a canvas. `SelectionSidebar` consumes the context for the sidebar UI. `page.tsx` wraps both with `SelectionProvider`.

**Tech Stack:** React 18, Next.js, D3.js (force simulation + canvas), TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/contexts/SelectionContext.tsx` | Create | Context, provider, hook, all selection/expansion logic |
| `app/components/selection/SelectionSidebar.tsx` | Create | Sidebar UI: selected nodes, expansion groups, toggles |
| `app/components/repo-graph/RepoGraph.tsx` | Modify | Consume context, click handler, opacity rendering, zoom-to-fit |
| `app/page.tsx` | Modify | Wrap with provider, remove old highlight state, update cross-tab |
| `__tests__/contexts/SelectionContext.test.tsx` | Create | Unit tests for selection context logic |
| `__tests__/components/SelectionSidebar.test.tsx` | Create | Unit tests for sidebar component |

---

### Task 1: SelectionContext — Core Selection Logic

**Files:**
- Create: `app/contexts/SelectionContext.tsx`
- Create: `__tests__/contexts/SelectionContext.test.tsx`

- [ ] **Step 1: Write failing tests for core selection**

Create `__tests__/contexts/SelectionContext.test.tsx`:

```tsx
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- __tests__/contexts/SelectionContext.test.tsx 2>&1 | tail -5`
Expected: FAIL — module `@/app/contexts/SelectionContext` not found

- [ ] **Step 3: Implement SelectionContext with core selection**

Create `app/contexts/SelectionContext.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { EdgeKind } from '@/lib/analysis/types';

// --- Types ---

export interface ExpansionCandidate {
  nodeId: string;
  sourceNodeIds: string[];
}

export interface ExpansionGroup {
  type: 'same-file' | 'callers' | 'callees';
  enabled: boolean;
  candidates: ExpansionCandidate[];
  disabledIds: Set<string>;
}

export interface SelectionState {
  selectedNodeIds: Set<string>;
  expansions: Map<string, ExpansionGroup>;
}

export interface SelectionContextValue {
  state: SelectionState;
  toggleNode(id: string): void;
  clearSelection(): void;
  toggleExpansionGroup(type: ExpansionGroup['type']): void;
  toggleExpandedNode(type: ExpansionGroup['type'], nodeId: string): void;
  activeNodeIds: Set<string>;
  hasSelection: boolean;
}

// --- Context ---

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within a SelectionProvider');
  return ctx;
}

// --- Expansion computation ---

function computeExpansions(
  selectedIds: Set<string>,
  nodes: AnalysisNode[],
  edges: AnalysisEdge[],
  visibleNodeIds: Set<string>,
  prevExpansions: Map<string, ExpansionGroup>,
): Map<string, ExpansionGroup> {
  if (selectedIds.size === 0) return new Map();

  const nodesBySymbol = new Map<string, AnalysisNode>();
  for (const n of nodes) nodesBySymbol.set(n.scipSymbol, n);

  const selectedFilePaths = new Set<string>();
  for (const id of selectedIds) {
    const node = nodesBySymbol.get(id);
    if (node) selectedFilePaths.add(node.filePath);
  }

  // Same File: visible nodes sharing filePath with any selected node (excluding selected nodes themselves)
  const sameFileCandidates: ExpansionCandidate[] = [];
  for (const n of nodes) {
    if (selectedIds.has(n.scipSymbol)) continue;
    if (!visibleNodeIds.has(n.scipSymbol)) continue;
    if (selectedFilePaths.has(n.filePath)) {
      const sourceNodeIds = [...selectedIds].filter((id) => {
        const sn = nodesBySymbol.get(id);
        return sn && sn.filePath === n.filePath;
      });
      sameFileCandidates.push({ nodeId: n.scipSymbol, sourceNodeIds });
    }
  }

  // Callers: visible nodes where a CALLS edge points TO any selected node
  const callerCandidates: ExpansionCandidate[] = [];
  const callerMap = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.kind !== EdgeKind.CALLS) continue;
    if (!selectedIds.has(e.toSymbol)) continue;
    if (selectedIds.has(e.fromSymbol)) continue;
    if (!visibleNodeIds.has(e.fromSymbol)) continue;
    if (!callerMap.has(e.fromSymbol)) callerMap.set(e.fromSymbol, new Set());
    callerMap.get(e.fromSymbol)!.add(e.toSymbol);
  }
  for (const [nodeId, sources] of callerMap) {
    callerCandidates.push({ nodeId, sourceNodeIds: [...sources] });
  }

  // Callees: visible nodes where a CALLS edge points FROM any selected node
  const calleeCandidates: ExpansionCandidate[] = [];
  const calleeMap = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.kind !== EdgeKind.CALLS) continue;
    if (!selectedIds.has(e.fromSymbol)) continue;
    if (selectedIds.has(e.toSymbol)) continue;
    if (!visibleNodeIds.has(e.toSymbol)) continue;
    if (!calleeMap.has(e.toSymbol)) calleeMap.set(e.toSymbol, new Set());
    calleeMap.get(e.toSymbol)!.add(e.fromSymbol);
  }
  for (const [nodeId, sources] of calleeMap) {
    calleeCandidates.push({ nodeId, sourceNodeIds: [...sources] });
  }

  function makeGroup(type: ExpansionGroup['type'], candidates: ExpansionCandidate[]): ExpansionGroup {
    const prev = prevExpansions.get(type);
    return {
      type,
      enabled: prev ? prev.enabled : false,
      candidates,
      disabledIds: prev ? new Set([...prev.disabledIds].filter((id) => candidates.some((c) => c.nodeId === id))) : new Set(),
    };
  }

  const result = new Map<string, ExpansionGroup>();
  result.set('same-file', makeGroup('same-file', sameFileCandidates));
  result.set('callers', makeGroup('callers', callerCandidates));
  result.set('callees', makeGroup('callees', calleeCandidates));
  return result;
}

function computeActiveNodeIds(selectedIds: Set<string>, expansions: Map<string, ExpansionGroup>): Set<string> {
  const active = new Set(selectedIds);
  for (const group of expansions.values()) {
    if (!group.enabled) continue;
    for (const c of group.candidates) {
      if (!group.disabledIds.has(c.nodeId)) {
        active.add(c.nodeId);
      }
    }
  }
  return active;
}

// --- Provider ---

interface SelectionProviderProps {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  visibleNodeIds: Set<string>;
  children: ReactNode;
}

export function SelectionProvider({ nodes, edges, visibleNodeIds, children }: SelectionProviderProps) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [expansions, setExpansions] = useState<Map<string, ExpansionGroup>>(new Map());

  // Recompute expansion candidates when selection or visible nodes change
  const computedExpansions = useMemo(
    () => computeExpansions(selectedNodeIds, nodes, edges, visibleNodeIds, expansions),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- expansions intentionally excluded to avoid infinite loop
    [selectedNodeIds, nodes, edges, visibleNodeIds],
  );

  // Sync computed expansions into state (preserving enabled/disabledIds from user)
  const currentExpansions = useMemo(() => {
    const merged = new Map<string, ExpansionGroup>();
    for (const [key, computed] of computedExpansions) {
      const prev = expansions.get(key);
      merged.set(key, {
        ...computed,
        enabled: prev ? prev.enabled : computed.enabled,
        disabledIds: prev
          ? new Set([...prev.disabledIds].filter((id) => computed.candidates.some((c) => c.nodeId === id)))
          : computed.disabledIds,
      });
    }
    return merged;
  }, [computedExpansions, expansions]);

  const activeNodeIds = useMemo(
    () => computeActiveNodeIds(selectedNodeIds, currentExpansions),
    [selectedNodeIds, currentExpansions],
  );

  const hasSelection = selectedNodeIds.size > 0;

  const toggleNode = useCallback((id: string) => {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setExpansions(new Map());
  }, []);

  const toggleExpansionGroup = useCallback((type: ExpansionGroup['type']) => {
    setExpansions((prev) => {
      const next = new Map(prev);
      const group = next.get(type);
      if (group) {
        next.set(type, { ...group, enabled: !group.enabled, disabledIds: new Set() });
      } else {
        next.set(type, { type, enabled: true, candidates: [], disabledIds: new Set() });
      }
      return next;
    });
  }, []);

  const toggleExpandedNode = useCallback((type: ExpansionGroup['type'], nodeId: string) => {
    setExpansions((prev) => {
      const next = new Map(prev);
      const group = next.get(type);
      if (!group) return prev;
      const nextDisabled = new Set(group.disabledIds);
      if (nextDisabled.has(nodeId)) {
        nextDisabled.delete(nodeId);
      } else {
        nextDisabled.add(nodeId);
      }
      next.set(type, { ...group, disabledIds: nextDisabled });
      return next;
    });
  }, []);

  const value = useMemo<SelectionContextValue>(() => ({
    state: { selectedNodeIds, expansions: currentExpansions },
    toggleNode,
    clearSelection,
    toggleExpansionGroup,
    toggleExpandedNode,
    activeNodeIds,
    hasSelection,
  }), [selectedNodeIds, currentExpansions, toggleNode, clearSelection, toggleExpansionGroup, toggleExpandedNode, activeNodeIds, hasSelection]);

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- __tests__/contexts/SelectionContext.test.tsx 2>&1 | tail -10`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/contexts/SelectionContext.tsx __tests__/contexts/SelectionContext.test.tsx
git commit -m "feat: add SelectionContext with core selection logic (#11)"
```

---

### Task 2: SelectionContext — Expansion Logic Tests

**Files:**
- Modify: `__tests__/contexts/SelectionContext.test.tsx`

- [ ] **Step 1: Add expansion logic tests**

Append to the `describe('SelectionContext')` block in `__tests__/contexts/SelectionContext.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- __tests__/contexts/SelectionContext.test.tsx 2>&1 | tail -10`
Expected: All 13 tests PASS (5 core + 8 expansion)

- [ ] **Step 3: Commit**

```bash
git add __tests__/contexts/SelectionContext.test.tsx
git commit -m "test: add expansion logic tests for SelectionContext (#11)"
```

---

### Task 3: SelectionSidebar Component

**Files:**
- Create: `app/components/selection/SelectionSidebar.tsx`
- Create: `__tests__/components/SelectionSidebar.test.tsx`

- [ ] **Step 1: Write failing tests for sidebar**

Create `__tests__/components/SelectionSidebar.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SelectionSidebar from '@/app/components/selection/SelectionSidebar';
import type { SelectionContextValue, ExpansionGroup } from '@/app/contexts/SelectionContext';

// We test the sidebar by passing a mock context value via props
// (the sidebar receives context internally via useSelection, but we'll
// mock the context module)

const mockToggleNode = jest.fn();
const mockClearSelection = jest.fn();
const mockToggleExpansionGroup = jest.fn();
const mockToggleExpandedNode = jest.fn();

jest.mock('@/app/contexts/SelectionContext', () => ({
  useSelection: (): SelectionContextValue => mockContextValue,
}));

let mockContextValue: SelectionContextValue;

function makeGroup(type: ExpansionGroup['type'], candidates: { nodeId: string; sourceNodeIds: string[] }[], enabled = false): ExpansionGroup {
  return { type, enabled, candidates, disabledIds: new Set() };
}

const mockNodes = [
  { scipSymbol: 'sym:a', name: 'funcA', filePath: 'src/utils/a.ts' },
  { scipSymbol: 'sym:b', name: 'funcB', filePath: 'src/utils/a.ts' },
  { scipSymbol: 'sym:c', name: 'funcC', filePath: 'src/services/b.ts' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockContextValue = {
    state: {
      selectedNodeIds: new Set(['sym:a']),
      expansions: new Map([
        ['same-file', makeGroup('same-file', [{ nodeId: 'sym:b', sourceNodeIds: ['sym:a'] }])],
        ['callers', makeGroup('callers', [])],
        ['callees', makeGroup('callees', [{ nodeId: 'sym:c', sourceNodeIds: ['sym:a'] }])],
      ]),
    },
    toggleNode: mockToggleNode,
    clearSelection: mockClearSelection,
    toggleExpansionGroup: mockToggleExpansionGroup,
    toggleExpandedNode: mockToggleExpandedNode,
    activeNodeIds: new Set(['sym:a']),
    hasSelection: true,
  };
});

describe('SelectionSidebar', () => {
  it('renders the sidebar with header and clear all', () => {
    render(<SelectionSidebar nodes={mockNodes as any} />);
    expect(screen.getByText('Selection')).toBeInTheDocument();
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('lists selected nodes by name', () => {
    render(<SelectionSidebar nodes={mockNodes as any} />);
    expect(screen.getByText('funcA')).toBeInTheDocument();
  });

  it('calls clearSelection when Clear all is clicked', () => {
    render(<SelectionSidebar nodes={mockNodes as any} />);
    fireEvent.click(screen.getByText('Clear all'));
    expect(mockClearSelection).toHaveBeenCalledTimes(1);
  });

  it('renders expansion group labels', () => {
    render(<SelectionSidebar nodes={mockNodes as any} />);
    expect(screen.getByText('Same File')).toBeInTheDocument();
    expect(screen.getByText('Callers')).toBeInTheDocument();
    expect(screen.getByText('Callees')).toBeInTheDocument();
  });

  it('calls toggleExpansionGroup when group toggle is clicked', () => {
    render(<SelectionSidebar nodes={mockNodes as any} />);
    const sameFileToggle = screen.getByTestId('toggle-same-file');
    fireEvent.click(sameFileToggle);
    expect(mockToggleExpansionGroup).toHaveBeenCalledWith('same-file');
  });

  it('shows candidate checkboxes when group is enabled', () => {
    mockContextValue.state.expansions.get('same-file')!.enabled = true;
    render(<SelectionSidebar nodes={mockNodes as any} />);
    expect(screen.getByText('funcB')).toBeInTheDocument();
  });

  it('calls toggleExpandedNode when candidate checkbox is clicked', () => {
    mockContextValue.state.expansions.get('same-file')!.enabled = true;
    render(<SelectionSidebar nodes={mockNodes as any} />);
    const checkbox = screen.getByTestId('candidate-same-file-sym:b');
    fireEvent.click(checkbox);
    expect(mockToggleExpandedNode).toHaveBeenCalledWith('same-file', 'sym:b');
  });

  it('hides candidates when group has no candidates', () => {
    render(<SelectionSidebar nodes={mockNodes as any} />);
    // Callers group has 0 candidates — the toggle should still show but with "(0)" or disabled
    const callersToggle = screen.getByTestId('toggle-callers');
    expect(callersToggle).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- __tests__/components/SelectionSidebar.test.tsx 2>&1 | tail -5`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SelectionSidebar**

Create directories and file:

```bash
mkdir -p app/components/selection
```

Create `app/components/selection/SelectionSidebar.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import type { ExpansionGroup } from '@/app/contexts/SelectionContext';
import type { AnalysisNode } from '@/lib/analysis/types';

interface SelectionSidebarProps {
  nodes: AnalysisNode[];
}

const GROUP_LABELS: Record<string, string> = {
  'same-file': 'Same File',
  'callers': 'Callers',
  'callees': 'Callees',
};

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export default function SelectionSidebar({ nodes }: SelectionSidebarProps) {
  const { state, clearSelection, toggleExpansionGroup, toggleExpandedNode } = useSelection();
  const { selectedNodeIds, expansions } = state;

  const nodesBySymbol = useMemo(() => {
    const map = new Map<string, AnalysisNode>();
    for (const n of nodes) map.set(n.scipSymbol, n);
    return map;
  }, [nodes]);

  const selectedNodes = useMemo(
    () => [...selectedNodeIds].map((id) => nodesBySymbol.get(id)).filter(Boolean) as AnalysisNode[],
    [selectedNodeIds, nodesBySymbol],
  );

  const groupOrder: ExpansionGroup['type'][] = ['same-file', 'callers', 'callees'];

  return (
    <div
      style={{
        width: 250,
        borderLeft: '1px solid #e5e7eb',
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        fontSize: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <span style={{ fontWeight: 600 }}>Selection</span>
        <button
          onClick={clearSelection}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 11,
            textDecoration: 'underline',
          }}
        >
          Clear all
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {/* Selected nodes */}
        <div style={{ marginBottom: 12 }}>
          {selectedNodes.map((node) => (
            <div
              key={node.scipSymbol}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <div style={{ fontWeight: 500 }}>{node.name}</div>
              <div
                style={{ fontSize: 10, color: '#9ca3af' }}
                title={node.filePath}
              >
                {truncatePath(node.filePath)}
              </div>
            </div>
          ))}
        </div>

        {/* Expansion groups */}
        {groupOrder.map((type) => {
          const group = expansions.get(type);
          if (!group) return null;
          const candidateCount = group.candidates.length;

          return (
            <div key={type} style={{ marginBottom: 8 }}>
              {/* Group header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                }}
              >
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  {GROUP_LABELS[type]} ({candidateCount})
                </span>
                <button
                  data-testid={`toggle-${type}`}
                  onClick={() => toggleExpansionGroup(type)}
                  style={{
                    width: 32,
                    height: 18,
                    borderRadius: 9,
                    border: 'none',
                    cursor: candidateCount > 0 ? 'pointer' : 'default',
                    background: group.enabled ? '#3b82f6' : '#d1d5db',
                    position: 'relative',
                    transition: 'background 0.2s',
                    opacity: candidateCount > 0 ? 1 : 0.4,
                  }}
                  disabled={candidateCount === 0}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: group.enabled ? 16 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </div>

              {/* Candidate list */}
              {group.enabled && candidateCount > 0 && (
                <div style={{ paddingLeft: 8 }}>
                  {group.candidates.map((candidate) => {
                    const node = nodesBySymbol.get(candidate.nodeId);
                    if (!node) return null;
                    const isDisabled = group.disabledIds.has(candidate.nodeId);
                    return (
                      <label
                        key={candidate.nodeId}
                        data-testid={`candidate-${type}-${candidate.nodeId}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '2px 0',
                          cursor: 'pointer',
                          opacity: isDisabled ? 0.5 : 1,
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleExpandedNode(type, candidate.nodeId);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!isDisabled}
                          readOnly
                          style={{ margin: 0, cursor: 'pointer' }}
                        />
                        <span>
                          <span>{node.name}</span>
                          <span
                            style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}
                            title={node.filePath}
                          >
                            {truncatePath(node.filePath)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- __tests__/components/SelectionSidebar.test.tsx 2>&1 | tail -10`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/selection/SelectionSidebar.tsx __tests__/components/SelectionSidebar.test.tsx
git commit -m "feat: add SelectionSidebar component (#11)"
```

---

### Task 4: RepoGraph — Click Handler & Opacity Rendering

**Files:**
- Modify: `app/components/repo-graph/RepoGraph.tsx`
- Modify: `__tests__/components/RepoGraph.test.tsx`

- [ ] **Step 1: Add click handling (mousedown/mouseup with 3px threshold)**

Add mousedown tracking ref and click handler. In `RepoGraph.tsx`, add these refs after the existing refs (after line 48):

```tsx
const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
```

Add new import at the top of the file:

```tsx
import { useSelection } from '@/app/contexts/SelectionContext';
```

Inside the component function, after the existing state declarations, add:

```tsx
const { activeNodeIds, selectedNodeIds, hasSelection, toggleNode } = useSelection();
const activeNodeIdsRef = useRef(activeNodeIds);
const selectedNodeIdsRef = useRef(selectedNodeIds);
const hasSelectionRef = useRef(hasSelection);

useEffect(() => {
  activeNodeIdsRef.current = activeNodeIds;
  selectedNodeIdsRef.current = selectedNodeIds;
  hasSelectionRef.current = hasSelection;
  drawFrameRef.current?.();
}, [activeNodeIds, selectedNodeIds, hasSelection]);
```

Add mousedown handler:

```tsx
const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
  mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
}, []);

const handleMouseUp = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
  const downPos = mouseDownPosRef.current;
  mouseDownPosRef.current = null;
  if (!downPos) return;

  const dx = event.clientX - downPos.x;
  const dy = event.clientY - downPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 3) return; // was a drag/pan

  if (!canvasRef.current) return;
  const canvas = canvasRef.current;
  const rect = canvas.getBoundingClientRect();
  const t = zoomTransformRef.current;
  const mx = (event.clientX - rect.left - t.x) / t.k;
  const my = (event.clientY - rect.top - t.y) / t.k;

  const nodes = simNodesRef.current;
  const cfg = configRef.current;
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue;
    const ndx = mx - n.x;
    const ndy = my - n.y;
    const nStyle = cfg.style.node(n.data, n.degree);
    if (Math.sqrt(ndx * ndx + ndy * ndy) <= nStyle.radius) {
      toggleNode(n.id);
      return;
    }
  }
}, [toggleNode]);
```

- [ ] **Step 2: Update drawFrame for opacity rendering**

Replace the edge drawing block in `drawFrame()` (the `for (const e of simEdges)` loop) with:

```tsx
      // Draw edges
      for (const e of simEdges) {
        const src = e.source as unknown as SimpleNode;
        const tgt = e.target as unknown as SimpleNode;
        if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
        const eStyle = cfg.style.edge(e.data);
        c.beginPath();
        c.moveTo(src.x, src.y);
        c.lineTo(tgt.x, tgt.y);
        if (eStyle.gradientSourceColor && eStyle.gradientTargetColor) {
          const grad = c.createLinearGradient(src.x, src.y, tgt.x, tgt.y);
          grad.addColorStop(0, eStyle.gradientSourceColor);
          grad.addColorStop(1, eStyle.gradientTargetColor);
          c.strokeStyle = grad;
        } else {
          c.strokeStyle = eStyle.color;
        }
        c.lineWidth = eStyle.width;

        // Selection-based opacity
        if (hasSelectionRef.current) {
          const srcActive = activeNodeIdsRef.current.has(src.id);
          const tgtActive = activeNodeIdsRef.current.has(tgt.id);
          c.globalAlpha = (srcActive || tgtActive) ? eStyle.opacity : 0.15;
        } else {
          c.globalAlpha = eStyle.opacity;
        }

        c.stroke();
        c.globalAlpha = 1.0;
      }
```

Replace the node drawing block (the `for (const n of simNodes)` loop) with:

```tsx
      // Draw nodes
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue;
        const nStyle = cfg.style.node(n.data, n.degree);

        // Selection-based opacity
        const isActive = hasSelectionRef.current ? activeNodeIdsRef.current.has(n.id) : true;
        const nodeAlpha = hasSelectionRef.current ? (isActive ? nStyle.opacity : 0.3) : nStyle.opacity;

        c.beginPath();
        c.arc(n.x, n.y, nStyle.radius, 0, 2 * Math.PI);
        c.fillStyle = nStyle.color;
        c.globalAlpha = nodeAlpha;
        c.fill();
        c.globalAlpha = 1.0;
        c.strokeStyle = '#fff';
        c.lineWidth = 1;
        c.stroke();
        if (nStyle.label) {
          c.globalAlpha = nodeAlpha;
          c.fillStyle = '#374151';
          c.font = '10px sans-serif';
          c.textAlign = 'center';
          c.fillText(n.name, n.x, n.y + nStyle.radius + 10);
          c.globalAlpha = 1.0;
        }

        // Dashed blue selection ring for selected nodes
        if (selectedNodeIdsRef.current.has(n.id)) {
          c.beginPath();
          c.arc(n.x, n.y, nStyle.radius + 2, 0, 2 * Math.PI);
          c.strokeStyle = '#3b82f6';
          c.lineWidth = 2;
          c.setLineDash([4, 3]);
          c.stroke();
          c.setLineDash([]);
        }
      }
```

- [ ] **Step 3: Add mouse event handlers to canvas element**

Update the `<canvas>` element to include the new handlers:

```tsx
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-label="Repository structure graph"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
```

- [ ] **Step 4: Update existing RepoGraph tests to provide SelectionContext**

In `__tests__/components/RepoGraph.test.tsx`, mock the `useSelection` hook. Add this mock near the top, after the d3 mock:

```tsx
jest.mock('@/app/contexts/SelectionContext', () => ({
  useSelection: () => ({
    activeNodeIds: new Set<string>(),
    selectedNodeIds: new Set<string>(),
    hasSelection: false,
    toggleNode: jest.fn(),
    clearSelection: jest.fn(),
    toggleExpansionGroup: jest.fn(),
    toggleExpandedNode: jest.fn(),
    state: {
      selectedNodeIds: new Set<string>(),
      expansions: new Map(),
    },
  }),
}));
```

Also add `setLineDash` to the canvas context mock (needed for dashed selection rings):

```tsx
// In the canvas mock setup, add:
setLineDash: jest.fn(),
```

- [ ] **Step 5: Run build and tests to verify**

Run: `npm run build 2>&1 | tail -10`
Run: `npm test 2>&1 | tail -20`
Expected: Build succeeds, all tests pass

- [ ] **Step 6: Commit**

```bash
git add app/components/repo-graph/RepoGraph.tsx __tests__/components/RepoGraph.test.tsx
git commit -m "feat: add click selection and opacity rendering to RepoGraph (#11)"
```

---

### Task 5: RepoGraph — Zoom-to-Fit on Active Set Change

**Files:**
- Modify: `app/components/repo-graph/RepoGraph.tsx`

- [ ] **Step 1: Add zoom-to-fit effect with retry logic**

Add this `useEffect` after the existing search handler `useEffect` block (after line 366). This includes a retry mechanism for when the simulation hasn't positioned nodes yet (important for cross-tab navigation):

```tsx
  // Zoom-to-fit when active set changes
  useEffect(() => {
    if (activeNodeIds.size === 0) return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 40; // 40 × 50ms = 2s

    function tryZoomToFit() {
      if (cancelled) return;
      attempts++;

      if (!canvasRef.current || !zoomRef.current) {
        if (attempts < MAX_ATTEMPTS) setTimeout(tryZoomToFit, 50);
        return;
      }

      // Check that nodes have been positioned
      const activeNodes = simNodesRef.current.filter(
        (n) => activeNodeIds.has(n.id) && n.x != null && n.y != null
      );
      if (activeNodes.length === 0) {
        if (attempts < MAX_ATTEMPTS) setTimeout(tryZoomToFit, 50);
        return;
      }

      const canvas = canvasRef.current;
      const w = canvas.offsetWidth || 800;
      const h = canvas.offsetHeight || 600;
      const t = zoomTransformRef.current;

      // Compute bounding box of active nodes in simulation coords
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of activeNodes) {
        const cfg = configRef.current;
        const r = cfg.style.node(n.data, n.degree).radius;
        minX = Math.min(minX, n.x! - r);
        minY = Math.min(minY, n.y! - r);
        maxX = Math.max(maxX, n.x! + r);
        maxY = Math.max(maxY, n.y! + r);
      }

      // Check if all active nodes are already visible in viewport
      const viewMinX = (0 - t.x) / t.k;
      const viewMinY = (0 - t.y) / t.k;
      const viewMaxX = (w - t.x) / t.k;
      const viewMaxY = (h - t.y) / t.k;

      if (minX >= viewMinX && maxX <= viewMaxX && minY >= viewMinY && maxY <= viewMaxY) {
        return; // already visible
      }

      // Compute zoom transform to fit bounding box with padding
      const padding = 40;
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const scale = Math.min(
        (w - 2 * padding) / Math.max(bboxW, 1),
        (h - 2 * padding) / Math.max(bboxH, 1),
        4, // max zoom
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const transform = d3.zoomIdentity
        .translate(w / 2 - cx * scale, h / 2 - cy * scale)
        .scale(scale);

      d3.select(canvas as any)
        .transition()
        .duration(250)
        .call((zoomRef.current as any).transform, transform);
    }

    tryZoomToFit();
    return () => { cancelled = true; };
  }, [activeNodeIds]);
```

- [ ] **Step 2: Run build to verify no errors**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/components/repo-graph/RepoGraph.tsx
git commit -m "feat: add zoom-to-fit on active set change (#11)"
```

---

### Task 6: Integrate SelectionProvider and Sidebar into page.tsx and RepoGraph

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/components/repo-graph/RepoGraph.tsx`

- [ ] **Step 1: Update page.tsx layout — wrap with SelectionProvider and add sidebar**

In `app/page.tsx`, add imports:

```tsx
import { SelectionProvider } from './contexts/SelectionContext';
import SelectionSidebar from './components/selection/SelectionSidebar';
```

Replace the graph content area (the `<div className="flex-1 min-h-0">` containing RepoGraph, around lines 161-196) with a structure that wraps the graph tab content with `SelectionProvider` and includes the sidebar. The provider is always mounted when the graph tab is active, using empty arrays as fallbacks:

```tsx
          {/* Content */}
          <div className="flex-1 min-h-0">
            {!repoPath ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
                Select a repository to visualize
              </div>
            ) : activeTab === 'graph' ? (
              <SelectionProvider
                nodes={analysisData?.nodes ?? []}
                edges={analysisData?.edges ?? []}
                visibleNodeIds={graphVisibleNodeIds}
              >
                <SelectionBridge toggleRef={selectionToggleRef} />
                <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <RepoGraph
                      repoPath={repoPath}
                      hideTestFiles={hideTestFiles}
                      config={VIEW_OPTIONS[selectedView].config}
                      onSearchNode={handleRegisterSearch}
                      analysisData={analysisData}
                      loading={loading}
                      error={error}
                    />
                  </div>
                  <SelectionSidebarWrapper nodes={analysisData?.nodes ?? []} />
                </div>
              </SelectionProvider>
            ) : (
              analysisData ? (
                <StatsTreemap
                  nodes={analysisData.nodes}
                  topN={topN}
                  hideTestFiles={hideTestFiles}
                  onNodeSelect={handleNodeSelect}
                  graphVisibleNodeIds={graphVisibleNodeIds}
                />
              ) : loading ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  Analyzing repository...
                </div>
              ) : error ? (
                <div className="w-full h-full flex items-center justify-center text-red-500">
                  {error}
                </div>
              ) : null
            )}
          </div>
```

Note: `highlightedNodeId` is no longer passed to `RepoGraph` — it will be removed in Task 8.

Add a `SelectionSidebarWrapper` component above `HomePage` that conditionally renders the sidebar:

```tsx
function SelectionSidebarWrapper({ nodes }: { nodes: AnalysisNode[] }) {
  const { hasSelection } = useSelection();
  if (!hasSelection) return null;
  return <SelectionSidebar nodes={nodes} />;
}
```

Also add the `AnalysisNode` import:

```tsx
import type { AnalysisEdge, AnalysisNode, AnalysisResult } from '@/lib/analysis/types';
```

Add a ref and state for the cross-tab selection bridge (used in Task 7):

```tsx
const selectionToggleRef = useRef<((id: string) => void) | null>(null);
const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
```

- [ ] **Step 2: Handle the loading/error states inside the provider branch**

The `RepoGraph` component handles its own loading/error states internally, so the fallback `RepoGraph` render (when `analysisData` is null) handles the loading/error case.

- [ ] **Step 3: Run build to verify**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Run all tests**

Run: `npm test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/components/repo-graph/RepoGraph.tsx
git commit -m "feat: integrate SelectionProvider and sidebar into layout (#11)"
```

---

### Task 7: Migrate Search & Cross-Tab to Selection System

**Files:**
- Modify: `app/components/repo-graph/RepoGraph.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update search handler to use selection**

In `RepoGraph.tsx`, update `handleSearchNode` to use `toggleNode` instead of `highlightedNodeIdRef`. Replace the entire `handleSearchNode` callback:

```tsx
  const handleSearchNode = useCallback((query: string): boolean => {
    const lowerQ = query.toLowerCase();
    const match =
      simNodesRef.current.find((n) => n.name.toLowerCase() === lowerQ) ??
      simNodesRef.current.find((n) => n.name.toLowerCase().includes(lowerQ));

    if (!match || match.x == null || match.y == null) return false;

    // Select the node — zoom-to-fit effect handles centering
    if (!selectedNodeIdsRef.current.has(match.id)) {
      toggleNode(match.id);
    }

    return true;
  }, [toggleNode]);
```

- [ ] **Step 2: Update cross-tab navigation in page.tsx**

In `page.tsx`, update `handleNodeSelect` to use a pending selection pattern. Since `handleNodeSelect` is called from `StatsTreemap` which is outside the `SelectionProvider`, we use a `pendingSelectionId` state that the provider consumes when it mounts.

Add a state and ref for pending selection:

```tsx
const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
const selectionToggleRef = useRef<((id: string) => void) | null>(null);
```

Update `handleNodeSelect`:

```tsx
  const handleNodeSelect = useCallback((scipSymbol: string) => {
    setActiveTab('graph');
    setPendingSelectionId(scipSymbol);
  }, []);
```

Create a bridge component inside the `SelectionProvider` to consume the pending selection:

```tsx
function SelectionBridge({ toggleRef, pendingId, onPendingConsumed }: {
  toggleRef: MutableRefObject<((id: string) => void) | null>;
  pendingId: string | null;
  onPendingConsumed: () => void;
}) {
  const { toggleNode, selectedNodeIds } = useSelection();
  useEffect(() => {
    toggleRef.current = (id: string) => {
      if (!selectedNodeIds.has(id)) toggleNode(id);
    };
    return () => { toggleRef.current = null; };
  }, [toggleNode, selectedNodeIds, toggleRef]);

  // Consume pending selection when mounted
  useEffect(() => {
    if (pendingId && !selectedNodeIds.has(pendingId)) {
      toggleNode(pendingId);
      onPendingConsumed();
    }
  }, [pendingId, toggleNode, selectedNodeIds, onPendingConsumed]);

  return null;
}
```

Update the `SelectionBridge` usage in the JSX to pass the pending props:

```tsx
<SelectionBridge
  toggleRef={selectionToggleRef}
  pendingId={pendingSelectionId}
  onPendingConsumed={() => setPendingSelectionId(null)}
/>
```

Add `MutableRefObject` to the import from `react`:

```tsx
import { useState, useCallback, useRef, useEffect, useMemo, type MutableRefObject } from 'react';
```

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add app/components/repo-graph/RepoGraph.tsx app/page.tsx
git commit -m "feat: migrate search and cross-tab to selection system (#11)"
```

---

### Task 8: Remove Old Highlight System

**Files:**
- Modify: `app/components/repo-graph/RepoGraph.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Remove old highlight code from RepoGraph.tsx**

Remove or replace the following:

1. Delete `const HIGHLIGHT_COLOR = '#facc15';` (line 35)
2. Delete `const highlightedNodeIdRef = useRef<string | null>(null);` (line 46)
3. Remove `highlightedNodeId` from the props interface and destructuring — remove `highlightedNodeId?: string | null;` from `RepoGraphProps` and from the function parameters
4. Remove the old highlight drawing code — the yellow ring block (previously lines 258-264) was already replaced in Task 4
5. Remove the `setTimeout` in search handler — already replaced in Task 7
6. Remove the entire external highlight `useEffect` block (the `if (!highlightedNodeId) return;` effect, previously lines 372-433)

- [ ] **Step 2: Remove old highlight code from page.tsx**

1. Delete `const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);` (line 25)
2. Delete the entire highlight auto-clear `useEffect` (lines 111-116)
3. Remove `highlightedNodeId={highlightedNodeId}` from both `<RepoGraph>` usage sites
4. Remove the old `handleNodeSelect` reference to `setHighlightedNodeId` — already done in Task 7

- [ ] **Step 3: Run build to verify**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds with no type errors

- [ ] **Step 4: Run all tests**

Run: `npm test 2>&1 | tail -20`
Expected: All tests pass. Some existing tests may need minor updates if they reference `highlightedNodeId` prop — update the mock `RepoGraph` in `__tests__/page.test.tsx` to not expect the prop.

- [ ] **Step 5: Update existing tests if needed**

In `__tests__/page.test.tsx`, if the mock `RepoGraph` captures `highlightedNodeId`, update to not check for it since it's been removed.

In `__tests__/components/RepoGraph.test.tsx`, remove any references to `highlightedNodeId` prop from test renders.

- [ ] **Step 6: Run all tests again to confirm**

Run: `npm test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add app/components/repo-graph/RepoGraph.tsx app/page.tsx __tests__/page.test.tsx __tests__/components/RepoGraph.test.tsx
git commit -m "refactor: remove old highlight system (#11)"
```

---

### Task 9: Final Build + Test Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test 2>&1 | tail -30`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `npm run lint 2>&1 | tail -10`
Expected: No new lint errors
