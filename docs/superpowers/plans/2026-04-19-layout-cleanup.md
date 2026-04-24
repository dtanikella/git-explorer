# Layout Restructuring & Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unused visualization components, delete the treemap library, restructure the page so TsGraph fills all remaining viewport space below a repo-selector row and a tools/filters toolbar row.

**Architecture:** Three-row full-viewport flexbox layout. Row 1: RepositorySelector (always visible). Row 2: Tools & Filters toolbar (date range, hide-test-files toggle, node search). Row 3: TsGraph (flex-1, full remaining space). ForcePanel controls are lifted into the toolbar; ForcePanel itself is deleted.

**Tech Stack:** Next.js, React, Tailwind CSS, D3

---

### Task 1: Delete unused component files and treemap library

**Files:**
- Delete: `app/components/force-directed-graph.tsx`
- Delete: `app/components/circle-packing-graph.tsx`
- Delete: `app/components/FileOccurrenceTable.tsx`
- Delete: `app/components/FileOccurrenceTable.css`
- Delete: `app/components/df.csv`
- Delete: `app/components/flare-2.json`
- Delete: `app/components/ts-graph/ForcePanel.tsx`
- Delete: `lib/treemap/color-scale.ts`
- Delete: `lib/treemap/data-transformer.ts`
- Delete: `lib/treemap/file-type-colors.ts`

- [ ] **Step 1: Delete component files**

```bash
rm app/components/force-directed-graph.tsx \
   app/components/circle-packing-graph.tsx \
   app/components/FileOccurrenceTable.tsx \
   app/components/FileOccurrenceTable.css \
   app/components/df.csv \
   app/components/flare-2.json \
   app/components/ts-graph/ForcePanel.tsx
```

- [ ] **Step 2: Delete treemap library directory**

```bash
rm -r lib/treemap
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete unused visualization components and treemap lib"
```

---

### Task 2: Delete obsolete test files

**Files:**
- Delete: `__tests__/components/TreemapChart.test.tsx`
- Delete: `__tests__/components/ForceGraphChart.test.tsx`
- Delete: `__tests__/unit/data-transformer.test.ts`
- Delete: `__tests__/unit/file-type-colors.test.ts`

- [ ] **Step 1: Delete test files that test deleted components**

```bash
rm __tests__/components/TreemapChart.test.tsx \
   __tests__/components/ForceGraphChart.test.tsx \
   __tests__/unit/data-transformer.test.ts \
   __tests__/unit/file-type-colors.test.ts
```

- [ ] **Step 2: Remove treemap mock from git-analysis-api integration test**

In `__tests__/integration/git-analysis-api.test.ts`, remove the treemap mock and reference:

Remove these lines:

```typescript
jest.mock('@/lib/treemap/data-transformer', () => ({
  applyColors: jest.fn(),
}));
```

And:

```typescript
const mockApplyColors = require('@/lib/treemap/data-transformer').applyColors;
```

And the entire `mockApplyColors.mockReturnValue(...)` block (lines 146–174).

The test for the 200 response should still work since `analyzeRepository` in git-controller doesn't actually call `applyColors` — the mock was never exercised on the code path under test.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: remove obsolete tests for deleted components"
```

---

### Task 3: Refactor TsGraph — remove ForcePanel, accept lifted props, fill container

**Files:**
- Modify: `app/components/ts-graph/TsGraph.tsx`

- [ ] **Step 1: Update TsGraphProps interface**

Replace the current interface:

```typescript
interface TsGraphProps {
  repoPath: string;
}
```

With:

```typescript
interface TsGraphProps {
  repoPath: string;
  hideTestFiles: boolean;
  onSearchNode?: (handler: (query: string) => boolean) => void;
}
```

`onSearchNode` is a registration callback — the parent passes a function that TsGraph calls with its `handleSearchNode` handler so the parent can invoke it from the toolbar.

- [ ] **Step 2: Remove ForcePanel import and internal hideTestFiles state**

Remove this import:

```typescript
import ForcePanel from './ForcePanel';
```

Update the component signature to destructure the new props:

```typescript
export default function TsGraph({ repoPath, hideTestFiles, onSearchNode }: TsGraphProps) {
```

Remove the internal `hideTestFiles` state line:

```typescript
const [hideTestFiles, setHideTestFiles] = useState(true);
```

Keep the `nodeRules`/`edgeRules` state — those stay internal to TsGraph since the user said ForcePanel controls for rules should be dropped.

- [ ] **Step 3: Register search handler with parent**

Add a `useEffect` that registers `handleSearchNode` with the parent after the callback is defined:

```typescript
useEffect(() => {
  if (onSearchNode) {
    onSearchNode(handleSearchNode);
  }
}, [onSearchNode, handleSearchNode]);
```

- [ ] **Step 4: Make SVG fill its container**

Replace the hardcoded `height: 600` with dynamic container measurement. In the simulation setup effect (Effect 1), change:

```typescript
const width = svgRef.current.parentElement?.clientWidth || 800;
const height = 600;
```

To:

```typescript
const width = svgRef.current.parentElement?.clientWidth || 800;
const height = svgRef.current.parentElement?.clientHeight || 600;
```

And update the SVG element — change:

```tsx
<svg
  ref={svgRef}
  width="100%"
  height={600}
  style={{ display: 'block' }}
  aria-label="TypeScript repository structure graph"
/>
```

To:

```tsx
<svg
  ref={svgRef}
  width="100%"
  height="100%"
  style={{ display: 'block' }}
  aria-label="TypeScript repository structure graph"
/>
```

Also update the search handler's height reference — change:

```typescript
const height = 600;
```

(in `handleSearchNode`) to:

```typescript
const height = svgRef.current.parentElement?.clientHeight || 600;
```

- [ ] **Step 5: Remove ForcePanel from the render output and update container**

Replace the entire return block (the one with `<div style={{ display: 'flex', ...}}>`) with:

```tsx
return (
  <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 8, border: '1px solid #ccc', position: 'relative' }}>
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: 'block' }}
      aria-label="TypeScript repository structure graph"
    />
  </div>
);
```

This removes the ForcePanel sidebar and makes TsGraph a simple full-size container.

- [ ] **Step 6: Commit**

```bash
git add app/components/ts-graph/TsGraph.tsx
git commit -m "refactor: remove ForcePanel from TsGraph, accept lifted props, fill container"
```

---

### Task 4: Rewrite page.tsx with new layout

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

Replace the entire contents of `app/page.tsx` with:

```tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import RepositorySelector from './components/RepositorySelector';
import DateRangeSelector from './components/DateRangeSelector';
import TsGraph from './components/ts-graph/TsGraph';

export default function HomePage() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('2w');
  const [hideTestFiles, setHideTestFiles] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotFound, setSearchNotFound] = useState(false);
  const searchHandlerRef = useRef<((query: string) => boolean) | null>(null);

  const handleRepositorySelect = (path: string) => {
    setRepoPath(path);
  };

  const handleRegisterSearch = useCallback((handler: (query: string) => boolean) => {
    searchHandlerRef.current = handler;
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    if (searchHandlerRef.current) {
      const found = searchHandlerRef.current(searchQuery.trim());
      setSearchNotFound(!found);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <main className="h-screen flex flex-col p-2 gap-2 overflow-hidden">
      {/* Row 1: Repository Selector */}
      <div className="shrink-0">
        <RepositorySelector
          onRepositorySelected={handleRepositorySelect}
          currentPath={repoPath}
          isLoading={false}
          error={undefined}
          onError={undefined}
        />
      </div>

      {/* Row 2: Tools & Filters */}
      <div className="shrink-0 flex items-center gap-4 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-sm">
        <DateRangeSelector value={dateRange} onChange={setDateRange} />

        <label className="flex items-center gap-1.5 cursor-pointer text-gray-700">
          <input
            type="checkbox"
            checked={hideTestFiles}
            onChange={(e) => setHideTestFiles(e.target.checked)}
          />
          Hide test files
        </label>

        <div className="flex items-center gap-1 ml-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchNotFound(false); }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search node..."
            disabled={!repoPath}
            className="px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
          />
          <button
            onClick={handleSearch}
            disabled={!repoPath || !searchQuery.trim()}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Search
          </button>
          {searchNotFound && (
            <span className="text-red-500 text-xs">Not found</span>
          )}
        </div>
      </div>

      {/* Row 3: TsGraph — fills all remaining space */}
      <div className="flex-1 min-h-0">
        {repoPath ? (
          <TsGraph
            repoPath={repoPath}
            hideTestFiles={hideTestFiles}
            onSearchNode={handleRegisterSearch}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
            Select a repository to visualize
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: rewrite page layout — full-viewport, toolbar, full-bleed TsGraph"
```

---

### Task 5: Update TsGraph tests for new props

**Files:**
- Modify: `__tests__/components/TsGraph.test.tsx`

- [ ] **Step 1: Update TsGraph test file**

Replace the entire contents of `__tests__/components/TsGraph.test.tsx` with:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock d3 to avoid ESM resolution issues; TsGraph only needs chainable DOM helpers
jest.mock('d3', () => {
  const chainable = (): any => {
    const obj: Record<string, any> = {};
    const methods = [
      'append', 'style', 'attr', 'call', 'on', 'remove',
      'selectAll', 'join', 'data', 'html', 'text',
    ];
    methods.forEach((m) => {
      obj[m] = jest.fn(() => obj);
    });
    return obj;
  };

  const simMethods = (): any => {
    const obj: Record<string, any> = {};
    ['force', 'on', 'alpha', 'alphaTarget', 'restart', 'stop', 'tick'].forEach((m) => {
      obj[m] = jest.fn(() => obj);
    });
    return obj;
  };

  const linkForce = (): any => {
    const obj: Record<string, any> = {};
    ['id', 'distance', 'strength'].forEach((m) => { obj[m] = jest.fn(() => obj); });
    return obj;
  };

  const dragBehavior = (): any => {
    const obj: Record<string, any> = {};
    obj.on = jest.fn(() => obj);
    return obj;
  };

  const zoomBehavior = (): any => {
    const obj: Record<string, any> = {};
    obj.scaleExtent = jest.fn(() => obj);
    obj.on = jest.fn(() => obj);
    return obj;
  };

  return {
    select: jest.fn(() => chainable()),
    forceSimulation: jest.fn(() => simMethods()),
    forceLink: jest.fn(() => linkForce()),
    forceManyBody: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
    forceCollide: jest.fn(() => ({ radius: jest.fn().mockReturnThis() })),
    forceX: jest.fn(() => ({ x: jest.fn().mockReturnThis(), strength: jest.fn().mockReturnThis() })),
    forceY: jest.fn(() => ({ y: jest.fn().mockReturnThis(), strength: jest.fn().mockReturnThis() })),
    zoom: jest.fn(() => zoomBehavior()),
    drag: jest.fn(() => dragBehavior()),
  };
});

import TsGraph from '@/app/components/ts-graph/TsGraph';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { nodes: [], edges: [] } }),
  });
  global.fetch = mockFetch;
});

describe('TsGraph — data fetching with hideTestFiles prop', () => {
  it('fetches with hideTestFiles=true when prop is true', async () => {
    render(<TsGraph repoPath="/some/repo" hideTestFiles={true} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/ts-analysis', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ repoPath: '/some/repo', hideTestFiles: true }),
      }));
    });
  });

  it('fetches with hideTestFiles=false when prop is false', async () => {
    render(<TsGraph repoPath="/some/repo" hideTestFiles={false} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/ts-analysis', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ repoPath: '/some/repo', hideTestFiles: false }),
      }));
    });
  });

  it('registers search handler when onSearchNode is provided', () => {
    const registerFn = jest.fn();
    render(<TsGraph repoPath="/some/repo" hideTestFiles={true} onSearchNode={registerFn} />);

    expect(registerFn).toHaveBeenCalledWith(expect.any(Function));
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass. The deleted test files no longer run. TsGraph tests pass with updated props.

- [ ] **Step 3: Commit**

```bash
git add __tests__/components/TsGraph.test.tsx
git commit -m "test: update TsGraph tests for lifted props"
```

---

### Task 6: Update page test

**Files:**
- Modify: `__tests__/page.test.tsx`

- [ ] **Step 1: Update page test**

The existing test renders `<Home />` and checks for the "Select directory" button. This should still work since RepositorySelector is always rendered. But we should also verify the placeholder text appears. Replace the file contents with:

```tsx
import { render, screen } from '@testing-library/react';
import Home from '../app/page';

// Mock TsGraph to avoid d3/DOM issues in test environment
jest.mock('@/app/components/ts-graph/TsGraph', () => {
  return function MockTsGraph() {
    return <div data-testid="ts-graph" />;
  };
});

describe('Homepage', () => {
  it('renders repository selector', () => {
    render(<Home />);
    expect(screen.getByRole('button', { name: 'Select directory' })).toBeInTheDocument();
  });

  it('shows placeholder when no repo is selected', () => {
    render(<Home />);
    expect(screen.getByText('Select a repository to visualize')).toBeInTheDocument();
  });

  it('renders tools and filters toolbar', () => {
    render(<Home />);
    expect(screen.getByText(/Date Range/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /hide test files/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search node...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add __tests__/page.test.tsx
git commit -m "test: update page test for new layout"
```

---

### Task 7: Run full build and verify

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no errors. No references to deleted files.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 3: Run linter**

```bash
npm run lint
```

Expected: No lint errors.
