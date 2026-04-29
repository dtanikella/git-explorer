# SCIP Symbol Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three SCIP symbol data-integrity bugs that cause the repo-graph to display a star pattern instead of actual code relationships.

**Architecture:** A shared `qualifySymbol` helper qualifies file-local SCIP symbols with their file path and rejects empty symbols. Both extractors use this helper to produce globally unique, non-empty symbols. Debug logging in RepoGraph is removed.

**Tech Stack:** TypeScript, Jest, D3 (no new dependencies)

---

### Task 1: Create `qualifySymbol` helper with tests

**Files:**
- Create: `app/services/analysis/ts/symbol-utils.ts`
- Create: `__tests__/unit/symbol-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/symbol-utils.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { qualifySymbol } from '@/app/services/analysis/ts/symbol-utils';

describe('qualifySymbol', () => {
  it('returns null for empty string', () => {
    expect(qualifySymbol('src/foo.ts', '')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(qualifySymbol('src/foo.ts', '   ')).toBeNull();
  });

  it('qualifies local symbols with file path', () => {
    expect(qualifySymbol('src/foo.ts', 'local 3')).toBe('src/foo.ts#local 3');
  });

  it('qualifies local symbols with higher numbers', () => {
    expect(qualifySymbol('src/bar.ts', 'local 42')).toBe('src/bar.ts#local 42');
  });

  it('passes through global symbols unchanged', () => {
    expect(qualifySymbol('src/foo.ts', 'scip-ts npm . . foo.ts/add().')).toBe('scip-ts npm . . foo.ts/add().');
  });

  it('passes through non-local symbols unchanged', () => {
    expect(qualifySymbol('src/foo.ts', 'npm @types/node 18.0.0 fs/')).toBe('npm @types/node 18.0.0 fs/');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/symbol-utils.test.ts --no-coverage`

Expected: FAIL — module `@/app/services/analysis/ts/symbol-utils` not found.

- [ ] **Step 3: Write the implementation**

Create `app/services/analysis/ts/symbol-utils.ts`:

```ts
/**
 * Qualifies SCIP symbols to be globally unique.
 *
 * - Empty/whitespace symbols → null (skip the node/edge)
 * - Local symbols (e.g. "local 3") → "filePath#local 3" (file-scoped uniqueness)
 * - Global symbols → returned unchanged (already unique)
 */
export function qualifySymbol(filePath: string, symbol: string): string | null {
  if (!symbol || !symbol.trim()) return null;
  if (symbol.startsWith('local ')) return `${filePath}#${symbol}`;
  return symbol;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/symbol-utils.test.ts --no-coverage`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/analysis/ts/symbol-utils.ts __tests__/unit/symbol-utils.test.ts
git commit -m "feat: add qualifySymbol helper for SCIP symbol deduplication

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Update node extractor to use `qualifySymbol`

**Files:**
- Modify: `app/services/analysis/ts/node-extractor.ts`
- Modify: `__tests__/unit/node-extractor.test.ts`

- [ ] **Step 1: Write failing tests for new behavior**

Add to `__tests__/unit/node-extractor.test.ts`:

```ts
  it('skips nodes with no SCIP definition match (empty symbol)', () => {
    const source = 'function orphan(): void {}';
    const tree = parseTs(source);

    // No SCIP occurrences — the node has no matching definition
    const scipDoc = mockScipDoc('src/orphan.ts', []);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/orphan.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodes).toHaveLength(0);
    expect(output.nodeMap.size).toBe(0);
  });

  it('qualifies local SCIP symbols with file path', () => {
    const source = 'function inner(): void {}';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/helpers.ts', [
      { range: [0, 9, 14], symbol: 'local 3', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/helpers.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodes).toHaveLength(1);
    expect(output.nodes[0].scipSymbol).toBe('src/helpers.ts#local 3');
    expect(output.nodeMap.has('src/helpers.ts#local 3')).toBe(true);
  });

  it('does not collide local symbols across files', () => {
    const sourceA = 'function foo(): void {}';
    const sourceB = 'function bar(): void {}';
    const treeA = parseTs(sourceA);
    const treeB = parseTs(sourceB);

    const scipDocA = mockScipDoc('src/a.ts', [
      { range: [0, 9, 12], symbol: 'local 3', symbolRoles: 1 },
    ]);
    const scipDocB = mockScipDoc('src/b.ts', [
      { range: [0, 9, 12], symbol: 'local 3', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([
        ['src/a.ts', { tree: treeA, source: sourceA }],
        ['src/b.ts', { tree: treeB, source: sourceB }],
      ]),
      scipDocuments: [scipDocA, scipDocB],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodes).toHaveLength(2);
    expect(output.nodeMap.has('src/a.ts#local 3')).toBe(true);
    expect(output.nodeMap.has('src/b.ts#local 3')).toBe(true);
    expect(output.nodeMap.get('src/a.ts#local 3')!.name).toBe('foo');
    expect(output.nodeMap.get('src/b.ts#local 3')!.name).toBe('bar');
  });
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/node-extractor.test.ts --no-coverage`

Expected: The 3 new tests FAIL (empty-symbol node still emitted, local symbols unqualified).

- [ ] **Step 3: Update the node extractor**

In `app/services/analysis/ts/node-extractor.ts`, add the import at the top:

```ts
import { qualifySymbol } from './symbol-utils';
```

Then modify the first extraction loop (regular declarations, around line 157-186). Replace:

```ts
    const scipDef = defLookup.get(`${line}:${col}`);
    const scipSymbol = scipDef?.symbol ?? '';

    const node: AnalysisNode = {
```

with:

```ts
    const scipDef = defLookup.get(`${line}:${col}`);
    const scipSymbol = qualifySymbol(filePath, scipDef?.symbol ?? '');
    if (scipSymbol === null) continue;

    const node: AnalysisNode = {
```

Then modify the second extraction loop (arrow functions, around line 202-227). Replace:

```ts
    const scipDef = defLookup.get(`${line}:${col}`);
    const scipSymbol = scipDef?.symbol ?? '';
```

with:

```ts
    const scipDef = defLookup.get(`${line}:${col}`);
    const scipSymbol = qualifySymbol(filePath, scipDef?.symbol ?? '');
    if (scipSymbol === null) continue;
```

Also remove the `if (scipSymbol)` guard around both `nodeMap.set()` calls since `qualifySymbol` already guarantees non-null/non-empty at this point. Replace both occurrences of:

```ts
    nodes.push(node);
    if (scipSymbol) {
      nodeMap.set(scipSymbol, node);
    }
```

with:

```ts
    nodes.push(node);
    nodeMap.set(scipSymbol, node);
```

- [ ] **Step 4: Run all node extractor tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/node-extractor.test.ts --no-coverage`

Expected: All tests PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add app/services/analysis/ts/node-extractor.ts __tests__/unit/node-extractor.test.ts
git commit -m "fix: qualify local SCIP symbols and skip empty symbols in node extractor

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Update edge extractor to use `qualifySymbol`

**Files:**
- Modify: `app/services/analysis/ts/edge-extractor.ts`
- Modify: `__tests__/unit/edge-extractor.test.ts`

- [ ] **Step 1: Write failing tests for new behavior**

Add to `__tests__/unit/edge-extractor.test.ts`:

```ts
  it('skips edges with empty target symbol', () => {
    const source = 'foo();';
    const tree = parseTs(source);

    const nodeMap = new Map<string, AnalysisNode>();

    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 0, 3], symbol: '', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    expect(edges).toHaveLength(0);
  });

  it('qualifies local target symbols with file path in toSymbol', () => {
    const source = 'function caller() {\n  inner();\n}';
    const tree = parseTs(source);

    const innerNode = makeNode({
      name: 'inner',
      scipSymbol: 'src/mod.ts#local 5',
      filePath: 'src/mod.ts',
      startLine: 0,
      startCol: 0,
    });
    const callerNode = makeNode({
      name: 'caller',
      scipSymbol: 'scip-ts npm . . mod.ts/caller().',
      filePath: 'src/mod.ts',
      startLine: 0,
      startCol: 9,
    });
    const nodeMap = new Map<string, AnalysisNode>([
      ['src/mod.ts#local 5', innerNode],
      ['scip-ts npm . . mod.ts/caller().', callerNode],
    ]);

    const scipDoc = mockScipDoc('src/mod.ts', [
      // Definition of caller at line 0, col 9
      { range: [0, 9, 15], symbol: 'scip-ts npm . . mod.ts/caller().', symbolRoles: 1 },
      // Reference to inner (local 5) at line 1, col 2
      { range: [1, 2, 7], symbol: 'local 5', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/mod.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    const edge = edges.find(e => e.toName === 'inner');
    expect(edge).toBeDefined();
    expect(edge!.toSymbol).toBe('src/mod.ts#local 5');
  });

  it('skips edges where source node has no scipSymbol', () => {
    // Simulate: reference occurs at top-level (no enclosing function found)
    const source = 'add(1, 2);';
    const tree = parseTs(source);

    const addNode = makeNode({ name: 'add', scipSymbol: 'sym:add', filePath: 'src/utils.ts' });
    const nodeMap = new Map([['sym:add', addNode]]);

    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 0, 3], symbol: 'sym:add', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    // No enclosing node → fromSymbol is '' → edge should be skipped
    expect(edges).toHaveLength(0);
  });
```

Also update the existing `'populates referencedAt on target node inline'` test. The current test uses a top-level call `add(1, 2);` with no enclosing function, which means `fromSymbol` is empty — the edge will now be skipped. Wrap the call in a function so there's a valid source node:

```ts
  it('populates referencedAt on target node inline', () => {
    const source = 'function caller() {\n  add(1, 2);\n}';
    const tree = parseTs(source);

    const addNode = makeNode({ name: 'add', scipSymbol: 'sym:add', filePath: 'src/utils.ts' });
    const callerNode = makeNode({ name: 'caller', scipSymbol: 'sym:caller', filePath: 'src/index.ts', startLine: 0, startCol: 9 });
    const nodeMap = new Map([['sym:add', addNode], ['sym:caller', callerNode]]);

    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 9, 15], symbol: 'sym:caller', symbolRoles: 1 },
      { range: [1, 2, 5], symbol: 'sym:add', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    extractEdges(input);
    expect(addNode.referencedAt.length).toBeGreaterThan(0);
    expect(addNode.referencedAt[0].filePath).toBe('src/index.ts');
  });
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/edge-extractor.test.ts --no-coverage`

Expected: New tests FAIL (empty symbols not skipped, local symbols not qualified).

- [ ] **Step 3: Update the edge extractor**

In `app/services/analysis/ts/edge-extractor.ts`, add the import at the top:

```ts
import { qualifySymbol } from './symbol-utils';
```

Then in the `extractEdges` function, modify the occurrence loop. After line 207 (`if ((occ.symbolRoles & SCIP_DEFINITION) !== 0) continue;`), replace:

```ts
      const line = occ.range[0];
      const col = occ.range[1];

      const kind = classifyEdgeKind(tree, line, col, occ.symbolRoles);
      const targetNode = input.nodeMap.get(occ.symbol);
```

with:

```ts
      const line = occ.range[0];
      const col = occ.range[1];

      const qualifiedTarget = qualifySymbol(filePath, occ.symbol);
      if (qualifiedTarget === null) continue;

      const kind = classifyEdgeKind(tree, line, col, occ.symbolRoles);
      const targetNode = input.nodeMap.get(qualifiedTarget);
```

Then replace the `fromSymbol` assignment and edge creation section. Replace:

```ts
      const fromName = sourceNode?.name ?? '';
      const fromSymbol = sourceNode?.scipSymbol ?? '';

      // Populate referencedAt/outboundRefs for every occurrence (not gated by dedup)
      if (targetNode) {
        targetNode.referencedAt.push({
          filePath,
          line,
          col,
          scipSymbol: fromSymbol,
        });
      }

      if (sourceNode) {
        sourceNode.outboundRefs.push({
          filePath: toFile ?? '',
          line,
          col,
          scipSymbol: occ.symbol,
        });
      }

      // Dedup edges by file + fromSymbol + toSymbol + kind
      const dedupeKey = `${filePath}:${fromSymbol}|${occ.symbol}|${kind}`;
```

with:

```ts
      const fromName = sourceNode?.name ?? '';
      const fromSymbol = sourceNode?.scipSymbol ?? '';

      // Skip edges from nodes with no SCIP identity
      if (!fromSymbol) continue;

      // Populate referencedAt/outboundRefs for every occurrence (not gated by dedup)
      if (targetNode) {
        targetNode.referencedAt.push({
          filePath,
          line,
          col,
          scipSymbol: fromSymbol,
        });
      }

      if (sourceNode) {
        sourceNode.outboundRefs.push({
          filePath: toFile ?? '',
          line,
          col,
          scipSymbol: qualifiedTarget,
        });
      }

      // Dedup edges by file + fromSymbol + toSymbol + kind
      const dedupeKey = `${filePath}:${fromSymbol}|${qualifiedTarget}|${kind}`;
```

And update the edge object to use `qualifiedTarget`. Replace:

```ts
        toSymbol: occ.symbol,
```

with:

```ts
        toSymbol: qualifiedTarget,
```

- [ ] **Step 4: Run all edge extractor tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/edge-extractor.test.ts --no-coverage`

Expected: All tests PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add app/services/analysis/ts/edge-extractor.ts __tests__/unit/edge-extractor.test.ts
git commit -m "fix: qualify local SCIP symbols and skip empty symbols in edge extractor

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Remove debug logging from RepoGraph

**Files:**
- Modify: `app/components/repo-graph/RepoGraph.tsx`

- [ ] **Step 1: Remove the debug logging block**

In `app/components/repo-graph/RepoGraph.tsx`, remove the debug logging block (lines 157-163). Replace:

```ts
    simNodes.forEach((n) => {
      (n as { degree: number }).degree = degreeCounts.get(n.id) ?? 0;
    });

    // Debug: log degree distribution
    const sorted = [...simNodes].sort((a, b) => b.degree - a.degree);
    console.table(sorted.slice(0, 20).map((n) => ({ name: n.name, degree: n.degree, id: n.id })));
    console.log(`Total nodes: ${simNodes.length}, Total edges: ${simEdges.length}`);
    const hist = new Map<number, number>();
    simNodes.forEach((n) => hist.set(n.degree, (hist.get(n.degree) ?? 0) + 1));
    console.log('Degree histogram:', Object.fromEntries([...hist.entries()].sort((a, b) => b[0] - a[0])));
  }, [simNodes, simEdges]);
```

with:

```ts
    simNodes.forEach((n) => {
      (n as { degree: number }).degree = degreeCounts.get(n.id) ?? 0;
    });
  }, [simNodes, simEdges]);
```

- [ ] **Step 2: Verify no other console.log calls remain**

Run: `grep -n 'console\.' app/components/repo-graph/RepoGraph.tsx`

Expected: No output (no console calls in the file).

- [ ] **Step 3: Commit**

```bash
git add app/components/repo-graph/RepoGraph.tsx
git commit -m "chore: remove debug logging from RepoGraph

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Run full test suite and verify

**Files:** None (validation only)

- [ ] **Step 1: Run all unit tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest --no-coverage`

Expected: All tests PASS with no regressions.

- [ ] **Step 2: Run lint**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm run lint`

Expected: No lint errors.

- [ ] **Step 3: Run build**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm run build`

Expected: Build succeeds with no type errors.
