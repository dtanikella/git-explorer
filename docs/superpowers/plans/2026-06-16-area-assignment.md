# Area Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a UI component in the selection sidebar that lets users assign their current selection to an area (existing or new), persisting to `.git-explorer/areas.json`.

**Architecture:** A self-contained `AreaAssignment` component renders at the bottom of `SelectionSidebar`. It reads areas from `AreaContext`, computes common areas for display as badges, and calls `POST /api/areas` to save. `AreaContext` gains a `setAreas()` method so the component can push updated state after save.

**Tech Stack:** React, Next.js, TypeScript, existing `AreaContext` + `/api/areas` route.

---

### Task 1: Add `setAreas` to AreaContext

**Files:**
- Modify: `app/contexts/AreaContext.tsx:8-15` (AreaStoreValue interface)
- Modify: `app/contexts/AreaContext.tsx:62-114` (AreaProvider implementation)
- Test: `__tests__/contexts/AreaContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test to `__tests__/contexts/AreaContext.test.tsx`:

```tsx
it('setAreas updates areas and rebuilds runtime state', () => {
  const { result } = renderHook(() => useAreaStore(), { wrapper });
  expect(result.current.areas).toHaveLength(2);

  const newArea: Area = {
    id: 'payments',
    created_at: '2026-06-16T00:00:00Z',
    updated_at: '2026-06-16T00:00:00Z',
    name: 'Payments',
    type: 'business_domain',
    contains: ['sym-pay'],
    parent: null,
    children: [],
    clusterStrength: 0,
  };

  act(() => {
    result.current.setAreas([...mockAreas, newArea]);
  });

  expect(result.current.areas).toHaveLength(3);
  expect(result.current.runtimeState.get('payments')).toBeDefined();
  expect(result.current.runtimeState.get('payments')!.visible).toBe(true);
  // Existing runtime state is preserved
  expect(result.current.runtimeState.get('auth')).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern='contexts/AreaContext' --verbose`
Expected: FAIL — `result.current.setAreas is not a function`

- [ ] **Step 3: Implement `setAreas` in AreaContext**

In `app/contexts/AreaContext.tsx`, add `setAreas` to the interface and implementation:

First, update the `AreaStoreValue` interface (line 8-15):

```ts
export interface AreaStoreValue {
  areas: Area[];
  runtimeState: Map<string, AreaRuntimeState>;
  nodeToAreas: Map<string, Area[]>;
  toggleVisibility(areaId: string): void;
  getVisibleAreas(): Area[];
  getAreasForNode(scipSymbol: string): Area[];
  setAreas(areas: Area[]): void;
}
```

Next, in `AreaProvider`, change from using the `areas` prop directly to using local state initialized from the prop. Replace the current implementation (lines 62-114):

```tsx
export function AreaProvider({ areas: initialAreas, children }: AreaProviderProps) {
  const [areas, setAreasState] = useState<Area[]>(initialAreas);
  const [runtimeState, setRuntimeState] = useState<Map<string, AreaRuntimeState>>(() =>
    buildInitialRuntimeState(areas),
  );

  // Sync when prop changes (e.g., re-fetch on sidebar open)
  useEffect(() => {
    setAreasState(initialAreas);
  }, [initialAreas]);

  // Rebuild runtime state when areas change (new areas get defaults)
  useEffect(() => {
    setRuntimeState((prev) => {
      const next = new Map<string, AreaRuntimeState>();
      for (const area of areas) {
        const existing = prev.get(area.id);
        next.set(area.id, existing ?? { visible: true, color: hashToColor(area.id) });
      }
      return next;
    });
  }, [areas]);

  const nodeToAreas = useMemo(() => buildNodeToAreas(areas), [areas]);

  const setAreas = useCallback((newAreas: Area[]) => {
    setAreasState(newAreas);
  }, []);

  const toggleVisibility = useCallback((areaId: string) => {
    setRuntimeState((prev) => {
      const next = new Map(prev);
      const state = next.get(areaId);
      if (state) {
        next.set(areaId, { ...state, visible: !state.visible });
      }
      return next;
    });
  }, []);

  const getVisibleAreas = useCallback((): Area[] => {
    return areas.filter((a) => runtimeState.get(a.id)?.visible === true);
  }, [areas, runtimeState]);

  const getAreasForNode = useCallback((scipSymbol: string): Area[] => {
    return nodeToAreas.get(scipSymbol) ?? [];
  }, [nodeToAreas]);

  const value = useMemo<AreaStoreValue>(() => ({
    areas,
    runtimeState,
    nodeToAreas,
    toggleVisibility,
    getVisibleAreas,
    getAreasForNode,
    setAreas,
  }), [areas, runtimeState, nodeToAreas, toggleVisibility, getVisibleAreas, getAreasForNode, setAreas]);

  return (
    <AreaContext.Provider value={value}>
      {children}
    </AreaContext.Provider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern='contexts/AreaContext' --verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/contexts/AreaContext.tsx __tests__/contexts/AreaContext.test.tsx
git commit -m "feat(areas): add setAreas to AreaContext for programmatic updates"
```

---

### Task 2: Create `AreaAssignment` component — area picker and common area badges

**Files:**
- Create: `app/components/selection/AreaAssignment.tsx`
- Test: `__tests__/components/selection/AreaAssignment.test.tsx`

- [ ] **Step 1: Write failing tests for area picker and common badges**

Create `__tests__/components/selection/AreaAssignment.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AreaAssignment from '@/app/components/selection/AreaAssignment';
import { AreaProvider } from '@/app/contexts/AreaContext';
import type { Area } from '@/lib/areas/types';

const mockAreas: Area[] = [
  {
    id: 'auth',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Auth Service',
    type: 'business_domain',
    contains: ['sym-login', 'sym-logout', 'sym-validate'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
  {
    id: 'payments',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Payments',
    type: 'business_domain',
    contains: ['sym-charge', 'sym-refund'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
];

function renderWithProvider(
  effectiveNodeIds: string[],
  areas: Area[] = mockAreas,
  repoPath = '/tmp/test-repo',
) {
  return render(
    <AreaProvider areas={areas}>
      <AreaAssignment effectiveNodeIds={effectiveNodeIds} repoPath={repoPath} />
    </AreaProvider>,
  );
}

describe('AreaAssignment', () => {
  describe('area picker dropdown', () => {
    it('renders dropdown with existing areas and + New Area option', () => {
      renderWithProvider(['sym-login']);
      const select = screen.getByTestId('area-picker');
      expect(select).toBeInTheDocument();
      // Should have existing areas + the new area option
      const options = within(select).getAllByRole('option');
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts).toContain('Auth Service');
      expect(optionTexts).toContain('Payments');
      expect(optionTexts).toContain('+ New Area');
    });

    it('shows only + New Area when no areas exist', () => {
      renderWithProvider(['sym-login'], []);
      const select = screen.getByTestId('area-picker');
      const options = within(select).getAllByRole('option');
      // placeholder + New Area
      expect(options.filter((o) => o.textContent !== 'Select an area…')).toHaveLength(1);
      expect(options.map((o) => o.textContent)).toContain('+ New Area');
    });
  });

  describe('common area badges', () => {
    it('shows common area badge when all nodes share an area', () => {
      // sym-login and sym-logout both belong to Auth Service
      renderWithProvider(['sym-login', 'sym-logout']);
      expect(screen.getByTestId('common-area-badge-auth')).toHaveTextContent('Auth Service');
    });

    it('does not show badge when nodes do not share an area', () => {
      // sym-login (Auth) and sym-charge (Payments) share no area
      renderWithProvider(['sym-login', 'sym-charge']);
      expect(screen.queryByTestId('common-area-badge-auth')).not.toBeInTheDocument();
      expect(screen.queryByTestId('common-area-badge-payments')).not.toBeInTheDocument();
    });

    it('shows no badges section when no common areas', () => {
      renderWithProvider(['sym-login', 'sym-charge']);
      expect(screen.queryByText('Common areas:')).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('disables Add to Area button when effectiveNodeIds is empty', () => {
      renderWithProvider([]);
      const select = screen.getByTestId('area-picker');
      // Select an existing area
      const user = userEvent.setup();
      // The button should be disabled
      const button = screen.getByTestId('area-action-button');
      expect(button).toBeDisabled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='components/selection/AreaAssignment' --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create the AreaAssignment component**

Create `app/components/selection/AreaAssignment.tsx`:

```tsx
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAreaStore } from '@/app/contexts/AreaContext';
import type { Area, AreaType } from '@/lib/areas/types';
import { AREA_TYPES } from '@/lib/areas/types';

interface AreaAssignmentProps {
  effectiveNodeIds: string[];
  repoPath: string;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

const NEW_AREA_SENTINEL = '__new__';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateAreaId(name: string): string {
  const slug = slugify(name);
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${slug}-${suffix}`;
}

export default function AreaAssignment({ effectiveNodeIds, repoPath }: AreaAssignmentProps) {
  const { areas, runtimeState, getAreasForNode, setAreas } = useAreaStore();

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New area form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AreaType>('business_domain');
  const [newParent, setNewParent] = useState<string | null>(null);
  const [newChildren, setNewChildren] = useState<string[]>([]);

  // Auto-dismiss success indicator
  useEffect(() => {
    if (saveStatus === 'success') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // Compute common areas shared by ALL effective nodes
  const commonAreas = useMemo(() => {
    if (effectiveNodeIds.length === 0) return [];
    const areasByNode = effectiveNodeIds.map((id) => getAreasForNode(id));
    if (areasByNode.length === 0) return [];
    // Intersect: keep areas that appear in every node's area list
    const firstSet = new Set(areasByNode[0].map((a) => a.id));
    for (let i = 1; i < areasByNode.length; i++) {
      const nodeAreaIds = new Set(areasByNode[i].map((a) => a.id));
      for (const id of firstSet) {
        if (!nodeAreaIds.has(id)) firstSet.delete(id);
      }
    }
    return areas.filter((a) => firstSet.has(a.id));
  }, [effectiveNodeIds, getAreasForNode, areas]);

  const isNewArea = selectedAreaId === NEW_AREA_SENTINEL;
  const hasNodes = effectiveNodeIds.length > 0;
  const canSubmit = hasNodes && (isNewArea ? newName.trim().length > 0 : selectedAreaId !== null);

  const saveAreaFile = useCallback(async (updatedAreas: Area[]) => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          repoPath,
          data: { version: 1, areas: updatedAreas },
        }),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Save failed');
      }
      setAreas(updatedAreas);
      setSaveStatus('success');
    } catch (err) {
      setSaveStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
    }
  }, [repoPath, setAreas]);

  const handleAddToExisting = useCallback(async () => {
    if (!selectedAreaId || selectedAreaId === NEW_AREA_SENTINEL) return;
    const now = new Date().toISOString();
    const updatedAreas = areas.map((a) => {
      if (a.id !== selectedAreaId) return a;
      const mergedContains = [...new Set([...a.contains, ...effectiveNodeIds])];
      return { ...a, contains: mergedContains, updated_at: now };
    });
    await saveAreaFile(updatedAreas);
  }, [selectedAreaId, areas, effectiveNodeIds, saveAreaFile]);

  const handleCreateNew = useCallback(async () => {
    if (!newName.trim()) return;
    const now = new Date().toISOString();
    const newArea: Area = {
      id: generateAreaId(newName),
      created_at: now,
      updated_at: now,
      name: newName.trim(),
      type: newType,
      contains: [...effectiveNodeIds],
      parent: newParent,
      children: [...newChildren],
      clusterStrength: 0,
    };

    // Wire bidirectional parent/children
    let updatedAreas = [...areas, newArea];
    if (newParent) {
      updatedAreas = updatedAreas.map((a) => {
        if (a.id !== newParent) return a;
        return { ...a, children: [...new Set([...a.children, newArea.id])], updated_at: now };
      });
    }
    for (const childId of newChildren) {
      updatedAreas = updatedAreas.map((a) => {
        if (a.id !== childId) return a;
        return { ...a, parent: newArea.id, updated_at: now };
      });
    }

    await saveAreaFile(updatedAreas);
    // Reset form
    setNewName('');
    setNewType('business_domain');
    setNewParent(null);
    setNewChildren([]);
    setSelectedAreaId(null);
  }, [newName, newType, newParent, newChildren, areas, effectiveNodeIds, saveAreaFile]);

  const handleAction = useCallback(() => {
    if (isNewArea) {
      handleCreateNew();
    } else {
      handleAddToExisting();
    }
  }, [isNewArea, handleCreateNew, handleAddToExisting]);

  return (
    <div
      style={{
        padding: '10px 12px',
        background: '#f3f4f6',
        borderTop: '2px solid #e5e7eb',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 11,
          color: '#374151',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
        }}
      >
        Assign to Area
      </div>

      {/* Common area badges */}
      {commonAreas.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: '#6b7280' }}>Common areas:</span>
          {commonAreas.map((area) => {
            const areaColor = runtimeState.get(area.id)?.color ?? '#6b7280';
            return (
              <span
                key={area.id}
                data-testid={`common-area-badge-${area.id}`}
                style={{
                  display: 'inline-block',
                  background: `${areaColor}26`,
                  color: areaColor,
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 9,
                  marginLeft: 4,
                  fontWeight: 500,
                }}
              >
                {area.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Area picker dropdown */}
      <select
        data-testid="area-picker"
        value={selectedAreaId ?? ''}
        onChange={(e) => setSelectedAreaId(e.target.value || null)}
        style={{
          width: '100%',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 12,
          background: 'white',
          marginBottom: isNewArea ? 10 : 8,
          color: selectedAreaId ? '#374151' : '#9ca3af',
        }}
      >
        <option value="">Select an area…</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
        <option value={NEW_AREA_SENTINEL}>+ New Area</option>
      </select>

      {/* New area form (only when + New Area selected) */}
      {isNewArea && (
        <div
          style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 10,
            marginBottom: 8,
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>
              Name *
            </label>
            <input
              data-testid="new-area-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Config Pipeline"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: 12,
              }}
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>
              Type
            </label>
            <select
              data-testid="new-area-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as AreaType)}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: 12,
                background: 'white',
              }}
            >
              {AREA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>
              Parent
            </label>
            <select
              data-testid="new-area-parent"
              value={newParent ?? ''}
              onChange={(e) => setNewParent(e.target.value || null)}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: 12,
                background: 'white',
              }}
            >
              <option value="">None</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 2 }}>
            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>
              Children
            </label>
            <select
              data-testid="new-area-children"
              multiple
              value={newChildren}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                setNewChildren(selected);
              }}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: 12,
                background: 'white',
                minHeight: 48,
              }}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Action button + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          data-testid="area-action-button"
          onClick={handleAction}
          disabled={!canSubmit || saveStatus === 'saving'}
          style={{
            flex: 1,
            padding: '6px 0',
            background: canSubmit ? (isNewArea ? '#059669' : '#3b82f6') : '#d1d5db',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            cursor: canSubmit ? 'pointer' : 'default',
            opacity: saveStatus === 'saving' ? 0.7 : 1,
          }}
          title={!hasNodes ? 'No nodes to assign' : undefined}
        >
          {saveStatus === 'saving'
            ? 'Saving…'
            : isNewArea
              ? 'Create Area'
              : 'Add to Area'}
        </button>
        {saveStatus === 'success' && (
          <span style={{ color: '#059669', fontSize: 14 }} data-testid="save-success">
            ✓
          </span>
        )}
        {saveStatus === 'error' && (
          <span
            style={{ color: '#dc2626', fontSize: 11 }}
            data-testid="save-error"
          >
            {errorMessage ?? 'Save failed'}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern='components/selection/AreaAssignment' --verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/selection/AreaAssignment.tsx __tests__/components/selection/AreaAssignment.test.tsx
git commit -m "feat(areas): add AreaAssignment component with picker and common badges"
```

---

### Task 3: Test save flows — add to existing and create new

**Files:**
- Modify: `__tests__/components/selection/AreaAssignment.test.tsx`

- [ ] **Step 1: Write failing tests for add-to-existing and create-new flows**

Add these tests to the existing `AreaAssignment.test.tsx`:

```tsx
describe('add to existing area', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    (global.fetch as jest.Mock).mockRestore();
  });

  it('calls API with merged contains on Add to Area', async () => {
    const user = userEvent.setup();
    renderWithProvider(['sym-new-node']);

    // Select existing area
    await user.selectOptions(screen.getByTestId('area-picker'), 'auth');
    await user.click(screen.getByTestId('area-action-button'));

    expect(global.fetch).toHaveBeenCalledWith('/api/areas', expect.objectContaining({
      method: 'POST',
    }));

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.action).toBe('save');
    const savedAuth = callBody.data.areas.find((a: Area) => a.id === 'auth');
    // Original contains + new node, deduplicated
    expect(savedAuth.contains).toContain('sym-login');
    expect(savedAuth.contains).toContain('sym-logout');
    expect(savedAuth.contains).toContain('sym-validate');
    expect(savedAuth.contains).toContain('sym-new-node');
  });

  it('deduplicates node IDs when adding to existing area', async () => {
    const user = userEvent.setup();
    // sym-login is already in Auth Service
    renderWithProvider(['sym-login']);

    await user.selectOptions(screen.getByTestId('area-picker'), 'auth');
    await user.click(screen.getByTestId('area-action-button'));

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const savedAuth = callBody.data.areas.find((a: Area) => a.id === 'auth');
    // Should not have duplicate sym-login
    const loginCount = savedAuth.contains.filter((c: string) => c === 'sym-login').length;
    expect(loginCount).toBe(1);
  });

  it('shows success indicator after save', async () => {
    const user = userEvent.setup();
    renderWithProvider(['sym-new-node']);

    await user.selectOptions(screen.getByTestId('area-picker'), 'auth');
    await user.click(screen.getByTestId('area-action-button'));

    expect(await screen.findByTestId('save-success')).toBeInTheDocument();
  });
});

describe('create new area', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    (global.fetch as jest.Mock).mockRestore();
  });

  it('creates area with name and effective nodes as contains', async () => {
    const user = userEvent.setup();
    renderWithProvider(['sym-a', 'sym-b']);

    await user.selectOptions(screen.getByTestId('area-picker'), NEW_AREA_SENTINEL);
    await user.type(screen.getByTestId('new-area-name'), 'Config Pipeline');
    await user.click(screen.getByTestId('area-action-button'));

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const newArea = callBody.data.areas.find((a: Area) => a.name === 'Config Pipeline');
    expect(newArea).toBeDefined();
    expect(newArea.contains).toEqual(['sym-a', 'sym-b']);
    expect(newArea.type).toBe('business_domain');
    expect(newArea.id).toMatch(/^config-pipeline-[0-9a-f]{4}$/);
    expect(newArea.clusterStrength).toBe(0);
  });

  it('wires bidirectional parent relationship', async () => {
    const user = userEvent.setup();
    renderWithProvider(['sym-a']);

    await user.selectOptions(screen.getByTestId('area-picker'), NEW_AREA_SENTINEL);
    await user.type(screen.getByTestId('new-area-name'), 'Sub Auth');
    await user.selectOptions(screen.getByTestId('new-area-parent'), 'auth');
    await user.click(screen.getByTestId('area-action-button'));

    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const newArea = callBody.data.areas.find((a: Area) => a.name === 'Sub Auth');
    expect(newArea.parent).toBe('auth');

    const parentArea = callBody.data.areas.find((a: Area) => a.id === 'auth');
    expect(parentArea.children).toContain(newArea.id);
  });

  it('disables Create Area when name is empty', async () => {
    const user = userEvent.setup();
    renderWithProvider(['sym-a']);
    await user.selectOptions(screen.getByTestId('area-picker'), NEW_AREA_SENTINEL);
    // Don't type a name
    expect(screen.getByTestId('area-action-button')).toBeDisabled();
  });
});

describe('error handling', () => {
  it('shows error message on API failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Disk full' }),
    });
    const user = userEvent.setup();
    renderWithProvider(['sym-a']);

    await user.selectOptions(screen.getByTestId('area-picker'), 'auth');
    await user.click(screen.getByTestId('area-action-button'));

    expect(await screen.findByTestId('save-error')).toHaveTextContent('Disk full');
    (global.fetch as jest.Mock).mockRestore();
  });
});
```

Also add this import at the top of the file for the sentinel:

```ts
const NEW_AREA_SENTINEL = '__new__';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='components/selection/AreaAssignment' --verbose`
Expected: FAIL — tests should fail because the component was just created and fetch mocking needs verification

- [ ] **Step 3: Fix any issues**

If tests pass already (component from Task 2 has the logic), great. If not, debug and fix the component logic.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test -- --testPathPattern='components/selection/AreaAssignment' --verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/components/selection/AreaAssignment.test.tsx
git commit -m "test(areas): add save flow tests for AreaAssignment"
```

---

### Task 4: Integrate AreaAssignment into SelectionSidebar

**Files:**
- Modify: `app/components/selection/SelectionSidebar.tsx:1-10` (imports)
- Modify: `app/components/selection/SelectionSidebar.tsx:8-9` (props interface)
- Modify: `app/components/selection/SelectionSidebar.tsx:23-24` (destructure activeNodeIds)
- Modify: `app/components/selection/SelectionSidebar.tsx:313-316` (render AreaAssignment before closing divs)
- Modify: `app/page.tsx:24-28` (SelectionSidebarWrapper — pass repoPath)

- [ ] **Step 1: Update SelectionSidebar props and imports**

In `app/components/selection/SelectionSidebar.tsx`, add import and update props:

Add import at top:
```tsx
import AreaAssignment from '@/app/components/selection/AreaAssignment';
import { useSelection } from '@/app/contexts/SelectionContext';
```

Update the props interface:
```tsx
interface SelectionSidebarProps {
  nodes: AnalysisNode[];
  repoPath: string;
}
```

Update component signature to accept and use `repoPath`, and get `activeNodeIds`:
```tsx
export default function SelectionSidebar({ nodes, repoPath }: SelectionSidebarProps) {
  const { state, clearSelection, toggleNode, toggleExpansionGroup, toggleExpandedNode, activeNodeIds } = useSelection();
```

- [ ] **Step 2: Render AreaAssignment at the bottom of the scrollable area**

In `SelectionSidebar.tsx`, just before the closing `</div>` of the scrollable content div (after the expansion groups `map` block, before line 315 `</div>`), add:

```tsx
        {/* Area assignment section */}
        <AreaAssignment
          effectiveNodeIds={[...activeNodeIds]}
          repoPath={repoPath}
        />
```

- [ ] **Step 3: Update SelectionSidebarWrapper in page.tsx to pass repoPath**

In `app/page.tsx`, update `SelectionSidebarWrapper` to accept and pass `repoPath`:

```tsx
function SelectionSidebarWrapper({ nodes, repoPath }: { nodes: AnalysisNode[]; repoPath: string }) {
  const { hasSelection } = useSelection();
  if (!hasSelection) return null;
  return <SelectionSidebar nodes={nodes} repoPath={repoPath} />;
}
```

And update the usage (around line 247):
```tsx
<SelectionSidebarWrapper nodes={analysisData?.nodes ?? []} repoPath={repoPath} />
```

- [ ] **Step 4: Run the full test suite to verify nothing is broken**

Run: `npm test -- --verbose`
Expected: All tests PASS (existing SelectionSidebar tests may need `repoPath` prop added to their render calls)

- [ ] **Step 5: Fix any broken tests**

If existing `SelectionSidebar` tests fail because of the new required `repoPath` prop, add `repoPath="/tmp/test"` to their render calls. Also wrap with `AreaProvider` if needed:

```tsx
<AreaProvider areas={[]}>
  <SelectionSidebar nodes={mockNodes} repoPath="/tmp/test" />
</AreaProvider>
```

- [ ] **Step 6: Commit**

```bash
git add app/components/selection/SelectionSidebar.tsx app/page.tsx
git commit -m "feat(areas): integrate AreaAssignment into SelectionSidebar"
```

---

### Task 5: Build verification and lint

**Files:** None (verification only)

- [ ] **Step 1: Run linter**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Fix any issues found**

Address any lint errors, type errors, or test failures.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint and type issues from area assignment"
```
