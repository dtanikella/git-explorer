# Edge Differentiation & ForcePanel Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the ForcePanel scrollability by correcting the container height, and differentiate call edges by scope (same-file, cross-file, external) with distinct colors and physics.

**Architecture:** Four focused changes across four files: (1) a one-line CSS fix in `TsGraph.tsx`, (2) add `callScope` field to `CallEdge` in `types.ts`, (3) set `callScope` at emission time in `analyzer.ts`, (4) replace the single `call-edges` rule with three scoped rules and update `import-package` color in `default-rules.ts`.

**Tech Stack:** TypeScript, React, D3, Jest (existing test infra with `createTempRepo` helper in `__tests__/unit/ts-analyzer.test.ts`)

---

## File Structure

| File | Change |
|---|---|
| `app/components/ts-graph/TsGraph.tsx` | Change `minHeight: 600` → `height: 600` on outer container |
| `lib/ts/types.ts` | Add `callScope: 'same-file' \| 'cross-file' \| 'external'` to `CallEdge` |
| `lib/ts/analyzer.ts` | Import `ImportNode`; derive `callScope` from node graph when emitting call edges |
| `lib/ts/default-rules.ts` | Replace `call-edges` rule with three scoped rules; update `import-package` color to blue |
| `__tests__/unit/ts-types.test.ts` | Add `callScope` field assertion to the `CallEdge` discriminator test |
| `__tests__/unit/ts-analyzer.test.ts` | Add assertion that emitted call edges carry `callScope: 'same-file'` |
| `__tests__/unit/force-rules.test.ts` | Add three call edge integration tests for the new scoped rules |

---

## Task 1: Fix ForcePanel scrollability in TsGraph.tsx

**Files:**
- Modify: `app/components/ts-graph/TsGraph.tsx:316`

- [ ] **Step 1: Apply the one-line fix**

In `app/components/ts-graph/TsGraph.tsx`, find the outer container `div` on line 316:

```tsx
<div style={{ display: 'flex', width: '100%', minHeight: 600, background: '#fff', borderRadius: 8, border: '1px solid #ccc' }}>
```

Change `minHeight: 600` to `height: 600`:

```tsx
<div style={{ display: 'flex', width: '100%', height: 600, background: '#fff', borderRadius: 8, border: '1px solid #ccc' }}>
```

- [ ] **Step 2: Run the full test suite to confirm nothing regressed**

```bash
npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/ts-graph/TsGraph.tsx
git commit -m "fix(ts-graph): constrain outer container to height 600 so ForcePanel scrolls"
```

---

## Task 2: Add callScope to CallEdge in types.ts

**Files:**
- Modify: `lib/ts/types.ts`
- Modify: `__tests__/unit/ts-types.test.ts`

- [ ] **Step 1: Write the failing test**

In `__tests__/unit/ts-types.test.ts`, find the existing `it('discriminates CallEdge by type', ...)` test and replace it with a version that also asserts `callScope`:

```typescript
  it('discriminates CallEdge by type', () => {
    const edge: TsEdge = {
      id: 'edge-3',
      type: 'call',
      source: 'fn-a',
      target: 'fn-b',
      callScope: 'same-file',
    };
    expect(edge.type).toBe('call');
    expect((edge as CallEdge).callScope).toBe('same-file');
  });
```

Also add `CallEdge` to the import at the top of `ts-types.test.ts` if it is not already there:

```typescript
import {
  TsNode,
  FolderNode,
  FileNode,
  FunctionNode,
  ClassNode,
  InterfaceNode,
  ImportNode,
  TsEdge,
  ImportEdge,
  ExportEdge,
  CallEdge,
  ContainsEdge,
} from '@/lib/ts/types';
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/unit/ts-types.test.ts -t "CallEdge" --no-coverage
```

Expected: FAIL — `callScope` does not exist on `CallEdge`.

- [ ] **Step 3: Update CallEdge in types.ts**

In `lib/ts/types.ts`, replace the `CallEdge` interface:

```typescript
export interface CallEdge extends TsEdgeBase {
  type: 'call';
  callScope: 'same-file' | 'cross-file' | 'external';
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/ts-types.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ts/types.ts __tests__/unit/ts-types.test.ts
git commit -m "feat(ts-graph): add callScope field to CallEdge type"
```

---

## Task 3: Set callScope when emitting call edges in analyzer.ts

**Files:**
- Modify: `lib/ts/analyzer.ts`
- Modify: `__tests__/unit/ts-analyzer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/unit/ts-analyzer.test.ts`, inside the `describe('analyzeTypeScriptRepo')` block:

```typescript
  it('emits call edges with callScope same-file for intra-file calls', () => {
    repoDir = createTempRepo({
      'src/math.ts': `
        export function add(a: number, b: number): number { return a + b; }
        export function double(x: number): number { return add(x, x); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const callEdges = result.edges.filter((e) => e.type === 'call');
    expect(callEdges.length).toBeGreaterThan(0);

    for (const edge of callEdges) {
      expect((edge as import('@/lib/ts/types').CallEdge).callScope).toBe('same-file');
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/unit/ts-analyzer.test.ts -t "callScope" --no-coverage
```

Expected: FAIL — `callScope` is `undefined` on call edges.

- [ ] **Step 3: Add callScope derivation to analyzer.ts**

**3a.** Add a helper function inside `analyzeTypeScriptRepo`, after the `isTestFile` function (or right after the `nextEdgeId` function if `isTestFile` has not yet been added):

```typescript
  function getCallScope(
    sourceFnId: string,
    targetFnId: string
  ): 'same-file' | 'cross-file' | 'external' {
    const targetNode = nodeMap.get(targetFnId);
    if (targetNode?.kind === 'IMPORT' && (targetNode as ImportNode).source === 'package') {
      return 'external';
    }
    const sourceNode = nodeMap.get(sourceFnId);
    if (sourceNode && targetNode && sourceNode.parent === targetNode.parent) {
      return 'same-file';
    }
    return 'cross-file';
  }
```

**3b.** In the second pass (`walkForCalls`), replace the `edges.push(...)` call for call edges:

Replace:
```typescript
            edges.push({
              id: nextEdgeId(),
              type: 'call',
              source: enclosingFnId,
              target: targetId,
            } as CallEdge);
```

With:
```typescript
            edges.push({
              id: nextEdgeId(),
              type: 'call',
              source: enclosingFnId,
              target: targetId,
              callScope: getCallScope(enclosingFnId, targetId),
            } as CallEdge);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/ts-analyzer.test.ts -t "callScope" --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Run all unit tests**

```bash
npx jest __tests__/unit/ --no-coverage
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ts/analyzer.ts __tests__/unit/ts-analyzer.test.ts
git commit -m "feat(ts-graph): derive and emit callScope on call edges"
```

---

## Task 4: Update default-rules.ts — three call edge rules + blue import-package

**Files:**
- Modify: `lib/ts/default-rules.ts`
- Modify: `__tests__/unit/force-rules.test.ts`

- [ ] **Step 1: Write the failing tests**

Add the following to `__tests__/unit/force-rules.test.ts`:

**4a.** Add `CallEdge` to the existing import from `@/lib/ts/types` at the top of `force-rules.test.ts`:

```typescript
import {
  TsNode,
  FileNode,
  FolderNode,
  NodeForceRule,
  TsEdge,
  ImportEdge,
  CallEdge,
  EdgeForceRule,
} from '@/lib/ts/types';
```

Then add a `makeCallEdge` factory near the other factories (after `makeImportEdge`):

```typescript
const makeCallEdge = (overrides?: Partial<CallEdge>): CallEdge => ({
  id: 'edge-call-1',
  type: 'call',
  source: 'fn-a',
  target: 'fn-b',
  callScope: 'same-file',
  ...overrides,
});
```

**4b.** Add integration tests inside the `describe('default rules integration')` block:

```typescript
  it('evaluates default edge rules for a same-file call edge', () => {
    const edge = makeCallEdge({ callScope: 'same-file' });
    const forces = evaluateEdgeForces(edge, defaultEdgeRules);
    expect(forces.linkDistance).toBe(30);
    expect(forces.linkStrength).toBe(1.0);
    const style = evaluateEdgeStyle(edge, defaultEdgeRules);
    expect(style.color).toBe('#374151');
  });

  it('evaluates default edge rules for a cross-file call edge', () => {
    const edge = makeCallEdge({ callScope: 'cross-file' });
    const forces = evaluateEdgeForces(edge, defaultEdgeRules);
    expect(forces.linkDistance).toBe(60);
    expect(forces.linkStrength).toBe(0.6);
    const style = evaluateEdgeStyle(edge, defaultEdgeRules);
    expect(style.color).toBe('#111827');
  });

  it('evaluates default edge rules for an external call edge', () => {
    const edge = makeCallEdge({ callScope: 'external' });
    const forces = evaluateEdgeForces(edge, defaultEdgeRules);
    expect(forces.linkDistance).toBe(100);
    expect(forces.linkStrength).toBe(0.3);
    const style = evaluateEdgeStyle(edge, defaultEdgeRules);
    expect(style.color).toBe('#3b82f6');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/unit/force-rules.test.ts -t "call edge" --no-coverage
```

Expected: FAIL — the single `call-edges` rule matches all call edges with the same distance/color.

- [ ] **Step 3: Update default-rules.ts**

**3a.** Add `CallEdge` to the import at the top of `lib/ts/default-rules.ts`:

```typescript
import { NodeForceRule, EdgeForceRule, CallEdge } from './types';
```

**3b.** Replace the single `call-edges` entry in `defaultEdgeRules` with three scoped rules:

Replace:
```typescript
  {
    id: 'call-edges',
    label: 'Call Edges',
    enabled: true,
    match: (e) => e.type === 'call',
    forces: { linkDistance: 40, linkStrength: 0.8 },
    style: { color: '#10b981', width: 1 },
  },
```

With:
```typescript
  {
    id: 'call-same-file',
    label: 'Same-File Calls',
    enabled: true,
    match: (e) => e.type === 'call' && (e as CallEdge).callScope === 'same-file',
    forces: { linkDistance: 30, linkStrength: 1.0 },
    style: { color: '#374151', width: 1 },
  },
  {
    id: 'call-cross-file',
    label: 'Cross-File Calls',
    enabled: true,
    match: (e) => e.type === 'call' && (e as CallEdge).callScope === 'cross-file',
    forces: { linkDistance: 60, linkStrength: 0.6 },
    style: { color: '#111827', width: 1 },
  },
  {
    id: 'call-external',
    label: 'External Calls',
    enabled: true,
    match: (e) => e.type === 'call' && (e as CallEdge).callScope === 'external',
    forces: { linkDistance: 100, linkStrength: 0.3 },
    style: { color: '#3b82f6', width: 1 },
  },
```

**3c.** Update the `import-package` node rule color from `#64748b` to `#3b82f6`:

Replace:
```typescript
    style: { color: '#64748b', radius: 4 },
```

With (in the `import-package` rule only):
```typescript
    style: { color: '#3b82f6', radius: 4 },
```

- [ ] **Step 4: Run the call edge integration tests**

```bash
npx jest __tests__/unit/force-rules.test.ts -t "call edge" --no-coverage
```

Expected: All three PASS.

- [ ] **Step 5: Run all unit tests**

```bash
npx jest __tests__/unit/ --no-coverage
```

Expected: All PASS.

- [ ] **Step 6: Run TypeScript build and lint**

```bash
npm run build && npm run lint
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add lib/ts/default-rules.ts __tests__/unit/force-rules.test.ts
git commit -m "feat(ts-graph): split call-edges into same-file/cross-file/external rules; blue package imports"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| ForcePanel scroll: `minHeight: 600` → `height: 600` | Task 1 |
| `callScope` on `CallEdge` type | Task 2 |
| Analyzer sets `callScope` at call edge emission | Task 3 |
| `call-same-file` rule: `#374151`, distance 30, strength 1.0 | Task 4 |
| `call-cross-file` rule: `#111827`, distance 60, strength 0.6 | Task 4 |
| `call-external` rule: `#3b82f6`, distance 100, strength 0.3 | Task 4 |
| `import-package` node color → `#3b82f6` | Task 4 |

**No placeholders** — all steps include exact code.

**Type consistency** — `callScope` is defined in Task 2, used in Task 3 (analyzer emission), and matched in Task 4 (default-rules). The `CallEdge` type is imported at the top of `default-rules.ts` in Task 4 Step 3a so the `(e as CallEdge).callScope` cast in each match function is valid.
