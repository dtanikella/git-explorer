# Tree-Sitter Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a standalone tree-sitter library module (`lib/tree-sitter/`) that wraps `tree-sitter` native bindings with typed wrappers for Parser, Tree, Node, Query, and Language.

**Architecture:** Thin wrapper pattern around the `tree-sitter` npm package (native C bindings). Each wrapper delegates to the underlying tree-sitter API while providing our own error classes, TypeScript types, and consistent `NodeWrapper` abstraction. Follows the same module pattern as `lib/scip/`.

**Tech Stack:** `tree-sitter` (native Node bindings), `tree-sitter-typescript` (grammar), Jest for testing.

**Spec:** `docs/superpowers/specs/2026-04-28-tree-sitter-lib-design.md`

---

## File Structure

| Path | Responsibility |
|------|---------------|
| `lib/tree-sitter/types.ts` | Error classes, interfaces, re-exports from `tree-sitter` |
| `lib/tree-sitter/language.ts` | Language grammar loader with per-process caching |
| `lib/tree-sitter/node.ts` | `NodeWrapper` — navigation, state flags, position info |
| `lib/tree-sitter/tree.ts` | `TreeWrapper` — root node access, tree cursor |
| `lib/tree-sitter/parser.ts` | `ParserWrapper` — parse source code, timeout |
| `lib/tree-sitter/query.ts` | `QueryWrapper` — pattern matching, captures |
| `__tests__/fixtures/tree-sitter/valid.ts` | Clean TypeScript fixture file |
| `__tests__/fixtures/tree-sitter/with-errors.ts` | Intentionally malformed TypeScript |
| `__tests__/unit/tree-sitter-types.test.ts` | Error class and interface tests |
| `__tests__/unit/tree-sitter-language.test.ts` | Language loader tests |
| `__tests__/unit/tree-sitter-node.test.ts` | Node navigation and state flag tests |
| `__tests__/unit/tree-sitter-parser.test.ts` | Parser tests |
| `__tests__/unit/tree-sitter-query.test.ts` | Query pattern matching tests |
| `__tests__/integration/tree-sitter.integration.test.ts` | End-to-end pipeline test |
| `jest.config.js` | Add `tree-sitter` to `transformIgnorePatterns` (modify) |
| `package.json` | Add `tree-sitter` and `tree-sitter-typescript` deps (modify) |

---

### Task 1: Install dependencies and configure Jest

**Files:**
- Modify: `package.json` (add dependencies)
- Modify: `jest.config.js:18-19` (update transformIgnorePatterns)

- [ ] **Step 1: Install tree-sitter and tree-sitter-typescript**

```bash
cd /Users/dhananjaytanikella/Documents/Personal\ Projects/git-explorer
source ~/.nvm/nvm.sh && nvm use 20
npm install tree-sitter tree-sitter-typescript
```

Expected: packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify native module builds successfully**

```bash
node -e "const Parser = require('tree-sitter'); console.log('tree-sitter loaded:', typeof Parser);"
```

Expected: `tree-sitter loaded: function`

- [ ] **Step 3: Verify TypeScript grammar loads**

```bash
node -e "const TS = require('tree-sitter-typescript'); console.log('typescript grammar:', typeof TS.typescript); console.log('tsx grammar:', typeof TS.tsx);"
```

Expected: Both print an object type (the language grammar objects).

- [ ] **Step 4: Update jest.config.js transformIgnorePatterns**

`tree-sitter` is a native module with CommonJS exports. Update the ignore pattern to ensure Jest can process any ESM sub-dependencies. In `jest.config.js`, change line 19 from:

```javascript
    'node_modules/(?!(d3-|@c4312/|@bufbuild/))',
```

to:

```javascript
    'node_modules/(?!(d3-|@c4312/|@bufbuild/|tree-sitter))',
```

This matches both `tree-sitter` and `tree-sitter-typescript`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.config.js
git commit -m "chore: add tree-sitter and tree-sitter-typescript dependencies"
```

---

### Task 2: Create types and error classes

**Files:**
- Create: `lib/tree-sitter/types.ts`
- Create: `__tests__/unit/tree-sitter-types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/tree-sitter-types.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import {
  TreeSitterParseError,
  TreeSitterLanguageError,
  TreeSitterQueryError,
  ParseResult,
} from '@/lib/tree-sitter/types';

describe('tree-sitter types', () => {
  describe('TreeSitterParseError', () => {
    it('captures source snippet and language', () => {
      const err = new TreeSitterParseError('parse failed', 'const x =', 'typescript');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TreeSitterParseError);
      expect(err.name).toBe('TreeSitterParseError');
      expect(err.message).toBe('parse failed');
      expect(err.sourceSnippet).toBe('const x =');
      expect(err.language).toBe('typescript');
    });
  });

  describe('TreeSitterLanguageError', () => {
    it('captures language name and optional grammar path', () => {
      const err = new TreeSitterLanguageError('not found', 'rust', '/path/to/grammar');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TreeSitterLanguageError);
      expect(err.name).toBe('TreeSitterLanguageError');
      expect(err.message).toBe('not found');
      expect(err.languageName).toBe('rust');
      expect(err.grammarPath).toBe('/path/to/grammar');
    });

    it('works without grammar path', () => {
      const err = new TreeSitterLanguageError('not found', 'rust');
      expect(err.grammarPath).toBeUndefined();
    });
  });

  describe('TreeSitterQueryError', () => {
    it('captures pattern and language', () => {
      const err = new TreeSitterQueryError('invalid pattern', '(bad_query)', 'typescript');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TreeSitterQueryError);
      expect(err.name).toBe('TreeSitterQueryError');
      expect(err.message).toBe('invalid pattern');
      expect(err.pattern).toBe('(bad_query)');
      expect(err.language).toBe('typescript');
    });
  });

  describe('ParseResult', () => {
    it('has tree, hasErrors, and language fields', () => {
      // Type-level check — just verify the shape compiles
      const result = {
        tree: {} as any,
        hasErrors: false,
        language: 'typescript',
      } satisfies ParseResult;
      expect(result.hasErrors).toBe(false);
      expect(result.language).toBe('typescript');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/unit/tree-sitter-types.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '@/lib/tree-sitter/types'`

- [ ] **Step 3: Write the implementation**

Create `lib/tree-sitter/types.ts`:

```typescript
/**
 * Tree-sitter types, interfaces, and error classes for Git Explorer.
 * Re-exports core types from tree-sitter.
 */

// ============================================================================
// Error Classes
// ============================================================================

export class TreeSitterParseError extends Error {
  readonly name = 'TreeSitterParseError';

  constructor(
    message: string,
    readonly sourceSnippet: string,
    readonly language: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, TreeSitterParseError.prototype);
  }
}

export class TreeSitterLanguageError extends Error {
  readonly name = 'TreeSitterLanguageError';

  constructor(
    message: string,
    readonly languageName: string,
    readonly grammarPath?: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, TreeSitterLanguageError.prototype);
  }
}

export class TreeSitterQueryError extends Error {
  readonly name = 'TreeSitterQueryError';

  constructor(
    message: string,
    readonly pattern: string,
    readonly language: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, TreeSitterQueryError.prototype);
  }
}

// ============================================================================
// Interfaces
// ============================================================================

export interface ParseResult {
  tree: import('./tree').TreeWrapper;
  hasErrors: boolean;
  language: string;
}

// ============================================================================
// Re-exports from tree-sitter
// ============================================================================

export type { default as Parser } from 'tree-sitter';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/tree-sitter-types.test.ts --no-cache
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/tree-sitter/types.ts __tests__/unit/tree-sitter-types.test.ts
git commit -m "feat(tree-sitter): add types and error classes"
```

---

### Task 3: Create language loader

**Files:**
- Create: `lib/tree-sitter/language.ts`
- Create: `__tests__/unit/tree-sitter-language.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/tree-sitter-language.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { loadLanguage, clearLanguageCache } from '@/lib/tree-sitter/language';
import { TreeSitterLanguageError } from '@/lib/tree-sitter/types';

describe('tree-sitter language loader', () => {
  afterEach(() => {
    clearLanguageCache();
  });

  it('loads the typescript grammar', () => {
    const lang = loadLanguage('typescript');
    expect(lang).toBeDefined();
    expect(typeof lang).toBe('object');
  });

  it('loads the tsx grammar', () => {
    const lang = loadLanguage('tsx');
    expect(lang).toBeDefined();
  });

  it('returns the same instance on repeated loads (caching)', () => {
    const lang1 = loadLanguage('typescript');
    const lang2 = loadLanguage('typescript');
    expect(lang1).toBe(lang2);
  });

  it('throws TreeSitterLanguageError for unknown language', () => {
    expect(() => loadLanguage('unknown-lang-xyz')).toThrow(TreeSitterLanguageError);
  });

  it('error includes the language name', () => {
    try {
      loadLanguage('brainfuck');
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TreeSitterLanguageError);
      expect((err as TreeSitterLanguageError).languageName).toBe('brainfuck');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/unit/tree-sitter-language.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '@/lib/tree-sitter/language'`

- [ ] **Step 3: Write the implementation**

Create `lib/tree-sitter/language.ts`:

```typescript
import { TreeSitterLanguageError } from './types';

type Language = ReturnType<typeof require> ;

interface LanguageMapping {
  module: string;
  export?: string;
}

const LANGUAGE_REGISTRY: Record<string, LanguageMapping> = {
  typescript: { module: 'tree-sitter-typescript', export: 'typescript' },
  tsx: { module: 'tree-sitter-typescript', export: 'tsx' },
};

const languageCache = new Map<string, Language>();

export function loadLanguage(name: string): Language {
  const cached = languageCache.get(name);
  if (cached) {
    return cached;
  }

  const mapping = LANGUAGE_REGISTRY[name];
  if (!mapping) {
    throw new TreeSitterLanguageError(
      `Unknown language: "${name}". Available: ${Object.keys(LANGUAGE_REGISTRY).join(', ')}`,
      name,
    );
  }

  let grammar: Language;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(mapping.module);
    grammar = mapping.export ? mod[mapping.export] : mod;
  } catch (err) {
    throw new TreeSitterLanguageError(
      `Failed to load grammar for "${name}": ${(err as Error).message}`,
      name,
      mapping.module,
    );
  }

  if (!grammar) {
    throw new TreeSitterLanguageError(
      `Grammar module "${mapping.module}" has no export "${mapping.export}"`,
      name,
      mapping.module,
    );
  }

  languageCache.set(name, grammar);
  return grammar;
}

export function clearLanguageCache(): void {
  languageCache.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/tree-sitter-language.test.ts --no-cache
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/tree-sitter/language.ts __tests__/unit/tree-sitter-language.test.ts
git commit -m "feat(tree-sitter): add language grammar loader with caching"
```

---

### Task 4: Create NodeWrapper

**Files:**
- Create: `lib/tree-sitter/node.ts`
- Create: `__tests__/fixtures/tree-sitter/valid.ts`
- Create: `__tests__/fixtures/tree-sitter/with-errors.ts`
- Create: `__tests__/unit/tree-sitter-node.test.ts`

- [ ] **Step 1: Create fixture files**

Create `__tests__/fixtures/tree-sitter/valid.ts`:

```typescript
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return `Hello, ${user.name}!`;
}

class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}

export { greet, Calculator };
```

Create `__tests__/fixtures/tree-sitter/with-errors.ts`:

```typescript
function broken( {
  return 42
}

const x: number = 
```

This file is intentionally malformed — missing closing paren, missing value after `=`.

- [ ] **Step 2: Write the failing test**

Create `__tests__/unit/tree-sitter-node.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import TreeSitterParser from 'tree-sitter';
import * as TypeScriptGrammar from 'tree-sitter-typescript';
import { NodeWrapper } from '@/lib/tree-sitter/node';

function parseSource(source: string): NodeWrapper {
  const parser = new TreeSitterParser();
  parser.setLanguage(TypeScriptGrammar.typescript);
  const tree = parser.parse(source);
  return new NodeWrapper(tree.rootNode);
}

describe('NodeWrapper', () => {
  describe('identity and position', () => {
    it('exposes type and text', () => {
      const root = parseSource('const x = 1;');
      expect(root.type).toBe('program');
      expect(root.text).toContain('const x = 1');
    });

    it('exposes start/end position', () => {
      const root = parseSource('const x = 1;');
      expect(root.startPosition).toEqual({ row: 0, column: 0 });
      expect(root.startIndex).toBe(0);
      expect(root.endIndex).toBeGreaterThan(0);
    });

    it('exposes isNamed', () => {
      const root = parseSource('const x = 1;');
      expect(root.isNamed).toBe(true);
    });
  });

  describe('state flags', () => {
    it('reports no errors on valid source', () => {
      const root = parseSource('const x: number = 42;');
      expect(root.isError).toBe(false);
      expect(root.hasError).toBe(false);
      expect(root.isMissing).toBe(false);
    });

    it('reports hasError on source with syntax errors', () => {
      const root = parseSource('function broken( { return 42 }');
      expect(root.hasError).toBe(true);
    });

    it('finds ERROR nodes in the tree', () => {
      const root = parseSource('function broken( { return 42 }');
      const allNodes: NodeWrapper[] = [];
      function walk(node: NodeWrapper) {
        allNodes.push(node);
        for (const child of node.children) {
          walk(child);
        }
      }
      walk(root);
      const errorNodes = allNodes.filter(n => n.isError || n.isMissing);
      expect(errorNodes.length).toBeGreaterThan(0);
    });
  });

  describe('tree navigation', () => {
    const source = `
function add(a: number, b: number): number {
  return a + b;
}
`;

    it('navigates parent/children', () => {
      const root = parseSource(source);
      expect(root.children.length).toBeGreaterThan(0);
      expect(root.parent).toBeNull();

      const firstChild = root.children[0];
      expect(firstChild.parent).not.toBeNull();
      expect(firstChild.parent!.type).toBe('program');
    });

    it('navigates namedChildren', () => {
      const root = parseSource(source);
      const namedKids = root.namedChildren;
      expect(namedKids.length).toBeGreaterThan(0);
      expect(namedKids[0].isNamed).toBe(true);
    });

    it('navigates firstChild / lastChild', () => {
      const root = parseSource(source);
      expect(root.firstChild).not.toBeNull();
      expect(root.lastChild).not.toBeNull();
    });

    it('navigates firstNamedChild / lastNamedChild', () => {
      const root = parseSource(source);
      expect(root.firstNamedChild).not.toBeNull();
    });

    it('navigates siblings', () => {
      const root = parseSource('const a = 1;\nconst b = 2;');
      const first = root.namedChildren[0];
      const second = root.namedChildren[1];
      expect(first.nextNamedSibling).not.toBeNull();
      expect(first.nextNamedSibling!.type).toBe(second.type);
      expect(second.previousNamedSibling).not.toBeNull();
    });

    it('navigates by field name', () => {
      const root = parseSource(source);
      const funcNode = root.namedChildren[0];
      const nameNode = funcNode.childForFieldName('name');
      expect(nameNode).not.toBeNull();
      expect(nameNode!.text).toBe('add');
    });

    it('exposes childCount and namedChildCount', () => {
      const root = parseSource(source);
      expect(root.childCount).toBeGreaterThan(0);
      expect(root.namedChildCount).toBeGreaterThan(0);
      expect(root.namedChildCount).toBeLessThanOrEqual(root.childCount);
    });
  });

  describe('search', () => {
    it('finds descendants of a specific type', () => {
      const root = parseSource(`
        function foo() { return 1; }
        function bar() { return 2; }
      `);
      const funcs = root.descendantsOfType('function_declaration');
      expect(funcs.length).toBe(2);
      expect(funcs[0].type).toBe('function_declaration');
    });

    it('accepts an array of types', () => {
      const root = parseSource(`
        function foo() { return 1; }
        const x = 42;
      `);
      const nodes = root.descendantsOfType(['function_declaration', 'lexical_declaration']);
      expect(nodes.length).toBe(2);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest __tests__/unit/tree-sitter-node.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '@/lib/tree-sitter/node'`

- [ ] **Step 4: Write the implementation**

Create `lib/tree-sitter/node.ts`:

```typescript
import type TreeSitterParser from 'tree-sitter';

type SyntaxNode = TreeSitterParser.SyntaxNode;
type Point = { row: number; column: number };

export class NodeWrapper {
  constructor(private readonly _node: SyntaxNode) {}

  // Identity
  get type(): string { return this._node.type; }
  get text(): string { return this._node.text; }
  get isNamed(): boolean { return this._node.isNamed; }

  // Position
  get startPosition(): Point { return this._node.startPosition; }
  get endPosition(): Point { return this._node.endPosition; }
  get startIndex(): number { return this._node.startIndex; }
  get endIndex(): number { return this._node.endIndex; }

  // State flags
  get isError(): boolean { return this._node.type === 'ERROR'; }
  get hasError(): boolean { return this._node.hasError; }
  get isMissing(): boolean { return this._node.isMissing; }

  // Navigation — tree structure
  get parent(): NodeWrapper | null {
    return this._node.parent ? new NodeWrapper(this._node.parent) : null;
  }

  get children(): NodeWrapper[] {
    return this._node.children.map(c => new NodeWrapper(c));
  }

  get namedChildren(): NodeWrapper[] {
    return this._node.namedChildren.map(c => new NodeWrapper(c));
  }

  get firstChild(): NodeWrapper | null {
    return this._node.firstChild ? new NodeWrapper(this._node.firstChild) : null;
  }

  get lastChild(): NodeWrapper | null {
    return this._node.lastChild ? new NodeWrapper(this._node.lastChild) : null;
  }

  get firstNamedChild(): NodeWrapper | null {
    return this._node.firstNamedChild ? new NodeWrapper(this._node.firstNamedChild) : null;
  }

  get lastNamedChild(): NodeWrapper | null {
    return this._node.lastNamedChild ? new NodeWrapper(this._node.lastNamedChild) : null;
  }

  get childCount(): number { return this._node.childCount; }
  get namedChildCount(): number { return this._node.namedChildCount; }

  // Navigation — siblings
  get nextSibling(): NodeWrapper | null {
    return this._node.nextSibling ? new NodeWrapper(this._node.nextSibling) : null;
  }

  get previousSibling(): NodeWrapper | null {
    return this._node.previousSibling ? new NodeWrapper(this._node.previousSibling) : null;
  }

  get nextNamedSibling(): NodeWrapper | null {
    return this._node.nextNamedSibling ? new NodeWrapper(this._node.nextNamedSibling) : null;
  }

  get previousNamedSibling(): NodeWrapper | null {
    return this._node.previousNamedSibling ? new NodeWrapper(this._node.previousNamedSibling) : null;
  }

  // Navigation — field-based
  childForFieldName(fieldName: string): NodeWrapper | null {
    const child = this._node.childForFieldName(fieldName);
    return child ? new NodeWrapper(child) : null;
  }

  // Search
  descendantsOfType(type: string | string[]): NodeWrapper[] {
    const types = Array.isArray(type) ? type : [type];
    const results: NodeWrapper[] = [];
    const walk = (node: SyntaxNode) => {
      if (types.includes(node.type)) {
        results.push(new NodeWrapper(node));
      }
      for (const child of node.children) {
        walk(child);
      }
    };
    walk(this._node);
    return results;
  }

  /** Access the underlying tree-sitter SyntaxNode for advanced use. */
  get raw(): SyntaxNode { return this._node; }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/unit/tree-sitter-node.test.ts --no-cache
```

Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add lib/tree-sitter/node.ts __tests__/unit/tree-sitter-node.test.ts __tests__/fixtures/tree-sitter/
git commit -m "feat(tree-sitter): add NodeWrapper with navigation and state flags"
```

---

### Task 5: Create TreeWrapper

**Files:**
- Create: `lib/tree-sitter/tree.ts`

- [ ] **Step 1: Write the implementation**

The `TreeWrapper` is simple and will be tested indirectly through the parser tests (Task 6) and integration test (Task 8). No separate unit test file needed — it's a thin delegation layer.

Create `lib/tree-sitter/tree.ts`:

```typescript
import type TreeSitterParser from 'tree-sitter';
import { NodeWrapper } from './node';

type Tree = TreeSitterParser.Tree;
type TreeCursor = TreeSitterParser.TreeCursor;

export class TreeWrapper {
  readonly rootNode: NodeWrapper;

  constructor(
    private readonly _tree: Tree,
    readonly language: string,
  ) {
    this.rootNode = new NodeWrapper(_tree.rootNode);
  }

  walk(): TreeCursor {
    return this._tree.walk();
  }

  /** Access the underlying tree-sitter Tree for advanced use. */
  get raw(): Tree { return this._tree; }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/tree-sitter/tree.ts
git commit -m "feat(tree-sitter): add TreeWrapper with root node and cursor access"
```

---

### Task 6: Create ParserWrapper

**Files:**
- Create: `lib/tree-sitter/parser.ts`
- Create: `__tests__/unit/tree-sitter-parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/tree-sitter-parser.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { createParser, ParserWrapper } from '@/lib/tree-sitter/parser';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { TreeWrapper } from '@/lib/tree-sitter/tree';
import { NodeWrapper } from '@/lib/tree-sitter/node';

describe('ParserWrapper', () => {
  let parser: ParserWrapper;

  beforeAll(() => {
    const lang = loadLanguage('typescript');
    parser = createParser(lang, 'typescript');
  });

  describe('parse', () => {
    it('parses valid TypeScript and returns a ParseResult', () => {
      const result = parser.parse('const x: number = 42;');
      expect(result.tree).toBeInstanceOf(TreeWrapper);
      expect(result.hasErrors).toBe(false);
      expect(result.language).toBe('typescript');
    });

    it('returns hasErrors=true for invalid source', () => {
      const result = parser.parse('function broken( { return; }');
      expect(result.hasErrors).toBe(true);
      expect(result.tree).toBeInstanceOf(TreeWrapper);
    });

    it('tree rootNode is a NodeWrapper', () => {
      const result = parser.parse('const x = 1;');
      expect(result.tree.rootNode).toBeInstanceOf(NodeWrapper);
      expect(result.tree.rootNode.type).toBe('program');
    });

    it('parses empty string without error', () => {
      const result = parser.parse('');
      expect(result.tree).toBeInstanceOf(TreeWrapper);
      expect(result.hasErrors).toBe(false);
    });

    it('parses multiline source', () => {
      const source = `
        interface Foo { bar: string; }
        function test(): Foo { return { bar: 'hello' }; }
      `;
      const result = parser.parse(source);
      expect(result.hasErrors).toBe(false);
      const funcs = result.tree.rootNode.descendantsOfType('function_declaration');
      expect(funcs.length).toBe(1);
    });
  });

  describe('getLanguage', () => {
    it('returns the language object', () => {
      const lang = parser.getLanguage();
      expect(lang).toBeDefined();
    });
  });

  describe('setTimeoutMicros', () => {
    it('accepts a timeout value without throwing', () => {
      expect(() => parser.setTimeoutMicros(100000)).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/unit/tree-sitter-parser.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '@/lib/tree-sitter/parser'`

- [ ] **Step 3: Write the implementation**

Create `lib/tree-sitter/parser.ts`:

```typescript
import TreeSitterParser from 'tree-sitter';
import { TreeSitterParseError, ParseResult } from './types';
import { TreeWrapper } from './tree';

type Language = InstanceType<typeof TreeSitterParser>['getLanguage'] extends () => infer R ? R : never;

export class ParserWrapper {
  private readonly _parser: TreeSitterParser;
  private readonly _languageName: string;

  constructor(language: Language, languageName: string) {
    this._parser = new TreeSitterParser();
    this._parser.setLanguage(language);
    this._languageName = languageName;
  }

  parse(source: string): ParseResult {
    const tree = this._parser.parse(source);
    if (!tree) {
      const snippet = source.length > 100 ? source.slice(0, 100) + '...' : source;
      throw new TreeSitterParseError(
        'Parsing returned null (timeout or catastrophic failure)',
        snippet,
        this._languageName,
      );
    }

    const wrapper = new TreeWrapper(tree, this._languageName);
    return {
      tree: wrapper,
      hasErrors: tree.rootNode.hasError,
      language: this._languageName,
    };
  }

  setTimeoutMicros(timeout: number): void {
    this._parser.setTimeoutMicros(timeout);
  }

  getLanguage(): Language {
    return this._parser.getLanguage();
  }
}

export function createParser(language: Language, languageName: string): ParserWrapper {
  return new ParserWrapper(language, languageName);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/tree-sitter-parser.test.ts --no-cache
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/tree-sitter/parser.ts __tests__/unit/tree-sitter-parser.test.ts
git commit -m "feat(tree-sitter): add ParserWrapper with parse and timeout support"
```

---

### Task 7: Create QueryWrapper

**Files:**
- Create: `lib/tree-sitter/query.ts`
- Create: `__tests__/unit/tree-sitter-query.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/tree-sitter-query.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { createQuery, QueryWrapper } from '@/lib/tree-sitter/query';
import { createParser } from '@/lib/tree-sitter/parser';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { TreeSitterQueryError } from '@/lib/tree-sitter/types';
import { NodeWrapper } from '@/lib/tree-sitter/node';

describe('QueryWrapper', () => {
  const lang = loadLanguage('typescript');
  const parser = createParser(lang, 'typescript');

  describe('createQuery', () => {
    it('creates a query from a valid pattern', () => {
      const query = createQuery(lang, '(function_declaration name: (identifier) @func.name)');
      expect(query).toBeInstanceOf(QueryWrapper);
    });

    it('throws TreeSitterQueryError for invalid pattern', () => {
      expect(() => createQuery(lang, '(((invalid_unclosed')).toThrow(TreeSitterQueryError);
    });

    it('error includes the pattern and language', () => {
      try {
        createQuery(lang, '(((bad_pattern');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TreeSitterQueryError);
        expect((err as TreeSitterQueryError).pattern).toBe('(((bad_pattern');
        expect((err as TreeSitterQueryError).language).toBe('typescript');
      }
    });
  });

  describe('matches', () => {
    it('returns matches for function declarations', () => {
      const result = parser.parse(`
        function foo() { return 1; }
        function bar() { return 2; }
      `);
      const query = createQuery(lang, '(function_declaration name: (identifier) @func.name)');
      const matches = query.matches(result.tree.rootNode);
      expect(matches.length).toBe(2);
      expect(matches[0].captures.length).toBeGreaterThan(0);
      expect(matches[0].captures[0].name).toBe('func.name');
    });

    it('captures are NodeWrapper instances', () => {
      const result = parser.parse('function test() {}');
      const query = createQuery(lang, '(function_declaration name: (identifier) @name)');
      const matches = query.matches(result.tree.rootNode);
      expect(matches[0].captures[0].node).toBeInstanceOf(NodeWrapper);
      expect(matches[0].captures[0].node.text).toBe('test');
    });

    it('returns empty array when no matches', () => {
      const result = parser.parse('const x = 1;');
      const query = createQuery(lang, '(class_declaration name: (type_identifier) @class.name)');
      const matches = query.matches(result.tree.rootNode);
      expect(matches).toEqual([]);
    });
  });

  describe('captures', () => {
    it('returns a flat list of all captures', () => {
      const result = parser.parse(`
        function foo() {}
        function bar() {}
      `);
      const query = createQuery(lang, '(function_declaration name: (identifier) @func.name)');
      const captures = query.captures(result.tree.rootNode);
      expect(captures.length).toBe(2);
      expect(captures[0].name).toBe('func.name');
      expect(captures[0].node).toBeInstanceOf(NodeWrapper);

      const names = captures.map(c => c.node.text);
      expect(names).toContain('foo');
      expect(names).toContain('bar');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/unit/tree-sitter-query.test.ts --no-cache
```

Expected: FAIL — `Cannot find module '@/lib/tree-sitter/query'`

- [ ] **Step 3: Write the implementation**

Create `lib/tree-sitter/query.ts`:

```typescript
import TreeSitterParser from 'tree-sitter';
import { TreeSitterQueryError } from './types';
import { NodeWrapper } from './node';

type Language = ReturnType<InstanceType<typeof TreeSitterParser>['getLanguage']>;

export interface QueryMatch {
  pattern: number;
  captures: QueryCapture[];
}

export interface QueryCapture {
  name: string;
  node: NodeWrapper;
}

export class QueryWrapper {
  private readonly _query: TreeSitterParser.Query;
  private readonly _languageName: string;

  constructor(query: TreeSitterParser.Query, languageName: string) {
    this._query = query;
    this._languageName = languageName;
  }

  matches(node: NodeWrapper): QueryMatch[] {
    const rawMatches = this._query.matches(node.raw);
    return rawMatches.map(m => ({
      pattern: m.pattern,
      captures: m.captures.map(c => ({
        name: c.name,
        node: new NodeWrapper(c.node),
      })),
    }));
  }

  captures(node: NodeWrapper): QueryCapture[] {
    const rawCaptures = this._query.captures(node.raw);
    return rawCaptures.map(c => ({
      name: c.name,
      node: new NodeWrapper(c.node),
    }));
  }
}

export function createQuery(language: Language, pattern: string, languageName = 'typescript'): QueryWrapper {
  let query: TreeSitterParser.Query;
  try {
    query = new TreeSitterParser.Query(language, pattern);
  } catch (err) {
    throw new TreeSitterQueryError(
      `Invalid query pattern: ${(err as Error).message}`,
      pattern,
      languageName,
    );
  }
  return new QueryWrapper(query, languageName);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/unit/tree-sitter-query.test.ts --no-cache
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/tree-sitter/query.ts __tests__/unit/tree-sitter-query.test.ts
git commit -m "feat(tree-sitter): add QueryWrapper with pattern matching and captures"
```

---

### Task 8: Integration test

**Files:**
- Create: `__tests__/integration/tree-sitter.integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `__tests__/integration/tree-sitter.integration.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadLanguage, clearLanguageCache } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import { createQuery } from '@/lib/tree-sitter/query';
import { TreeWrapper } from '@/lib/tree-sitter/tree';
import { NodeWrapper } from '@/lib/tree-sitter/node';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/tree-sitter');

describe('tree-sitter integration', () => {
  afterAll(() => {
    clearLanguageCache();
  });

  it('end-to-end: load language → parse file → navigate tree → run query', () => {
    // 1. Load language
    const lang = loadLanguage('typescript');
    expect(lang).toBeDefined();

    // 2. Create parser
    const parser = createParser(lang, 'typescript');

    // 3. Parse fixture file
    const source = fs.readFileSync(path.join(FIXTURE_DIR, 'valid.ts'), 'utf-8');
    const result = parser.parse(source);

    expect(result.tree).toBeInstanceOf(TreeWrapper);
    expect(result.hasErrors).toBe(false);
    expect(result.language).toBe('typescript');

    // 4. Navigate tree
    const root = result.tree.rootNode;
    expect(root).toBeInstanceOf(NodeWrapper);
    expect(root.type).toBe('program');
    expect(root.childCount).toBeGreaterThan(0);

    // Find the function declaration
    const funcs = root.descendantsOfType('function_declaration');
    expect(funcs.length).toBeGreaterThan(0);

    const greetFunc = funcs.find(f => {
      const nameNode = f.childForFieldName('name');
      return nameNode?.text === 'greet';
    });
    expect(greetFunc).toBeDefined();
    expect(greetFunc!.hasError).toBe(false);

    // Find the class declaration
    const classes = root.descendantsOfType('class_declaration');
    expect(classes.length).toBe(1);
    const calcClass = classes[0];
    const className = calcClass.childForFieldName('name');
    expect(className).not.toBeNull();
    expect(className!.text).toBe('Calculator');

    // 5. Run query — find all function/method names
    const query = createQuery(
      lang,
      '(function_declaration name: (identifier) @func.name)',
    );
    const captures = query.captures(root);
    const funcNames = captures.map(c => c.node.text);
    expect(funcNames).toContain('greet');

    // 6. Verify error detection on broken file
    const brokenSource = fs.readFileSync(path.join(FIXTURE_DIR, 'with-errors.ts'), 'utf-8');
    const brokenResult = parser.parse(brokenSource);
    expect(brokenResult.hasErrors).toBe(true);

    // Walk to find error/missing nodes
    const allNodes: NodeWrapper[] = [];
    function walk(node: NodeWrapper) {
      allNodes.push(node);
      for (const child of node.children) {
        walk(child);
      }
    }
    walk(brokenResult.tree.rootNode);
    const errorNodes = allNodes.filter(n => n.isError || n.isMissing);
    expect(errorNodes.length).toBeGreaterThan(0);
  });

  it('tree cursor traversal works', () => {
    const lang = loadLanguage('typescript');
    const parser = createParser(lang, 'typescript');
    const result = parser.parse('const x = 1;');

    const cursor = result.tree.walk();
    expect(cursor.nodeType).toBe('program');
    expect(cursor.gotoFirstChild()).toBe(true);
    expect(cursor.nodeType).toBeDefined();
  });

  it('tsx grammar parses JSX', () => {
    const lang = loadLanguage('tsx');
    const parser = createParser(lang, 'tsx');
    const result = parser.parse('const App = () => <div>Hello</div>;');

    expect(result.hasErrors).toBe(false);
    const jsxElements = result.tree.rootNode.descendantsOfType('jsx_element');
    expect(jsxElements.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
npx jest __tests__/integration/tree-sitter.integration.test.ts --no-cache
```

Expected: PASS — all 3 tests green.

- [ ] **Step 3: Run the full test suite to verify nothing is broken**

```bash
npm test
```

Expected: All existing tests still pass. New tree-sitter tests all pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/integration/tree-sitter.integration.test.ts
git commit -m "test(tree-sitter): add end-to-end integration test"
```

---

### Task 9: Run full validation

- [ ] **Step 1: Run linter**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass including the new tree-sitter tests.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds. (Note: tree-sitter native modules may not be bundled for browser — this is expected since we're Node-only. Build warnings about native modules are acceptable.)
