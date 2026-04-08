# TsGraph Visual Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the TsGraph force visualization so folders are light gray, regular files are gray, test files and their children are very small and lighter gray, hierarchy edges connect folders to their children, and local import nodes resolve to actual file nodes.

**Architecture:** Changes flow through four files: `types.ts` (new types), `default-rules.ts` (styling), `analyzer.ts` (new edges + data), and test files. No changes to the React component or force-rule evaluator logic needed — the evaluator is generic and picks up the new `contains` edge type automatically.

**Tech Stack:** TypeScript, D3, Jest (existing test infra with `createTempRepo` helper in `__tests__/unit/ts-analyzer.test.ts`)

---

## File Structure

| File | Change |
|---|---|
| `lib/ts/types.ts` | Add `inTestFile?: boolean` to `TsNodeBase`; add `ContainsEdge`; update `TsEdge` union |
| `lib/ts/default-rules.ts` | Replace all node/edge styles; add test-file, test-children, and contains-edge rules |
| `lib/ts/analyzer.ts` | Detect test files; mark child nodes with `inTestFile`; emit `contains` edges; resolve local imports to FileNodes |
| `__tests__/unit/ts-types.test.ts` | Add `ContainsEdge` discriminator test |
| `__tests__/unit/force-rules.test.ts` | Update integration color assertions to match new defaults |
| `__tests__/unit/ts-analyzer.test.ts` | Add tests for: inTestFile marking, contains edges, local import resolution |

---

## Task 1: Add ContainsEdge and inTestFile to types.ts

**Files:**
- Modify: `lib/ts/types.ts`
- Test: `__tests__/unit/ts-types.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/unit/ts-types.test.ts`, inside the `describe('TsEdge type discrimination')` block, after the existing `CallEdge` test:

```typescript
  it('discriminates ContainsEdge by type', () => {
    const edge: TsEdge = {
      id: 'edge-4',
      type: 'contains',
      source: 'folder-src',
      target: 'file-app',
    };
    expect(edge.type).toBe('contains');
  });
```

Also add `ContainsEdge` to the import at the top of `ts-types.test.ts`:

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
npx jest __tests__/unit/ts-types.test.ts -t "ContainsEdge" --no-coverage
```

Expected: FAIL — `ContainsEdge` is not exported from `@/lib/ts/types`.

- [ ] **Step 3: Update types.ts**

In `lib/ts/types.ts`:

**3a.** Add `inTestFile?: boolean;` to `TsNodeBase` (after the `siblings` line):

```typescript
export interface TsNodeBase {
  id: string;
  kind: NodeKind;
  parent: string | null;
  children: string[];
  siblings: string[];
  inTestFile?: boolean;
}
```

**3b.** Add `ContainsEdge` interface after `CallEdge`:

```typescript
export interface ContainsEdge extends TsEdgeBase {
  type: 'contains';
}
```

**3c.** Update `TsEdge` union:

```typescript
export type TsEdge = ImportEdge | ExportEdge | CallEdge | ContainsEdge;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/ts-types.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ts/types.ts __tests__/unit/ts-types.test.ts
git commit -m "feat(ts-graph): add ContainsEdge type and inTestFile flag to TsNodeBase"
```

---

## Task 2: Update default-rules.ts styles

**Files:**
- Modify: `lib/ts/default-rules.ts`
- Modify: `__tests__/unit/force-rules.test.ts` (update stale color assertions)

- [ ] **Step 1: Update failing integration tests first**

In `__tests__/unit/force-rules.test.ts`, find the `default rules integration` describe block and update the two color assertions to match the new values:

```typescript
describe('default rules integration', () => {
  it('evaluates default node rules for a TS FILE node', () => {
    const fileNode = makeFileNode({ fileType: 'ts' });
    const forces = evaluateNodeForces(fileNode, defaultNodeRules);
    expect(forces.charge).toBe(-200);
    expect(forces.collideRadius).toBe(15);
    const style = evaluateNodeStyle(fileNode, defaultNodeRules);
    expect(style.color).toBe('#9ca3af');
    expect(style.radius).toBe(8);
  });

  it('evaluates default node rules for a FOLDER node', () => {
    const folderNode = makeFolderNode();
    const forces = evaluateNodeForces(folderNode, defaultNodeRules);
    expect(forces.charge).toBe(-400);
    expect(forces.zone).toBe('center');
    const style = evaluateNodeStyle(folderNode, defaultNodeRules);
    expect(style.color).toBe('#d1d5db');
    expect(style.radius).toBe(12);
  });

  it('evaluates default edge rules for an import edge', () => {
    const edge = makeImportEdge();
    const forces = evaluateEdgeForces(edge, defaultEdgeRules);
    expect(forces.linkDistance).toBe(80);
    expect(forces.linkStrength).toBe(0.6);
  });
});
```

- [ ] **Step 2: Run tests to confirm they currently fail**

```bash
npx jest __tests__/unit/force-rules.test.ts -t "default rules integration" --no-coverage
```

Expected: FAIL — colors `#2563eb` and `#6366f1` don't match expected `#9ca3af` and `#d1d5db`.

- [ ] **Step 3: Replace default-rules.ts entirely**

Replace the full content of `lib/ts/default-rules.ts` with:

```typescript
import { NodeForceRule, EdgeForceRule } from './types';

export const defaultNodeRules: NodeForceRule[] = [
  // Test files — must precede general file rules so first-match-wins gives test styling
  {
    id: 'file-test',
    label: 'Test Files',
    enabled: true,
    match: (n) =>
      n.kind === 'FILE' &&
      (n.path.includes('.test.ts') ||
        n.path.includes('.test.tsx') ||
        n.path.includes('.spec.ts') ||
        n.path.includes('.spec.tsx') ||
        n.path.split('/').includes('__tests__')),
    forces: { charge: -80, collideRadius: 6 },
    style: { color: '#e5e7eb', radius: 3 },
  },
  // Children of test files — must precede general function/class/interface rules
  {
    id: 'test-children',
    label: 'Test File Children',
    enabled: true,
    match: (n) =>
      (n.kind === 'FUNCTION' || n.kind === 'CLASS' || n.kind === 'INTERFACE') &&
      !!n.inTestFile,
    forces: { charge: -40, collideRadius: 4 },
    style: { color: '#e5e7eb', radius: 2 },
  },
  {
    id: 'folder-nodes',
    label: 'Folders',
    enabled: true,
    match: (n) => n.kind === 'FOLDER',
    forces: { charge: -400, collideRadius: 30, zone: 'center' },
    style: { color: '#d1d5db', radius: 12 },
  },
  {
    id: 'file-tsx',
    label: 'TSX Files',
    enabled: true,
    match: (n) => n.kind === 'FILE' && n.fileType === 'tsx',
    forces: { charge: -200, collideRadius: 15 },
    style: { color: '#9ca3af', radius: 8 },
  },
  {
    id: 'file-ts',
    label: 'TS Files',
    enabled: true,
    match: (n) => n.kind === 'FILE' && n.fileType === 'ts',
    forces: { charge: -200, collideRadius: 15 },
    style: { color: '#9ca3af', radius: 8 },
  },
  {
    id: 'function-nodes',
    label: 'Functions',
    enabled: true,
    match: (n) => n.kind === 'FUNCTION',
    forces: { charge: -100, collideRadius: 8 },
    style: { color: '#10b981', radius: 5 },
  },
  {
    id: 'class-nodes',
    label: 'Classes',
    enabled: true,
    match: (n) => n.kind === 'CLASS',
    forces: { charge: -300, collideRadius: 20 },
    style: { color: '#f59e0b', radius: 10 },
  },
  {
    id: 'interface-nodes',
    label: 'Interfaces',
    enabled: true,
    match: (n) => n.kind === 'INTERFACE',
    forces: { charge: -150, collideRadius: 12 },
    style: { color: '#8b5cf6', radius: 7 },
  },
  {
    id: 'import-local',
    label: 'Local Imports',
    enabled: true,
    match: (n) => n.kind === 'IMPORT' && n.source === 'local',
    forces: { charge: -50, collideRadius: 6 },
    style: { color: '#94a3b8', radius: 4 },
  },
  {
    id: 'import-package',
    label: 'Package Imports',
    enabled: true,
    match: (n) => n.kind === 'IMPORT' && n.source === 'package',
    forces: { charge: -50, collideRadius: 6, zone: 'right' },
    style: { color: '#64748b', radius: 4 },
  },
];

export const defaultEdgeRules: EdgeForceRule[] = [
  {
    id: 'contains-edges',
    label: 'Contains Edges',
    enabled: true,
    match: (e) => e.type === 'contains',
    forces: { linkDistance: 60, linkStrength: 0.2 },
    style: { color: '#e5e7eb', width: 0.5 },
  },
  {
    id: 'import-edges',
    label: 'Import Edges',
    enabled: true,
    match: (e) => e.type === 'import',
    forces: { linkDistance: 80, linkStrength: 0.6 },
    style: { color: '#94a3b8', width: 1 },
  },
  {
    id: 'export-edges',
    label: 'Export Edges',
    enabled: true,
    match: (e) => e.type === 'export',
    forces: { linkDistance: 60, linkStrength: 0.7 },
    style: { color: '#6366f1', width: 1.5 },
  },
  {
    id: 'call-edges',
    label: 'Call Edges',
    enabled: true,
    match: (e) => e.type === 'call',
    forces: { linkDistance: 40, linkStrength: 0.8 },
    style: { color: '#10b981', width: 1 },
  },
];
```

- [ ] **Step 4: Run all unit tests**

```bash
npx jest __tests__/unit/ --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ts/default-rules.ts __tests__/unit/force-rules.test.ts
git commit -m "feat(ts-graph): restyle nodes — folders light gray, files gray, test files lighter gray + smaller"
```

---

## Task 3: Mark test file children with inTestFile in analyzer.ts

**Files:**
- Modify: `lib/ts/analyzer.ts`
- Test: `__tests__/unit/ts-analyzer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/unit/ts-analyzer.test.ts`, inside the `describe('analyzeTypeScriptRepo')` block:

```typescript
  it('sets inTestFile on FileNode and child nodes inside a test file', () => {
    repoDir = createTempRepo({
      'src/utils.test.ts': `
        export function testHelper(): void {}
      `,
      'src/regular.ts': `
        export function normalFn(): void {}
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const testFile = result.nodes.find(
      (n) => n.kind === 'FILE' && n.name === 'utils.test.ts'
    );
    expect(testFile).toBeDefined();
    expect(testFile!.inTestFile).toBe(true);

    const testHelper = result.nodes.find(
      (n) => n.kind === 'FUNCTION' && n.name === 'testHelper'
    );
    expect(testHelper).toBeDefined();
    expect(testHelper!.inTestFile).toBe(true);

    const normalFile = result.nodes.find(
      (n) => n.kind === 'FILE' && n.name === 'regular.ts'
    );
    expect(normalFile).toBeDefined();
    expect(normalFile!.inTestFile).toBeFalsy();

    const normalFn = result.nodes.find(
      (n) => n.kind === 'FUNCTION' && n.name === 'normalFn'
    );
    expect(normalFn).toBeDefined();
    expect(normalFn!.inTestFile).toBeFalsy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/unit/ts-analyzer.test.ts -t "inTestFile" --no-coverage
```

Expected: FAIL — `inTestFile` is undefined on all nodes.

- [ ] **Step 3: Add isTestFile helper and inTestFile propagation to analyzer.ts**

**3a.** Add `isTestFile` helper function near the top of `analyzeTypeScriptRepo`, after the existing helper declarations (after `callEdgeSet`):

```typescript
  function isTestFile(filePath: string): boolean {
    const parts = filePath.split(path.sep);
    return (
      parts.includes('__tests__') ||
      filePath.includes('.test.ts') ||
      filePath.includes('.test.tsx') ||
      filePath.includes('.spec.ts') ||
      filePath.includes('.spec.tsx')
    );
  }
```

**3b.** In the first pass, compute `isTest` right after `const ext = ...`, and pass it into the `FileNode`:

Replace:
```typescript
    const fileId = `file:${relativePath}`;
    const fileNode: FileNode = {
      id: fileId,
      kind: 'FILE',
      parent: parentFolderId,
      children: [],
      siblings: [],
      name: fileName,
      path: filePath,
      fileType: ext,
    };
```

With:
```typescript
    const isTest = isTestFile(filePath);
    const fileId = `file:${relativePath}`;
    const fileNode: FileNode = {
      id: fileId,
      kind: 'FILE',
      parent: parentFolderId,
      children: [],
      siblings: [],
      name: fileName,
      path: filePath,
      fileType: ext,
      inTestFile: isTest,
    };
```

**3c.** Propagate `inTestFile` to every `FunctionNode` created in this source file. In the function declaration handler, add `inTestFile: isTest` to the `FunctionNode` literal:

```typescript
        const fnNode: FunctionNode = {
          id: fnId,
          kind: 'FUNCTION',
          parent: fileId,
          children: [],
          siblings: [],
          name: fnName,
          params: extractParams(node.parameters, sourceFile),
          returnType: node.type ? node.type.getText(sourceFile) : null,
          inTestFile: isTest,
        };
```

**3d.** Do the same for `ClassNode`:

```typescript
        const classNode: ClassNode = {
          id: classId,
          kind: 'CLASS',
          parent: fileId,
          children: [],
          siblings: [],
          name: className,
          extends: extendsClause?.types[0]?.expression.getText(sourceFile) ?? null,
          implements: implementsClause?.types.map((t) => t.expression.getText(sourceFile)) ?? [],
          decorators,
          constructorParams,
          inTestFile: isTest,
        };
```

**3e.** Do the same for `InterfaceNode`:

```typescript
        const ifaceNode: InterfaceNode = {
          id: ifaceId,
          kind: 'INTERFACE',
          parent: fileId,
          children: [],
          siblings: [],
          name: ifaceName,
          isExported,
          propertyCount,
          methodCount,
          extends: extendsClause?.types.map((t) => t.expression.getText(sourceFile)) ?? [],
          inTestFile: isTest,
        };
```

**3f.** Do the same for the arrow function / variable statement `FunctionNode`:

```typescript
            const fnNode: FunctionNode = {
              id: fnId,
              kind: 'FUNCTION',
              parent: fileId,
              children: [],
              siblings: [],
              name: fnName,
              params: extractParams(decl.initializer.parameters, sourceFile),
              returnType: decl.initializer.type ? decl.initializer.type.getText(sourceFile) : null,
              inTestFile: isTest,
            };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/ts-analyzer.test.ts -t "inTestFile" --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Run all tests**

```bash
npx jest __tests__/unit/ --no-coverage
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ts/analyzer.ts __tests__/unit/ts-analyzer.test.ts
git commit -m "feat(ts-graph): mark test file nodes with inTestFile flag"
```

---

## Task 4: Emit contains edges for folder hierarchy

**Files:**
- Modify: `lib/ts/analyzer.ts`
- Modify: `__tests__/unit/ts-analyzer.test.ts`

Also add `ContainsEdge` to the import in `analyzer.ts`.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/unit/ts-analyzer.test.ts`:

```typescript
  it('emits contains edges from folders to child folders and files', () => {
    repoDir = createTempRepo({
      'src/utils/helpers.ts': 'export const x = 1;',
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const containsEdges = result.edges.filter((e) => e.type === 'contains');
    expect(containsEdges.length).toBeGreaterThanOrEqual(2); // root→src, src→utils, utils→helpers.ts

    const utilsFolder = result.nodes.find(
      (n) => n.kind === 'FOLDER' && n.name === 'utils'
    );
    const helpersFile = result.nodes.find(
      (n) => n.kind === 'FILE' && n.name === 'helpers.ts'
    );
    expect(utilsFolder).toBeDefined();
    expect(helpersFile).toBeDefined();

    const folderToFile = containsEdges.find(
      (e) => e.source === utilsFolder!.id && e.target === helpersFile!.id
    );
    expect(folderToFile).toBeDefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/unit/ts-analyzer.test.ts -t "contains edges" --no-coverage
```

Expected: FAIL — no `contains` edges in result.

- [ ] **Step 3: Add ContainsEdge to analyzer.ts import and emit contains edges**

**3a.** Update the import at the top of `lib/ts/analyzer.ts` to add `ContainsEdge`:

```typescript
import {
  TsGraphData,
  TsNode,
  TsEdge,
  FolderNode,
  FileNode,
  FunctionNode,
  ClassNode,
  InterfaceNode,
  ImportNode,
  ImportEdge,
  ExportEdge,
  CallEdge,
  ContainsEdge,
  Param,
} from './types';
```

**3b.** After the fourth pass (siblings) block and before `return { nodes, edges }`, add a fifth pass:

```typescript
  // Fifth pass: emit contains edges for FOLDER → child-FOLDER and FOLDER → FILE
  for (const node of nodes) {
    if (!node.parent) continue;
    const parentNode = nodeMap.get(node.parent);
    if (!parentNode || parentNode.kind !== 'FOLDER') continue;
    if (node.kind !== 'FOLDER' && node.kind !== 'FILE') continue;
    edges.push({
      id: nextEdgeId(),
      type: 'contains',
      source: node.parent,
      target: node.id,
    } as ContainsEdge);
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/ts-analyzer.test.ts -t "contains edges" --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Run all tests**

```bash
npx jest __tests__/unit/ --no-coverage
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ts/analyzer.ts __tests__/unit/ts-analyzer.test.ts
git commit -m "feat(ts-graph): emit contains edges for folder-to-folder and folder-to-file relationships"
```

---

## Task 5: Resolve local import specifiers to actual FileNodes

**Files:**
- Modify: `lib/ts/analyzer.ts`
- Modify: `__tests__/unit/ts-analyzer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/unit/ts-analyzer.test.ts`:

```typescript
  it('emits ImportNode→FileNode edge for resolved local imports', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { helper } from './utils';
        export const x = helper();
      `,
      'src/utils.ts': `
        export function helper(): number { return 1; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const importNode = result.nodes.find(
      (n) => n.kind === 'IMPORT' && n.name === './utils'
    );
    expect(importNode).toBeDefined();

    const utilsFile = result.nodes.find(
      (n) => n.kind === 'FILE' && n.name === 'utils.ts'
    );
    expect(utilsFile).toBeDefined();

    // ImportNode → FileNode resolution edge
    const resolutionEdge = result.edges.find(
      (e) => e.type === 'import' && e.source === importNode!.id && e.target === utilsFile!.id
    );
    expect(resolutionEdge).toBeDefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/unit/ts-analyzer.test.ts -t "ImportNode.*FileNode" --no-coverage
```

Expected: FAIL — no edge from ImportNode to FileNode.

- [ ] **Step 3: Add deferred local import resolution to analyzer.ts**

**3a.** Add the `pendingLocalImports` collection array alongside the existing `pendingReexports` declaration (around line 139):

```typescript
  const pendingLocalImports: Array<{
    importNodeId: string;
    specifier: string;
    sourceFileName: string;
  }> = [];
```

**3b.** In the first pass import handler (inside `ts.isImportDeclaration(node) && node.moduleSpecifier` block), after the `ImportNode` is created/retrieved and the `importEdge` is pushed, add the local import to the pending list:

```typescript
        if (isLocal) {
          pendingLocalImports.push({
            importNodeId: importNode.id,
            specifier,
            sourceFileName: filePath,
          });
        }
```

Place this immediately after `edges.push(importEdge);`.

**3c.** After the `pendingReexports` resolution block (after `}` of that `for` loop), add the local import resolution block:

```typescript
  // Resolve local import specifiers to their actual FileNodes
  for (const { importNodeId, specifier, sourceFileName } of pendingLocalImports) {
    const resolvedModule = ts.resolveModuleName(
      specifier,
      sourceFileName,
      program.getCompilerOptions(),
      ts.sys
    );
    const resolvedFile = resolvedModule.resolvedModule?.resolvedFileName;
    if (resolvedFile && resolvedFile.startsWith(repoPath)) {
      const resolvedRelative = path.relative(repoPath, resolvedFile);
      const resolvedFileId = `file:${resolvedRelative}`;
      if (nodeMap.has(resolvedFileId)) {
        edges.push({
          id: nextEdgeId(),
          type: 'import',
          source: importNodeId,
          target: resolvedFileId,
        } as ImportEdge);
      }
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/ts-analyzer.test.ts -t "ImportNode.*FileNode" --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: Run the TypeScript build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add lib/ts/analyzer.ts __tests__/unit/ts-analyzer.test.ts
git commit -m "feat(ts-graph): resolve local import specifiers to actual FileNodes"
```
