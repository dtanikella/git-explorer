# Remove Dead Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all legacy visualization code, keeping only RepoGraph + the SCIP/tree-sitter analysis pipeline.

**Architecture:** Top-down approach — simplify `page.tsx` first, then bulk-delete all orphaned files/directories, then clean up tests, then verify.

**Tech Stack:** Next.js, TypeScript, Jest

---

## File Map

### Files to Modify

- `app/page.tsx` — strip dead imports, state, callbacks, effects, and UI; simplify to RepositorySelector + RepoGraph only

### Files/Directories to Delete

**Components:**
- `app/components/ts-graph/` (entire directory)
- `app/components/stats/` (entire directory)
- `app/components/graph/` (entire directory)
- `app/components/TabSidebar.tsx`

**API Routes:**
- `app/api/git-analysis/` (entire directory)
- `app/api/ts-analysis/` (entire directory)

**Services:**
- `app/services/git-controller.ts`

**Libraries:**
- `lib/git/` (entire directory)
- `lib/ts/` (entire directory)
- `lib/utils/date-helpers.ts` (and `lib/utils/` dir if empty after)

**Tests:**
- `__tests__/components/StatsTreemap.test.tsx`
- `__tests__/components/TabSidebar.test.tsx`
- `__tests__/components/TsGraph.test.tsx`
- `__tests__/components/ViewToggle.test.tsx`
- `__tests__/unit/git-analyzer.test.ts`
- `__tests__/unit/tree-builder.test.ts`
- `__tests__/unit/treemap-utils.test.ts`
- `__tests__/unit/ts-analyzer.test.ts`
- `__tests__/unit/ts-types.test.ts`
- `__tests__/unit/force-rules.test.ts`
- `__tests__/integration/git-analysis-api.test.ts`
- `__tests__/integration/ts-analysis-api.test.ts`
- `__tests__/integration/view-switching.test.tsx`
- `__tests__/page.test.tsx`

### Files/Directories to KEEP (do NOT delete)

- `lib/tree-sitter/` — still used by `app/services/analysis/ts/`
- `__tests__/unit/tree-sitter-*.test.ts` — tests for the above
- `__tests__/integration/tree-sitter.integration.test.ts`
- `app/components/repo-graph/`
- `app/components/RepositorySelector.tsx`
- `app/api/repo-analysis/`
- `app/api/browse-directory/`
- `app/services/analysis/`
- `lib/analysis/`
- `lib/scip/`
- `lib/sentry/`

---

### Task 1: Simplify page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx to only use RepositorySelector and RepoGraph**

Replace the entire contents of `app/page.tsx` with:

```tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import RepositorySelector from './components/RepositorySelector';
import RepoGraph from './components/repo-graph/RepoGraph';
import { createModulesViewConfig } from '@/lib/analysis/graph-config';
import type { AnalysisResult } from '@/lib/analysis/types';

export default function HomePage() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [hideTestFiles, setHideTestFiles] = useState(true);

  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/repo-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, hideTestFiles }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((result) => {
        if (result.success) {
          setAnalysisData(result.data);
        } else {
          setError(result.error || 'Analysis failed');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Network error');
        setLoading(false);
      });

    return () => controller.abort();
  }, [repoPath, hideTestFiles]);

  const handleRepositorySelect = useCallback((path: string) => {
    setRepoPath(path);
  }, []);

  return (
    <main className="h-screen flex flex-col p-2 gap-2 overflow-hidden">
      <div className="shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <RepositorySelector
            onRepositorySelected={handleRepositorySelect}
            currentPath={repoPath}
          />
        </div>
        <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={hideTestFiles}
            onChange={(e) => setHideTestFiles(e.target.checked)}
          />
          Hide test files
        </label>
      </div>

      <div className="flex-1 min-h-0">
        {!repoPath ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
            Select a repository to visualize
          </div>
        ) : (
          <RepoGraph
            repoPath={repoPath}
            hideTestFiles={hideTestFiles}
            config={createModulesViewConfig}
            analysisData={analysisData}
            loading={loading}
            error={error}
          />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify the file was saved correctly**

Run: `head -5 app/page.tsx`
Expected: `'use client';` followed by the simplified imports (no TabSidebar, GraphToolbar, etc.)

---

### Task 2: Delete dead component files

**Files:**
- Delete: `app/components/ts-graph/` (directory)
- Delete: `app/components/stats/` (directory)
- Delete: `app/components/graph/` (directory)
- Delete: `app/components/TabSidebar.tsx`

- [ ] **Step 1: Delete the dead component directories and files**

```bash
rm -rf app/components/ts-graph app/components/stats app/components/graph
rm app/components/TabSidebar.tsx
```

- [ ] **Step 2: Verify only expected components remain**

```bash
ls app/components/
```

Expected output should show only:
```
RepositorySelector.tsx
repo-graph
```

---

### Task 3: Delete dead API routes and services

**Files:**
- Delete: `app/api/git-analysis/` (directory)
- Delete: `app/api/ts-analysis/` (directory)
- Delete: `app/services/git-controller.ts`

- [ ] **Step 1: Delete the dead API routes and service**

```bash
rm -rf app/api/git-analysis app/api/ts-analysis
rm app/services/git-controller.ts
```

- [ ] **Step 2: Verify only expected API routes and services remain**

```bash
ls app/api/
ls app/services/
```

Expected:
- `app/api/`: `browse-directory`, `repo-analysis`
- `app/services/`: `analysis`

---

### Task 4: Delete dead library code

**Files:**
- Delete: `lib/git/` (directory)
- Delete: `lib/ts/` (directory)
- Delete: `lib/utils/date-helpers.ts` (and `lib/utils/` dir if empty)

- [ ] **Step 1: Delete the dead library directories and files**

```bash
rm -rf lib/git lib/ts
rm lib/utils/date-helpers.ts
rmdir lib/utils 2>/dev/null || true
```

- [ ] **Step 2: Verify only expected library directories remain**

```bash
ls lib/
```

Expected output should include only: `analysis`, `scip`, `sentry`, `tree-sitter` (and possibly `utils` if it has other files)

---

### Task 5: Delete dead test files

**Files:**
- Delete: `__tests__/components/StatsTreemap.test.tsx`
- Delete: `__tests__/components/TabSidebar.test.tsx`
- Delete: `__tests__/components/TsGraph.test.tsx`
- Delete: `__tests__/components/ViewToggle.test.tsx`
- Delete: `__tests__/unit/git-analyzer.test.ts`
- Delete: `__tests__/unit/tree-builder.test.ts`
- Delete: `__tests__/unit/treemap-utils.test.ts`
- Delete: `__tests__/unit/ts-analyzer.test.ts`
- Delete: `__tests__/unit/ts-types.test.ts`
- Delete: `__tests__/unit/force-rules.test.ts`
- Delete: `__tests__/integration/git-analysis-api.test.ts`
- Delete: `__tests__/integration/ts-analysis-api.test.ts`
- Delete: `__tests__/integration/view-switching.test.tsx`
- Delete: `__tests__/page.test.tsx`

- [ ] **Step 1: Delete the dead test files**

```bash
rm __tests__/components/StatsTreemap.test.tsx \
   __tests__/components/TabSidebar.test.tsx \
   __tests__/components/TsGraph.test.tsx \
   __tests__/components/ViewToggle.test.tsx

rm __tests__/unit/git-analyzer.test.ts \
   __tests__/unit/tree-builder.test.ts \
   __tests__/unit/treemap-utils.test.ts \
   __tests__/unit/ts-analyzer.test.ts \
   __tests__/unit/ts-types.test.ts \
   __tests__/unit/force-rules.test.ts

rm __tests__/integration/git-analysis-api.test.ts \
   __tests__/integration/ts-analysis-api.test.ts \
   __tests__/integration/view-switching.test.tsx

rm __tests__/page.test.tsx
```

- [ ] **Step 2: Verify remaining test files are all for surviving modules**

```bash
find __tests__ -name '*.test.*' | sort
```

Expected: Only test files for RepoGraph, RepositorySelector, LoadingState, ColorLegend, and unit tests for analysis-types, edge-extractor, graph-assembler, graph-config, language-detector, node-extractor, scip-*, symbol-utils, test-file-detector, tree-sitter-*. No files referencing git-analyzer, tree-builder, treemap-utils, ts-analyzer, ts-types, force-rules, StatsTreemap, TabSidebar, TsGraph, ViewToggle.

---

### Task 6: Grep for stale imports

- [ ] **Step 1: Search for any remaining imports of deleted modules**

```bash
grep -rn "from.*\(lib/git/\|lib/ts/\|lib/utils/date-helpers\|components/TabSidebar\|components/graph/\|components/stats/\|components/ts-graph/\|api/git-analysis\|api/ts-analysis\|services/git-controller\)" --include='*.ts' --include='*.tsx' app/ lib/
```

Expected: No matches. If any matches are found, those files have stale imports that need to be fixed.

---

### Task 7: Build and test

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run the tests**

```bash
npm test
```

Expected: All remaining tests pass. No test failures related to missing modules.

---

### Task 8: Commit

- [ ] **Step 1: Stage all changes**

```bash
git add -A
```

- [ ] **Step 2: Review the staged changes**

```bash
git diff --cached --stat
```

Expected: Many deletions, one modification (`app/page.tsx`), and the new plan/spec files.

- [ ] **Step 3: Commit**

```bash
git commit -m "Remove dead code — keep only RepoGraph + analysis pipeline

Strip legacy visualization code: git co-change analysis, tree-sitter UI
wrappers, stats treemap, tab sidebar, and associated API routes, services,
libraries, and tests.

Simplify page.tsx to only render RepositorySelector + RepoGraph with the
modules view config.

Closes #28

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
