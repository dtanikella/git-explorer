# Analysis Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a language-agnostic analysis controller that uses tree-sitter (AST parsing) and SCIP (cross-file symbol resolution) to produce typed nodes and edges for TypeScript repos, exposed via `POST /api/repo-analysis`.

**Architecture:** Pipeline with 5 stages — SCIP indexing → tree-sitter parsing → node extraction → edge extraction → graph assembly. A top-level controller detects language and delegates to a TS-specific sub-controller. Each stage is a focused module with clear inputs/outputs.

**Tech Stack:** tree-sitter (via `lib/tree-sitter/`), SCIP (via `lib/scip/`), Next.js API route, Jest + ts-jest for testing.

**Spec:** `docs/superpowers/specs/2026-04-28-analysis-controller-design.md`

---

## File Structure

```
lib/analysis/
  types.ts                              # Schema: AnalysisNode, AnalysisEdge, enums, errors

app/services/analysis/
  language-detector.ts                  # detectLanguage(repoPath) → SupportedLanguage | null
  test-file-detector.ts                 # isTestFile(filePath) → boolean
  controller.ts                         # analyzeRepo() — language-agnostic orchestrator
  ts/
    controller.ts                       # analyzeTsRepo() — TS pipeline orchestrator
    node-extractor.ts                   # extractNodes() — tree-sitter AST → AnalysisNode[]
    edge-extractor.ts                   # extractEdges() — SCIP refs + AST context → AnalysisEdge[]
    graph-assembler.ts                  # assembleResult() — metadata computation

app/api/repo-analysis/
  route.ts                              # POST endpoint

__tests__/
  unit/
    analysis-types.test.ts              # Schema enum/error tests
    language-detector.test.ts           # Language detection tests
    test-file-detector.test.ts          # Test file detection tests
    node-extractor.test.ts              # Node extraction tests
    edge-extractor.test.ts              # Edge extraction tests
    graph-assembler.test.ts             # Graph assembly tests
  integration/
    analysis-controller.integration.test.ts  # Full pipeline integration test
  fixtures/
    analysis-test-project/              # Extended fixture for analysis tests
      tsconfig.json
      src/
        index.ts                        # Functions + imports + calls
        utils.ts                        # Functions (sync + async)
        models.ts                       # Class + interface + type alias
```

---

### Task 1: Schema Types and Error Classes

**Files:**
- Create: `lib/analysis/types.ts`
- Test: `__tests__/unit/analysis-types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/analysis-types.test.ts
import {
  SyntaxType,
  EdgeKind,
  AnalysisError,
  UnsupportedLanguageError,
  NodeExtractionError,
  EdgeExtractionError,
} from '@/lib/analysis/types';

describe('SyntaxType enum', () => {
  it('has all expected members', () => {
    expect(SyntaxType.FUNCTION).toBe('FUNCTION');
    expect(SyntaxType.METHOD).toBe('METHOD');
    expect(SyntaxType.CLASS).toBe('CLASS');
    expect(SyntaxType.INTERFACE).toBe('INTERFACE');
    expect(SyntaxType.TYPE_ALIAS).toBe('TYPE_ALIAS');
    expect(SyntaxType.MODULE).toBe('MODULE');
  });
});

describe('EdgeKind enum', () => {
  it('has all expected members', () => {
    expect(EdgeKind.CALLS).toBe('CALLS');
    expect(EdgeKind.INSTANTIATES).toBe('INSTANTIATES');
    expect(EdgeKind.USES_TYPE).toBe('USES_TYPE');
    expect(EdgeKind.IMPORTS).toBe('IMPORTS');
    expect(EdgeKind.EXTENDS).toBe('EXTENDS');
    expect(EdgeKind.IMPLEMENTS).toBe('IMPLEMENTS');
  });
});

describe('AnalysisError', () => {
  it('captures repoPath', () => {
    const err = new AnalysisError('boom', '/some/repo');
    expect(err.message).toBe('boom');
    expect(err.repoPath).toBe('/some/repo');
    expect(err.name).toBe('AnalysisError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('UnsupportedLanguageError', () => {
  it('extends AnalysisError', () => {
    const err = new UnsupportedLanguageError('/repo');
    expect(err.repoPath).toBe('/repo');
    expect(err.name).toBe('UnsupportedLanguageError');
    expect(err).toBeInstanceOf(AnalysisError);
  });
});

describe('NodeExtractionError', () => {
  it('captures filePath and phase', () => {
    const err = new NodeExtractionError('fail', '/repo', 'src/foo.ts', 'tree-walk');
    expect(err.filePath).toBe('src/foo.ts');
    expect(err.phase).toBe('tree-walk');
    expect(err).toBeInstanceOf(AnalysisError);
  });
});

describe('EdgeExtractionError', () => {
  it('captures filePath and phase', () => {
    const err = new EdgeExtractionError('fail', '/repo', 'src/foo.ts', 'scip-walk');
    expect(err.filePath).toBe('src/foo.ts');
    expect(err.phase).toBe('scip-walk');
    expect(err).toBeInstanceOf(AnalysisError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/analysis-types.test.ts --no-cache`
Expected: FAIL — module `@/lib/analysis/types` does not exist.

- [ ] **Step 3: Implement types and error classes**

```typescript
// lib/analysis/types.ts

// ============================================================================
// Enums
// ============================================================================

export enum SyntaxType {
  FUNCTION = 'FUNCTION',
  METHOD = 'METHOD',
  CLASS = 'CLASS',
  INTERFACE = 'INTERFACE',
  TYPE_ALIAS = 'TYPE_ALIAS',
  MODULE = 'MODULE',
  // NOT YET INCLUDED: ENUM, VARIABLE, NAMESPACE, DECORATOR, GETTER, SETTER, CONSTRUCTOR
}

export enum EdgeKind {
  CALLS = 'CALLS',
  INSTANTIATES = 'INSTANTIATES',
  USES_TYPE = 'USES_TYPE',
  IMPORTS = 'IMPORTS',
  EXTENDS = 'EXTENDS',
  IMPLEMENTS = 'IMPLEMENTS',
  // NOT YET INCLUDED: OVERRIDES, DECORATES, RETURNS_TYPE, THROWS, GENERIC_PARAM
}

// ============================================================================
// Interfaces
// ============================================================================

export interface ParamInfo {
  name: string;
  typeText: string | null;
  isOptional: boolean;
}

export interface ReferenceLocation {
  filePath: string;
  line: number;
  col: number;
  scipSymbol: string;
}

export interface AnalysisNode {
  syntaxType: SyntaxType;
  name: string;
  filePath: string;
  startLine: number;
  startCol: number;
  isAsync: boolean;
  isExported: boolean;
  params: ParamInfo[];
  returnTypeText: string | null;
  scipSymbol: string;
  isDefinition: boolean;
  inTestFile: boolean;
  referencedAt: ReferenceLocation[];
  outboundRefs: ReferenceLocation[];
}

export interface AnalysisEdge {
  kind: EdgeKind;
  fromFile: string;
  fromName: string;
  fromSymbol: string;
  toText: string;
  toFile: string | null;
  toName: string;
  toSymbol: string;
  isExternal: boolean;
  edgePosition: { line: number; col: number };
  isOptionalChain: boolean;
  isAsync: boolean;
}

export interface AnalysisMetadata {
  repoPath: string;
  language: string;
  nodeCount: number;
  edgeCount: number;
  analysisDurationMs: number;
  missingNodeTypes: string[];
  missingEdgeKinds: string[];
}

export interface AnalysisResult {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  metadata: AnalysisMetadata;
}

// ============================================================================
// Documented Gaps (for metadata.missingNodeTypes / missingEdgeKinds)
// ============================================================================

export const MISSING_NODE_TYPES = [
  'ENUM', 'VARIABLE', 'NAMESPACE', 'DECORATOR', 'GETTER', 'SETTER', 'CONSTRUCTOR',
];

export const MISSING_EDGE_KINDS = [
  'OVERRIDES', 'DECORATES', 'RETURNS_TYPE', 'THROWS', 'GENERIC_PARAM',
];

// ============================================================================
// Error Classes
// ============================================================================

export class AnalysisError extends Error {
  readonly name = 'AnalysisError';

  constructor(
    message: string,
    readonly repoPath: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, AnalysisError.prototype);
  }
}

export class UnsupportedLanguageError extends AnalysisError {
  readonly name = 'UnsupportedLanguageError';

  constructor(repoPath: string) {
    super(`No supported language detected in ${repoPath}`, repoPath);
    Object.setPrototypeOf(this, UnsupportedLanguageError.prototype);
  }
}

export class NodeExtractionError extends AnalysisError {
  readonly name = 'NodeExtractionError';

  constructor(
    message: string,
    repoPath: string,
    readonly filePath: string,
    readonly phase: string,
  ) {
    super(message, repoPath);
    Object.setPrototypeOf(this, NodeExtractionError.prototype);
  }
}

export class EdgeExtractionError extends AnalysisError {
  readonly name = 'EdgeExtractionError';

  constructor(
    message: string,
    repoPath: string,
    readonly filePath: string,
    readonly phase: string,
  ) {
    super(message, repoPath);
    Object.setPrototypeOf(this, EdgeExtractionError.prototype);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/analysis-types.test.ts --no-cache`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/types.ts __tests__/unit/analysis-types.test.ts
git commit -m "feat(analysis): add schema types, enums, and error classes

Defines SyntaxType, EdgeKind enums, AnalysisNode/AnalysisEdge/AnalysisResult
interfaces, and AnalysisError hierarchy for the analysis controller pipeline.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Language Detector

**Files:**
- Create: `app/services/analysis/language-detector.ts`
- Test: `__tests__/unit/language-detector.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/language-detector.test.ts
import { detectLanguage, SupportedLanguage } from '@/app/services/analysis/language-detector';

jest.mock('fs/promises');
const fs = require('fs/promises');

describe('detectLanguage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "typescript" when tsconfig.json exists', async () => {
    fs.access.mockResolvedValue(undefined);

    const result = await detectLanguage('/my/repo');
    expect(result).toBe('typescript');
    expect(fs.access).toHaveBeenCalledWith(expect.stringContaining('tsconfig.json'));
  });

  it('returns null when tsconfig.json does not exist', async () => {
    fs.access.mockRejectedValue(new Error('ENOENT'));

    const result = await detectLanguage('/my/repo');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/language-detector.test.ts --no-cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement language detector**

```typescript
// app/services/analysis/language-detector.ts
import * as fs from 'fs/promises';
import * as path from 'path';

export type SupportedLanguage = 'typescript';

export async function detectLanguage(repoPath: string): Promise<SupportedLanguage | null> {
  const tsconfigPath = path.join(repoPath, 'tsconfig.json');
  try {
    await fs.access(tsconfigPath);
    return 'typescript';
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/language-detector.test.ts --no-cache`
Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/analysis/language-detector.ts __tests__/unit/language-detector.test.ts
git commit -m "feat(analysis): add language detector

Detects TypeScript repos by checking for tsconfig.json. Returns
SupportedLanguage or null.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Test File Detector

**Files:**
- Create: `app/services/analysis/test-file-detector.ts`
- Test: `__tests__/unit/test-file-detector.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/test-file-detector.test.ts
import { isTestFile } from '@/app/services/analysis/test-file-detector';

describe('isTestFile', () => {
  it('detects .test.ts files', () => {
    expect(isTestFile('src/utils.test.ts')).toBe(true);
  });

  it('detects .spec.ts files', () => {
    expect(isTestFile('src/utils.spec.ts')).toBe(true);
  });

  it('detects .test.tsx files', () => {
    expect(isTestFile('components/App.test.tsx')).toBe(true);
  });

  it('detects .spec.tsx files', () => {
    expect(isTestFile('components/App.spec.tsx')).toBe(true);
  });

  it('detects files in __tests__/ directory', () => {
    expect(isTestFile('__tests__/unit/foo.ts')).toBe(true);
  });

  it('detects files in test/ directory', () => {
    expect(isTestFile('test/integration/bar.ts')).toBe(true);
  });

  it('detects files in tests/ directory', () => {
    expect(isTestFile('tests/helpers/baz.ts')).toBe(true);
  });

  it('returns false for regular source files', () => {
    expect(isTestFile('src/utils.ts')).toBe(false);
  });

  it('returns false for files with test in the name but not matching patterns', () => {
    expect(isTestFile('src/testUtils.ts')).toBe(false);
  });

  it('handles nested paths correctly', () => {
    expect(isTestFile('packages/core/__tests__/deep/nested.ts')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/test-file-detector.test.ts --no-cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement test file detector**

```typescript
// app/services/analysis/test-file-detector.ts

const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /(^|[\\/])__tests__[\\/]/,
  /(^|[\\/])tests?[\\/]/,
];

export function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some(pattern => pattern.test(filePath));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/test-file-detector.test.ts --no-cache`
Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/analysis/test-file-detector.ts __tests__/unit/test-file-detector.test.ts
git commit -m "feat(analysis): add test file detector

Pattern-based detection of test files by extension (.test/.spec) and
directory (__tests__/, test/, tests/).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Analysis Test Fixture Project

**Files:**
- Create: `__tests__/fixtures/analysis-test-project/tsconfig.json`
- Create: `__tests__/fixtures/analysis-test-project/src/index.ts`
- Create: `__tests__/fixtures/analysis-test-project/src/utils.ts`
- Create: `__tests__/fixtures/analysis-test-project/src/models.ts`

This fixture exercises all SyntaxTypes and EdgeKinds so node/edge extraction tests have real data to validate against.

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 2: Create src/utils.ts**

Contains exported functions (sync and async) to test FUNCTION node extraction.

```typescript
export function add(a: number, b: number): number {
  return a + b;
}

export async function fetchData(url: string): Promise<string> {
  return url;
}
```

- [ ] **Step 3: Create src/models.ts**

Contains a class, interface, and type alias to test CLASS, INTERFACE, TYPE_ALIAS node extraction and EXTENDS/IMPLEMENTS/USES_TYPE edges.

```typescript
export interface Serializable {
  serialize(): string;
}

export interface Printable {
  print(): void;
}

export type ID = string | number;

export class BaseModel {
  id: ID;
  constructor(id: ID) {
    this.id = id;
  }
}

export class User extends BaseModel implements Serializable {
  constructor(id: ID, public name: string) {
    super(id);
  }

  serialize(): string {
    return JSON.stringify({ id: this.id, name: this.name });
  }
}
```

- [ ] **Step 4: Create src/index.ts**

Contains imports, calls, instantiation, and optional chaining to test IMPORTS, CALLS, INSTANTIATES edges.

```typescript
import { add, fetchData } from './utils';
import { User, type ID } from './models';

export function main(): number {
  const result = add(1, 2);
  return result;
}

export async function runAsync(): Promise<string> {
  const data = await fetchData('https://example.com');
  return data;
}

export function createUser(id: ID): User {
  return new User(id, 'Alice');
}

export function getUserName(user: User | null): string | undefined {
  return user?.name;
}
```

- [ ] **Step 5: Commit**

```bash
git add __tests__/fixtures/analysis-test-project/
git commit -m "test(analysis): add fixture project for analysis tests

Fixture with functions, classes, interfaces, type aliases, cross-file
imports, calls, instantiation, and optional chaining.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Node Extractor

**Files:**
- Create: `app/services/analysis/ts/node-extractor.ts`
- Test: `__tests__/unit/node-extractor.test.ts`

The node extractor walks tree-sitter ASTs and correlates each declaration with its SCIP symbol via position matching.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/node-extractor.test.ts
/**
 * @jest-environment node
 */
import { extractNodes, type NodeExtractionInput, type NodeExtractionOutput } from '@/app/services/analysis/ts/node-extractor';
import { SyntaxType } from '@/lib/analysis/types';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';

// Helper to parse a TS string and return TreeWrapper
function parseTs(source: string): TreeWrapper {
  const lang = loadLanguage('typescript');
  const parser = createParser(lang, 'typescript');
  return parser.parse(source).tree;
}

// Minimal SCIP document mock matching the @c4312/scip deserialized shape
function mockScipDoc(relativePath: string, occurrences: Array<{
  range: number[];
  symbol: string;
  symbolRoles: number;
}>) {
  return { relativePath, occurrences, symbols: [], text: '', language: 0, positionEncoding: 0 };
}

describe('extractNodes', () => {
  it('extracts a function declaration', () => {
    const source = 'export function add(a: number, b: number): number {\n  return a + b;\n}';
    const tree = parseTs(source);

    // "add" identifier starts at row 0, col 16
    const scipDoc = mockScipDoc('src/utils.ts', [
      { range: [0, 16, 19], symbol: 'scip-ts npm . . utils.ts/add().', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/utils.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);

    expect(output.nodes.length).toBeGreaterThanOrEqual(1);
    const addNode = output.nodes.find(n => n.name === 'add');
    expect(addNode).toBeDefined();
    expect(addNode!.syntaxType).toBe(SyntaxType.FUNCTION);
    expect(addNode!.isExported).toBe(true);
    expect(addNode!.isAsync).toBe(false);
    expect(addNode!.params).toEqual([
      { name: 'a', typeText: 'number', isOptional: false },
      { name: 'b', typeText: 'number', isOptional: false },
    ]);
    expect(addNode!.returnTypeText).toBe('number');
    expect(addNode!.scipSymbol).toBe('scip-ts npm . . utils.ts/add().');
    expect(addNode!.isDefinition).toBe(true);
    expect(addNode!.filePath).toBe('src/utils.ts');
  });

  it('extracts an async function', () => {
    const source = 'export async function fetchData(url: string): Promise<string> {\n  return url;\n}';
    const tree = parseTs(source);

    // "fetchData" starts at row 0, col 22
    const scipDoc = mockScipDoc('src/utils.ts', [
      { range: [0, 22, 31], symbol: 'scip-ts npm . . utils.ts/fetchData().', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/utils.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find(n => n.name === 'fetchData');
    expect(node).toBeDefined();
    expect(node!.isAsync).toBe(true);
    expect(node!.returnTypeText).toBe('Promise<string>');
  });

  it('extracts a class declaration', () => {
    const source = 'export class User {\n  constructor(public name: string) {}\n}';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/models.ts', [
      { range: [0, 13, 17], symbol: 'scip-ts npm . . models.ts/User#', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/models.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find(n => n.name === 'User');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.CLASS);
    expect(node!.isExported).toBe(true);
  });

  it('extracts an interface declaration', () => {
    const source = 'export interface Serializable {\n  serialize(): string;\n}';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/models.ts', [
      { range: [0, 17, 29], symbol: 'scip-ts npm . . models.ts/Serializable#', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/models.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find(n => n.name === 'Serializable');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.INTERFACE);
  });

  it('extracts a type alias declaration', () => {
    const source = 'export type ID = string | number;';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/models.ts', [
      { range: [0, 12, 14], symbol: 'scip-ts npm . . models.ts/ID#', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/models.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find(n => n.name === 'ID');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.TYPE_ALIAS);
  });

  it('extracts a method declaration', () => {
    const source = 'class Foo {\n  bar(x: number): void {}\n}';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/foo.ts', [
      { range: [0, 6, 9], symbol: 'scip-ts npm . . foo.ts/Foo#', symbolRoles: 1 },
      { range: [1, 2, 5], symbol: 'scip-ts npm . . foo.ts/Foo#bar().', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/foo.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const barNode = output.nodes.find(n => n.name === 'bar');
    expect(barNode).toBeDefined();
    expect(barNode!.syntaxType).toBe(SyntaxType.METHOD);
  });

  it('builds nodeMap keyed by SCIP symbol', () => {
    const source = 'export function greet(): void {}';
    const tree = parseTs(source);

    const symbol = 'scip-ts npm . . test.ts/greet().';
    const scipDoc = mockScipDoc('src/test.ts', [
      { range: [0, 16, 21], symbol, symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/test.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodeMap.has(symbol)).toBe(true);
    expect(output.nodeMap.get(symbol)!.name).toBe('greet');
  });

  it('skips files not in parsedFiles (e.g., filtered test files)', () => {
    // SCIP doc references a file that was filtered out during parsing
    const scipDoc = mockScipDoc('src/utils.test.ts', [
      { range: [0, 9, 12], symbol: 'scip-ts npm . . utils.test.ts/foo().', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map(), // empty — file was filtered
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/node-extractor.test.ts --no-cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the node extractor**

```typescript
// app/services/analysis/ts/node-extractor.ts
import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import type { NodeWrapper } from '@/lib/tree-sitter/node';
import {
  SyntaxType,
  type AnalysisNode,
  type ParamInfo,
} from '@/lib/analysis/types';

// ============================================================================
// Types
// ============================================================================

export interface NodeExtractionInput {
  parsedFiles: Map<string, { tree: TreeWrapper; source: string }>;
  scipDocuments: Array<{
    relativePath: string;
    occurrences: Array<{
      range: number[];
      symbol: string;
      symbolRoles: number;
    }>;
  }>;
  repoPath: string;
}

export interface NodeExtractionOutput {
  nodes: AnalysisNode[];
  nodeMap: Map<string, AnalysisNode>;
}

// SCIP SymbolRole.Definition bitmask
const SCIP_DEFINITION = 1;

// Tree-sitter node types → SyntaxType mapping
const DECLARATION_TYPES: Record<string, SyntaxType> = {
  function_declaration: SyntaxType.FUNCTION,
  // arrow_function is handled separately (needs variable_declarator parent)
  method_definition: SyntaxType.METHOD,
  class_declaration: SyntaxType.CLASS,
  interface_declaration: SyntaxType.INTERFACE,
  type_alias_declaration: SyntaxType.TYPE_ALIAS,
};

// ============================================================================
// Position Helpers
// ============================================================================

type ScipDefLookup = Map<string, { symbol: string }>; // key: "line:col"

function buildScipDefLookup(
  occurrences: Array<{ range: number[]; symbol: string; symbolRoles: number }>,
): ScipDefLookup {
  const lookup: ScipDefLookup = new Map();
  for (const occ of occurrences) {
    if ((occ.symbolRoles & SCIP_DEFINITION) === 0) continue;
    const line = occ.range[0];
    const col = occ.range[1];
    lookup.set(`${line}:${col}`, { symbol: occ.symbol });
  }
  return lookup;
}

// ============================================================================
// AST Helpers
// ============================================================================

function getIdentifierName(node: NodeWrapper): string | null {
  const nameChild = node.childForFieldName('name');
  return nameChild ? nameChild.text : null;
}

function isExported(node: NodeWrapper): boolean {
  const parent = node.parent;
  if (!parent) return false;
  return parent.type === 'export_statement';
}

function isAsyncFunction(node: NodeWrapper): boolean {
  // Check if there's an "async" keyword child
  for (const child of node.children) {
    if (child.type === 'async') return true;
  }
  return false;
}

function extractParams(node: NodeWrapper): ParamInfo[] {
  const params: ParamInfo[] = [];
  const paramsNode = node.childForFieldName('parameters');
  if (!paramsNode) return params;

  for (const child of paramsNode.namedChildren) {
    if (child.type === 'required_parameter' || child.type === 'optional_parameter') {
      const nameNode = child.childForFieldName('pattern') ?? child.childForFieldName('name');
      const typeNode = child.childForFieldName('type');
      params.push({
        name: nameNode?.text ?? '',
        typeText: typeNode?.text ?? null,
        isOptional: child.type === 'optional_parameter',
      });
    }
  }
  return params;
}

function extractReturnType(node: NodeWrapper): string | null {
  const returnType = node.childForFieldName('return_type');
  if (!returnType) return null;
  // return_type includes the colon prefix; get the type node inside
  const typeNode = returnType.firstNamedChild;
  return typeNode ? typeNode.text : returnType.text;
}

// ============================================================================
// Main Extraction
// ============================================================================

export function extractNodes(input: NodeExtractionInput): NodeExtractionOutput {
  const nodes: AnalysisNode[] = [];
  const nodeMap = new Map<string, AnalysisNode>();

  for (const scipDoc of input.scipDocuments) {
    const filePath = scipDoc.relativePath;
    const parsed = input.parsedFiles.get(filePath);
    if (!parsed) continue;

    const defLookup = buildScipDefLookup(scipDoc.occurrences);
    const { tree } = parsed;

    // Walk AST for declarations
    walkDeclarations(tree.rootNode, filePath, defLookup, nodes, nodeMap);
  }

  return { nodes, nodeMap };
}

function walkDeclarations(
  rootNode: NodeWrapper,
  filePath: string,
  defLookup: ScipDefLookup,
  nodes: AnalysisNode[],
  nodeMap: Map<string, AnalysisNode>,
): void {
  // Find all declaration nodes
  const declarationTypes = Object.keys(DECLARATION_TYPES);
  const allDeclarations = rootNode.descendantsOfType(declarationTypes);

  for (const declNode of allDeclarations) {
    const syntaxType = DECLARATION_TYPES[declNode.type];
    if (!syntaxType) continue;

    const name = getIdentifierName(declNode);
    if (!name) continue;

    const nameNode = declNode.childForFieldName('name');
    if (!nameNode) continue;

    const line = nameNode.startPosition.row;
    const col = nameNode.startPosition.column;
    const scipDef = defLookup.get(`${line}:${col}`);
    const scipSymbol = scipDef?.symbol ?? '';

    const node: AnalysisNode = {
      syntaxType,
      name,
      filePath,
      startLine: line,
      startCol: col,
      isAsync: syntaxType === SyntaxType.FUNCTION || syntaxType === SyntaxType.METHOD
        ? isAsyncFunction(declNode)
        : false,
      isExported: isExported(declNode),
      params: syntaxType === SyntaxType.FUNCTION || syntaxType === SyntaxType.METHOD
        ? extractParams(declNode)
        : [],
      returnTypeText: syntaxType === SyntaxType.FUNCTION || syntaxType === SyntaxType.METHOD
        ? extractReturnType(declNode)
        : null,
      scipSymbol,
      isDefinition: true,
      inTestFile: false, // set by caller based on test-file-detector
      referencedAt: [],
      outboundRefs: [],
    };

    nodes.push(node);
    if (scipSymbol) {
      nodeMap.set(scipSymbol, node);
    }
  }

  // Also handle arrow functions assigned to variables:
  // const foo = async (x: number) => { ... }
  const arrowFunctions = rootNode.descendantsOfType(['arrow_function']);
  for (const arrowNode of arrowFunctions) {
    const parent = arrowNode.parent;
    if (!parent || parent.type !== 'variable_declarator') continue;

    const nameNode = parent.childForFieldName('name');
    if (!nameNode) continue;

    const name = nameNode.text;
    const line = nameNode.startPosition.row;
    const col = nameNode.startPosition.column;
    const scipDef = defLookup.get(`${line}:${col}`);
    const scipSymbol = scipDef?.symbol ?? '';

    // Check if the top-level variable_declaration is exported
    const varDecl = parent.parent; // variable_declaration
    const exported = varDecl?.parent?.type === 'export_statement';

    const node: AnalysisNode = {
      syntaxType: SyntaxType.FUNCTION,
      name,
      filePath,
      startLine: line,
      startCol: col,
      isAsync: isAsyncFunction(arrowNode),
      isExported: exported ?? false,
      params: extractParams(arrowNode),
      returnTypeText: extractReturnType(arrowNode),
      scipSymbol,
      isDefinition: true,
      inTestFile: false,
      referencedAt: [],
      outboundRefs: [],
    };

    nodes.push(node);
    if (scipSymbol) {
      nodeMap.set(scipSymbol, node);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/node-extractor.test.ts --no-cache`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/analysis/ts/node-extractor.ts __tests__/unit/node-extractor.test.ts
git commit -m "feat(analysis): add node extractor

Walks tree-sitter ASTs to find declarations (functions, methods, classes,
interfaces, type aliases), correlates with SCIP definition occurrences
via position matching. Outputs AnalysisNode[] and nodeMap.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Edge Extractor

**Files:**
- Create: `app/services/analysis/ts/edge-extractor.ts`
- Test: `__tests__/unit/edge-extractor.test.ts`

The edge extractor walks SCIP reference occurrences, uses tree-sitter AST context at each position to classify the edge kind, and populates `referencedAt`/`outboundRefs` on nodes inline.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/edge-extractor.test.ts
/**
 * @jest-environment node
 */
import { extractEdges, type EdgeExtractionInput } from '@/app/services/analysis/ts/edge-extractor';
import { SyntaxType, EdgeKind, type AnalysisNode } from '@/lib/analysis/types';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';

function parseTs(source: string): TreeWrapper {
  const lang = loadLanguage('typescript');
  const parser = createParser(lang, 'typescript');
  return parser.parse(source).tree;
}

function makeNode(overrides: Partial<AnalysisNode> & { name: string; scipSymbol: string }): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    filePath: 'src/test.ts',
    startLine: 0,
    startCol: 0,
    isAsync: false,
    isExported: false,
    params: [],
    returnTypeText: null,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
    ...overrides,
  };
}

function mockScipDoc(relativePath: string, occurrences: Array<{
  range: number[];
  symbol: string;
  symbolRoles: number;
}>) {
  return { relativePath, occurrences, symbols: [], text: '', language: 0, positionEncoding: 0 };
}

describe('extractEdges', () => {
  it('produces a CALLS edge for a function call', () => {
    // Source: function that calls another function
    const source = 'import { add } from "./utils";\nfunction main() {\n  add(1, 2);\n}';
    const tree = parseTs(source);

    const addNode = makeNode({ name: 'add', scipSymbol: 'sym:add', filePath: 'src/utils.ts' });
    const mainNode = makeNode({ name: 'main', scipSymbol: 'sym:main', filePath: 'src/index.ts' });
    const nodeMap = new Map([['sym:add', addNode], ['sym:main', mainNode]]);

    const scipDoc = mockScipDoc('src/index.ts', [
      // "add" reference at line 2, col 2 (inside call_expression)
      { range: [2, 2, 5], symbol: 'sym:add', symbolRoles: 8 }, // ReadAccess
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);

    const callEdge = edges.find(e => e.kind === EdgeKind.CALLS);
    expect(callEdge).toBeDefined();
    expect(callEdge!.toSymbol).toBe('sym:add');
    expect(callEdge!.toName).toBe('add');
  });

  it('produces an INSTANTIATES edge for new expression', () => {
    const source = 'const u = new User("alice");';
    const tree = parseTs(source);

    const userNode = makeNode({ name: 'User', scipSymbol: 'sym:User', syntaxType: SyntaxType.CLASS, filePath: 'src/models.ts' });
    const nodeMap = new Map([['sym:User', userNode]]);

    const scipDoc = mockScipDoc('src/index.ts', [
      // "User" reference at line 0, col 14 (inside new_expression)
      { range: [0, 14, 18], symbol: 'sym:User', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    const edge = edges.find(e => e.kind === EdgeKind.INSTANTIATES);
    expect(edge).toBeDefined();
    expect(edge!.toSymbol).toBe('sym:User');
  });

  it('produces a USES_TYPE edge for type annotations', () => {
    const source = 'function greet(name: string): User {\n  return {} as User;\n}';
    const tree = parseTs(source);

    const userNode = makeNode({ name: 'User', scipSymbol: 'sym:User', syntaxType: SyntaxType.CLASS, filePath: 'src/models.ts' });
    const nodeMap = new Map([['sym:User', userNode]]);

    // "User" in return type annotation at line 0, col 30
    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 30, 34], symbol: 'sym:User', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    const edge = edges.find(e => e.kind === EdgeKind.USES_TYPE);
    expect(edge).toBeDefined();
  });

  it('produces an IMPORTS edge for import declarations', () => {
    const source = 'import { add } from "./utils";';
    const tree = parseTs(source);

    const addNode = makeNode({ name: 'add', scipSymbol: 'sym:add', filePath: 'src/utils.ts' });
    const nodeMap = new Map([['sym:add', addNode]]);

    // "add" in import at line 0, col 9
    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 9, 12], symbol: 'sym:add', symbolRoles: 2 }, // Import role
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    const edge = edges.find(e => e.kind === EdgeKind.IMPORTS);
    expect(edge).toBeDefined();
  });

  it('marks external edges when target node not in nodeMap', () => {
    const source = 'console.log("hello");';
    const tree = parseTs(source);

    const nodeMap = new Map<string, AnalysisNode>();

    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 8, 11], symbol: 'sym:console.log', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    if (edges.length > 0) {
      expect(edges[0].isExternal).toBe(true);
    }
  });

  it('populates referencedAt on target node inline', () => {
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

    extractEdges(input);
    expect(addNode.referencedAt.length).toBeGreaterThan(0);
    expect(addNode.referencedAt[0].filePath).toBe('src/index.ts');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/edge-extractor.test.ts --no-cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the edge extractor**

```typescript
// app/services/analysis/ts/edge-extractor.ts
import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import {
  EdgeKind,
  type AnalysisEdge,
  type AnalysisNode,
} from '@/lib/analysis/types';

// ============================================================================
// Types
// ============================================================================

export interface EdgeExtractionInput {
  parsedFiles: Map<string, { tree: TreeWrapper; source: string }>;
  scipDocuments: Array<{
    relativePath: string;
    occurrences: Array<{
      range: number[];
      symbol: string;
      symbolRoles: number;
    }>;
  }>;
  nodeMap: Map<string, AnalysisNode>;
  repoPath: string;
}

// SCIP SymbolRole bitmasks
const SCIP_DEFINITION = 1;
const SCIP_IMPORT = 2;

// ============================================================================
// AST Context Classification
// ============================================================================

function classifyEdgeKind(
  tree: TreeWrapper,
  line: number,
  col: number,
  symbolRoles: number,
): EdgeKind {
  // Import role in SCIP means this is an import binding
  if ((symbolRoles & SCIP_IMPORT) !== 0) {
    return EdgeKind.IMPORTS;
  }

  // Walk up the tree-sitter AST from the reference position
  const tsNode = tree.rootNode.raw.descendantForPosition({ row: line, column: col });
  if (!tsNode) return EdgeKind.CALLS; // fallback

  let current = tsNode;
  while (current.parent) {
    const parentType = current.parent.type;

    if (parentType === 'new_expression') {
      return EdgeKind.INSTANTIATES;
    }

    if (parentType === 'call_expression') {
      // Check if our node is the function being called (not an argument)
      const funcChild = current.parent.childForFieldName('function');
      if (funcChild && isNodeOrAncestorOf(funcChild, current)) {
        return EdgeKind.CALLS;
      }
    }

    if (parentType === 'extends_clause') {
      return EdgeKind.EXTENDS;
    }

    if (parentType === 'implements_clause') {
      return EdgeKind.IMPLEMENTS;
    }

    // Type annotation contexts
    if (
      parentType === 'type_annotation' ||
      parentType === 'type_reference' ||
      parentType === 'generic_type' ||
      parentType === 'union_type' ||
      parentType === 'intersection_type' ||
      parentType === 'type_alias_declaration'
    ) {
      return EdgeKind.USES_TYPE;
    }

    // Import statement
    if (parentType === 'import_statement' || parentType === 'import_clause') {
      return EdgeKind.IMPORTS;
    }

    current = current.parent;
  }

  // Default: if we can't determine context, treat as CALLS
  return EdgeKind.CALLS;
}

function isNodeOrAncestorOf(
  ancestor: { id: number; startIndex: number; endIndex: number },
  descendant: { id: number; startIndex: number; endIndex: number },
): boolean {
  return descendant.startIndex >= ancestor.startIndex && descendant.endIndex <= ancestor.endIndex;
}

function isAsyncContext(tree: TreeWrapper, line: number, col: number): boolean {
  const tsNode = tree.rootNode.raw.descendantForPosition({ row: line, column: col });
  if (!tsNode) return false;

  let current = tsNode;
  while (current.parent) {
    if (current.parent.type === 'await_expression') return true;
    if (current.parent.type === 'call_expression') break;
    current = current.parent;
  }
  return false;
}

function isOptionalChainContext(tree: TreeWrapper, line: number, col: number): boolean {
  const tsNode = tree.rootNode.raw.descendantForPosition({ row: line, column: col });
  if (!tsNode) return false;

  let current = tsNode;
  while (current.parent) {
    if (current.parent.type === 'member_expression') {
      // Check for ?. operator: the child after the object is "?." in optional chaining
      const opChild = current.parent.childForFieldName('operator');
      if (opChild && opChild.text === '?.') return true;
    }
    // Also check optional_chain node type
    if (current.parent.type === 'call_expression') {
      const children = current.parent.children;
      for (const child of children) {
        if (child.type === '?.') return true;
      }
    }
    current = current.parent;
  }
  return false;
}

// ============================================================================
// Find Enclosing Node
// ============================================================================

function findEnclosingNode(
  tree: TreeWrapper,
  line: number,
  col: number,
  filePath: string,
  nodeMap: Map<string, AnalysisNode>,
): AnalysisNode | null {
  // Walk up from reference position to find a declaration that matches a known node
  const tsNode = tree.rootNode.raw.descendantForPosition({ row: line, column: col });
  if (!tsNode) return null;

  const declarationTypes = new Set([
    'function_declaration', 'method_definition', 'class_declaration',
    'interface_declaration', 'type_alias_declaration', 'arrow_function',
  ]);

  let current = tsNode;
  while (current.parent) {
    if (declarationTypes.has(current.parent.type)) {
      const nameChild = current.parent.childForFieldName('name');
      if (nameChild) {
        // Find matching node by position in same file
        for (const node of nodeMap.values()) {
          if (node.filePath === filePath && node.startLine === nameChild.startPosition.row && node.startCol === nameChild.startPosition.column) {
            return node;
          }
        }
      }
      // For arrow functions, check variable_declarator parent
      if (current.parent.type === 'arrow_function' && current.parent.parent?.type === 'variable_declarator') {
        const varName = current.parent.parent.childForFieldName('name');
        if (varName) {
          for (const node of nodeMap.values()) {
            if (node.filePath === filePath && node.startLine === varName.startPosition.row && node.startCol === varName.startPosition.column) {
              return node;
            }
          }
        }
      }
    }
    current = current.parent;
  }

  return null;
}

// ============================================================================
// Main Extraction
// ============================================================================

export function extractEdges(input: EdgeExtractionInput): AnalysisEdge[] {
  const edges: AnalysisEdge[] = [];
  const edgeDedup = new Set<string>();

  for (const scipDoc of input.scipDocuments) {
    const filePath = scipDoc.relativePath;
    const parsed = input.parsedFiles.get(filePath);
    if (!parsed) continue;

    const { tree } = parsed;

    for (const occ of scipDoc.occurrences) {
      // Skip definitions — we only care about references for edges
      if ((occ.symbolRoles & SCIP_DEFINITION) !== 0) continue;

      const line = occ.range[0];
      const col = occ.range[1];

      const kind = classifyEdgeKind(tree, line, col, occ.symbolRoles);
      const targetNode = input.nodeMap.get(occ.symbol);

      const isExternal = !targetNode;
      const toFile = targetNode?.filePath ?? null;
      const toName = targetNode?.name ?? occ.symbol.split('/').pop()?.replace(/[().#]/g, '') ?? '';

      // Find the enclosing (source) node
      const sourceNode = findEnclosingNode(tree, line, col, filePath, input.nodeMap);

      const fromName = sourceNode?.name ?? '';
      const fromSymbol = sourceNode?.scipSymbol ?? '';

      // Dedup by fromSymbol + toSymbol + kind
      const dedupeKey = `${fromSymbol}|${occ.symbol}|${kind}`;
      if (edgeDedup.has(dedupeKey)) continue;
      edgeDedup.add(dedupeKey);

      const edge: AnalysisEdge = {
        kind,
        fromFile: filePath,
        fromName,
        fromSymbol,
        toText: toName,
        toFile,
        toName,
        toSymbol: occ.symbol,
        isExternal,
        edgePosition: { line, col },
        isOptionalChain: isOptionalChainContext(tree, line, col),
        isAsync: isAsyncContext(tree, line, col),
      };

      edges.push(edge);

      // Populate referencedAt on target node inline
      if (targetNode) {
        targetNode.referencedAt.push({
          filePath,
          line,
          col,
          scipSymbol: fromSymbol,
        });
      }

      // Populate outboundRefs on source node inline
      if (sourceNode) {
        sourceNode.outboundRefs.push({
          filePath: toFile ?? '',
          line,
          col,
          scipSymbol: occ.symbol,
        });
      }
    }
  }

  return edges;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/edge-extractor.test.ts --no-cache`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/analysis/ts/edge-extractor.ts __tests__/unit/edge-extractor.test.ts
git commit -m "feat(analysis): add edge extractor

Walks SCIP reference occurrences, classifies edge kind using tree-sitter
AST context (CALLS, INSTANTIATES, USES_TYPE, IMPORTS, EXTENDS, IMPLEMENTS).
Populates referencedAt/outboundRefs on nodes inline.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Graph Assembler

**Files:**
- Create: `app/services/analysis/ts/graph-assembler.ts`
- Test: `__tests__/unit/graph-assembler.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/graph-assembler.test.ts
import { assembleResult } from '@/app/services/analysis/ts/graph-assembler';
import { SyntaxType, EdgeKind, MISSING_NODE_TYPES, MISSING_EDGE_KINDS, type AnalysisNode, type AnalysisEdge } from '@/lib/analysis/types';

describe('assembleResult', () => {
  it('computes metadata from nodes and edges', () => {
    const nodes: AnalysisNode[] = [
      {
        syntaxType: SyntaxType.FUNCTION,
        name: 'add',
        filePath: 'src/utils.ts',
        startLine: 0,
        startCol: 0,
        isAsync: false,
        isExported: true,
        params: [],
        returnTypeText: 'number',
        scipSymbol: 'sym:add',
        isDefinition: true,
        inTestFile: false,
        referencedAt: [],
        outboundRefs: [],
      },
    ];

    const edges: AnalysisEdge[] = [
      {
        kind: EdgeKind.CALLS,
        fromFile: 'src/index.ts',
        fromName: 'main',
        fromSymbol: 'sym:main',
        toText: 'add',
        toFile: 'src/utils.ts',
        toName: 'add',
        toSymbol: 'sym:add',
        isExternal: false,
        edgePosition: { line: 2, col: 2 },
        isOptionalChain: false,
        isAsync: false,
      },
    ];

    const result = assembleResult({
      nodes,
      edges,
      repoPath: '/my/repo',
      language: 'typescript',
      startTime: Date.now() - 100,
    });

    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
    expect(result.metadata.repoPath).toBe('/my/repo');
    expect(result.metadata.language).toBe('typescript');
    expect(result.metadata.nodeCount).toBe(1);
    expect(result.metadata.edgeCount).toBe(1);
    expect(result.metadata.analysisDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.missingNodeTypes).toEqual(MISSING_NODE_TYPES);
    expect(result.metadata.missingEdgeKinds).toEqual(MISSING_EDGE_KINDS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/graph-assembler.test.ts --no-cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement graph assembler**

```typescript
// app/services/analysis/ts/graph-assembler.ts
import {
  MISSING_NODE_TYPES,
  MISSING_EDGE_KINDS,
  type AnalysisNode,
  type AnalysisEdge,
  type AnalysisResult,
} from '@/lib/analysis/types';

export interface AssemblyInput {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  repoPath: string;
  language: string;
  startTime: number;
}

export function assembleResult(input: AssemblyInput): AnalysisResult {
  return {
    nodes: input.nodes,
    edges: input.edges,
    metadata: {
      repoPath: input.repoPath,
      language: input.language,
      nodeCount: input.nodes.length,
      edgeCount: input.edges.length,
      analysisDurationMs: Date.now() - input.startTime,
      missingNodeTypes: [...MISSING_NODE_TYPES],
      missingEdgeKinds: [...MISSING_EDGE_KINDS],
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/graph-assembler.test.ts --no-cache`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/analysis/ts/graph-assembler.ts __tests__/unit/graph-assembler.test.ts
git commit -m "feat(analysis): add graph assembler

Computes metadata (counts, duration, documented gaps) from extracted
nodes and edges. Final pipeline stage.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: TS Controller (Pipeline Orchestrator)

**Files:**
- Create: `app/services/analysis/ts/controller.ts`

This task wires up all pipeline stages. It is tested via the integration test in Task 10 rather than isolated unit tests, since it is purely orchestration with no logic of its own.

- [ ] **Step 1: Implement the TS controller**

```typescript
// app/services/analysis/ts/controller.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { indexTypeScriptRepo } from '@/lib/scip/ts/indexer';
import { readScipIndex } from '@/lib/scip/reader';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import type { AnalysisResult } from '@/lib/analysis/types';
import { isTestFile } from '@/app/services/analysis/test-file-detector';
import { extractNodes } from './node-extractor';
import { extractEdges } from './edge-extractor';
import { assembleResult } from './graph-assembler';

export interface TsAnalysisOptions {
  hideTestFiles: boolean;
}

export async function analyzeTsRepo(
  repoPath: string,
  options: TsAnalysisOptions,
): Promise<AnalysisResult> {
  const startTime = Date.now();

  // Stage 1: SCIP indexing
  const indexResult = await indexTypeScriptRepo(repoPath);
  const scipIndex = await readScipIndex(indexResult.indexPath);

  // Stage 2: Tree-sitter parsing
  const tsLang = loadLanguage('typescript');
  const tsxLang = loadLanguage('tsx');
  const tsParser = createParser(tsLang, 'typescript');
  const tsxParser = createParser(tsxLang, 'tsx');

  const parsedFiles = new Map<string, { tree: TreeWrapper; source: string }>();

  for (const doc of scipIndex.documents) {
    const filePath = doc.relativePath;

    if (options.hideTestFiles && isTestFile(filePath)) continue;

    const absolutePath = path.join(repoPath, filePath);
    let source: string;
    try {
      source = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      continue; // skip files that can't be read
    }

    const parser = filePath.endsWith('.tsx') ? tsxParser : tsParser;
    const result = parser.parse(source);
    parsedFiles.set(filePath, { tree: result.tree, source });
  }

  // Stage 3: Node extraction
  const { nodes, nodeMap } = extractNodes({
    parsedFiles,
    scipDocuments: scipIndex.documents,
    repoPath,
  });

  // Mark test file nodes
  if (!options.hideTestFiles) {
    for (const node of nodes) {
      node.inTestFile = isTestFile(node.filePath);
    }
  }

  // Stage 4: Edge extraction (populates referencedAt/outboundRefs inline)
  const edges = extractEdges({
    parsedFiles,
    scipDocuments: scipIndex.documents,
    nodeMap,
    repoPath,
  });

  // Stage 5: Assemble result
  return assembleResult({
    nodes,
    edges,
    repoPath,
    language: 'typescript',
    startTime,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/services/analysis/ts/controller.ts
git commit -m "feat(analysis): add TS controller pipeline orchestrator

Wires up the 5-stage pipeline: SCIP indexing → tree-sitter parsing →
node extraction → edge extraction → graph assembly.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: Top-Level Controller and API Route

**Files:**
- Create: `app/services/analysis/controller.ts`
- Create: `app/api/repo-analysis/route.ts`

- [ ] **Step 1: Implement the top-level controller**

```typescript
// app/services/analysis/controller.ts
import * as fs from 'fs/promises';
import type { AnalysisResult } from '@/lib/analysis/types';
import { AnalysisError, UnsupportedLanguageError } from '@/lib/analysis/types';
import { detectLanguage } from './language-detector';
import { analyzeTsRepo } from './ts/controller';

export interface AnalysisOptions {
  hideTestFiles?: boolean;
}

export async function analyzeRepo(
  repoPath: string,
  options?: AnalysisOptions,
): Promise<AnalysisResult> {
  const hideTestFiles = options?.hideTestFiles ?? true;

  // Validate repoPath exists
  try {
    await fs.access(repoPath);
  } catch {
    throw new AnalysisError(`Repository path does not exist: ${repoPath}`, repoPath);
  }

  // Detect language
  const language = await detectLanguage(repoPath);
  if (!language) {
    throw new UnsupportedLanguageError(repoPath);
  }

  // Delegate to language-specific controller
  switch (language) {
    case 'typescript':
      return analyzeTsRepo(repoPath, { hideTestFiles });
    default:
      throw new UnsupportedLanguageError(repoPath);
  }
}
```

- [ ] **Step 2: Implement the API route**

```typescript
// app/api/repo-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepo } from '@/app/services/analysis/controller';
import { AnalysisError, UnsupportedLanguageError } from '@/lib/analysis/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoPath, hideTestFiles } = body;

    if (!repoPath || typeof repoPath !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Repository path is required' },
        { status: 400 },
      );
    }

    const hideTestFilesOption: boolean = hideTestFiles !== undefined ? Boolean(hideTestFiles) : true;

    const data = await analyzeRepo(repoPath, { hideTestFiles: hideTestFilesOption });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof UnsupportedLanguageError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }

    if (error instanceof AnalysisError) {
      const status = error.message.includes('does not exist') ? 404 : 500;
      return NextResponse.json(
        { success: false, error: error.message },
        { status },
      );
    }

    console.error('Repo Analysis API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/services/analysis/controller.ts app/api/repo-analysis/route.ts
git commit -m "feat(analysis): add top-level controller and API route

Language-agnostic analyzeRepo() orchestrator with POST /api/repo-analysis
endpoint. Validates input, detects language, delegates to TS controller.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 10: Integration Test

**Files:**
- Create: `__tests__/integration/analysis-controller.integration.test.ts`

End-to-end test using the analysis fixture project. Runs SCIP indexing, tree-sitter parsing, and the full pipeline to verify real output.

- [ ] **Step 1: Write the integration test**

```typescript
// __tests__/integration/analysis-controller.integration.test.ts
/**
 * @jest-environment node
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import { analyzeRepo } from '@/app/services/analysis/controller';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';

const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/analysis-test-project');
const CACHE_DIR = path.join(FIXTURE_PATH, '.git-explorer');

describe('Analysis controller integration', () => {
  afterAll(async () => {
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
  });

  it('analyzes the fixture project and produces nodes and edges', async () => {
    const result = await analyzeRepo(FIXTURE_PATH, { hideTestFiles: true });

    // Metadata
    expect(result.metadata.language).toBe('typescript');
    expect(result.metadata.repoPath).toBe(FIXTURE_PATH);
    expect(result.metadata.nodeCount).toBeGreaterThan(0);
    expect(result.metadata.edgeCount).toBeGreaterThan(0);
    expect(result.metadata.analysisDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.missingNodeTypes.length).toBeGreaterThan(0);
    expect(result.metadata.missingEdgeKinds.length).toBeGreaterThan(0);

    // Nodes — verify we found key declarations
    const nodeNames = result.nodes.map(n => n.name);
    expect(nodeNames).toContain('add');
    expect(nodeNames).toContain('fetchData');
    expect(nodeNames).toContain('main');
    expect(nodeNames).toContain('User');
    expect(nodeNames).toContain('Serializable');

    // Verify syntax types
    const addNode = result.nodes.find(n => n.name === 'add');
    expect(addNode?.syntaxType).toBe(SyntaxType.FUNCTION);
    expect(addNode?.isExported).toBe(true);
    expect(addNode?.isAsync).toBe(false);

    const fetchNode = result.nodes.find(n => n.name === 'fetchData');
    expect(fetchNode?.isAsync).toBe(true);

    const userNode = result.nodes.find(n => n.name === 'User');
    expect(userNode?.syntaxType).toBe(SyntaxType.CLASS);

    const serNode = result.nodes.find(n => n.name === 'Serializable');
    expect(serNode?.syntaxType).toBe(SyntaxType.INTERFACE);

    // Edges — verify we found cross-file calls
    const callEdges = result.edges.filter(e => e.kind === EdgeKind.CALLS);
    expect(callEdges.length).toBeGreaterThan(0);

    // Verify at least one edge connects index.ts → utils.ts
    const crossFileCall = callEdges.find(
      e => e.fromFile?.includes('index') && e.toFile?.includes('utils'),
    );
    expect(crossFileCall).toBeDefined();

    // SCIP symbols should be populated
    const nodesWithSymbols = result.nodes.filter(n => n.scipSymbol !== '');
    expect(nodesWithSymbols.length).toBeGreaterThan(0);
  }, 60000);

  it('throws UnsupportedLanguageError for non-TS repos', async () => {
    const tmpDir = path.join(FIXTURE_PATH, '..', 'empty-repo-test');
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      await expect(analyzeRepo(tmpDir)).rejects.toThrow('No supported language detected');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx jest __tests__/integration/analysis-controller.integration.test.ts --no-cache`
Expected: All tests PASS. The fixture project has `tsconfig.json`, so SCIP indexes it, tree-sitter parses it, and the pipeline produces nodes and edges.

- [ ] **Step 3: Run the full test suite to verify nothing is broken**

Run: `npm test`
Expected: All existing tests continue to pass, plus all new tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/integration/analysis-controller.integration.test.ts
git commit -m "test(analysis): add integration test for analysis controller

End-to-end test against fixture project validating full pipeline: SCIP
indexing, tree-sitter parsing, node/edge extraction, and graph assembly.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
