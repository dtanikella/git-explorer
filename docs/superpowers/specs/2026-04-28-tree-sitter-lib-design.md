# Tree-Sitter Library Design Spec

**Date:** 2026-04-28
**Issue:** [#17 — Introduce tree-sitter lib](https://github.com/dtanikella/git-explorer/issues/17)
**Status:** Draft

## Problem

Git Explorer needs a tree-sitter integration to complement the existing SCIP library and eventually improve upon the TypeScript Compiler API flow. The goal is to introduce a standalone, language-agnostic tree-sitter library module — no downstream consumers yet, just the foundation.

## Approach

**Thin Wrapper** around `node-tree-sitter` (native C bindings, Node-only). Follows the same module pattern as `lib/scip/`: dedicated types/error classes, wrapper modules, and fixture-based tests.

TypeScript is the first grammar loaded, but the API is language-agnostic — any tree-sitter grammar can be plugged in.

## Acceptance Criteria (from issue)

- Parser, Tree, Node, Query, Language capabilities
- Tree/node navigation
- Node state flags: `isError`, `hasError`

## Module Structure

```
lib/tree-sitter/
├── types.ts        # Error classes, interfaces, re-exports
├── language.ts     # Language grammar loader with caching
├── parser.ts       # Parser wrapper — init, parse source
├── tree.ts         # Tree wrapper — root access, cursor
├── node.ts         # Node wrapper — navigation, state flags
└── query.ts        # Query wrapper — pattern matching, captures
```

**Dependencies:**
- `tree-sitter` — native Node.js bindings
- `tree-sitter-typescript` — TypeScript/TSX grammar (first language)

## Detailed Design

### 1. Types & Error Classes (`types.ts`)

Three error classes following the SCIP pattern (`Object.setPrototypeOf` for proper instanceof checks):

```typescript
export class TreeSitterParseError extends Error {
  readonly name = 'TreeSitterParseError';
  constructor(
    message: string,
    readonly sourceSnippet: string,
    readonly language: string,
  ) { ... }
}

export class TreeSitterLanguageError extends Error {
  readonly name = 'TreeSitterLanguageError';
  constructor(
    message: string,
    readonly languageName: string,
    readonly grammarPath?: string,
  ) { ... }
}

export class TreeSitterQueryError extends Error {
  readonly name = 'TreeSitterQueryError';
  constructor(
    message: string,
    readonly pattern: string,
    readonly language: string,
  ) { ... }
}
```

Interfaces:

```typescript
export interface ParseResult {
  tree: TreeWrapper;
  hasErrors: boolean;
  language: string;
}
```

Re-exports from `tree-sitter`:

```typescript
export type { SyntaxNode, Tree, Language, Query } from 'tree-sitter';
```

### 2. Language Loader (`language.ts`)

Loads tree-sitter grammar bindings and caches them by name.

```typescript
const languageCache = new Map<string, Language>();

export function loadLanguage(name: string): Language
```

- Resolves the grammar module dynamically (e.g., `require('tree-sitter-typescript').typescript`)
- Caches loaded languages so they're loaded once per process
- Throws `TreeSitterLanguageError` if the grammar module can't be found or loaded

Supported language mapping (extensible):

| name | module | export |
|------|--------|--------|
| `typescript` | `tree-sitter-typescript` | `.typescript` |
| `tsx` | `tree-sitter-typescript` | `.tsx` |

### 3. Parser Wrapper (`parser.ts`)

```typescript
export function createParser(language: Language): ParserWrapper

export class ParserWrapper {
  parse(source: string): ParseResult
  setTimeoutMicros(timeout: number): void
  getLanguage(): Language
}
```

- Creates a `tree-sitter` `Parser` instance, sets the language
- `parse()` returns a `ParseResult` with a `TreeWrapper` and `hasErrors` flag
- Throws `TreeSitterParseError` if parsing returns null (timeout or catastrophic failure)
- Timeout is optional; set via `setTimeoutMicros()`

### 4. Tree Wrapper (`tree.ts`)

```typescript
export class TreeWrapper {
  readonly rootNode: NodeWrapper
  readonly language: string

  walk(): TreeCursor
}
```

- Wraps `tree-sitter`'s `Tree` object
- `rootNode` is a `NodeWrapper` around the tree's root `SyntaxNode`
- `walk()` returns the underlying `TreeCursor` for manual traversal
- Delegates to the underlying tree for cursor creation

### 5. Node Wrapper (`node.ts`)

The core navigation and inspection API.

```typescript
export class NodeWrapper {
  // Identity
  readonly type: string
  readonly text: string
  readonly isNamed: boolean

  // Position
  readonly startPosition: Point
  readonly endPosition: Point
  readonly startIndex: number
  readonly endIndex: number

  // State flags (acceptance criteria)
  readonly isError: boolean
  readonly hasError: boolean
  readonly isMissing: boolean

  // Navigation — tree structure
  readonly parent: NodeWrapper | null
  readonly children: NodeWrapper[]
  readonly namedChildren: NodeWrapper[]
  readonly firstChild: NodeWrapper | null
  readonly lastChild: NodeWrapper | null
  readonly firstNamedChild: NodeWrapper | null
  readonly lastNamedChild: NodeWrapper | null
  readonly childCount: number
  readonly namedChildCount: number

  // Navigation — siblings
  readonly nextSibling: NodeWrapper | null
  readonly previousSibling: NodeWrapper | null
  readonly nextNamedSibling: NodeWrapper | null
  readonly previousNamedSibling: NodeWrapper | null

  // Navigation — field-based
  childForFieldName(fieldName: string): NodeWrapper | null

  // Search
  descendantsOfType(type: string | string[]): NodeWrapper[]
}
```

All navigation properties return `NodeWrapper` instances (or `null`), never raw `SyntaxNode`. This keeps the abstraction consistent throughout the tree.

### 6. Query Wrapper (`query.ts`)

```typescript
export function createQuery(language: Language, pattern: string): QueryWrapper

export class QueryWrapper {
  matches(node: NodeWrapper): QueryMatch[]
  captures(node: NodeWrapper): QueryCapture[]
}

export interface QueryMatch {
  pattern: number
  captures: QueryCapture[]
}

export interface QueryCapture {
  name: string
  node: NodeWrapper
}
```

- `createQuery()` compiles a tree-sitter query pattern; throws `TreeSitterQueryError` on invalid syntax
- `matches()` returns structured matches grouped by pattern
- `captures()` returns a flat list of all captures
- All returned nodes are `NodeWrapper` instances

## Testing Strategy

### Unit Tests (`__tests__/unit/`)

| Test file | Covers |
|-----------|--------|
| `tree-sitter-language.test.ts` | Load TypeScript grammar, cache behavior, unknown language error |
| `tree-sitter-parser.test.ts` | Parse valid source, parse invalid source (error nodes), timeout, null parse |
| `tree-sitter-node.test.ts` | All navigation (parent/child/sibling/field), state flags (`isError`, `hasError`, `isMissing`), type/text/position |
| `tree-sitter-query.test.ts` | Valid pattern matching, captures, invalid pattern error |

### Fixtures (`__tests__/fixtures/tree-sitter/`)

```
__tests__/fixtures/tree-sitter/
├── valid.ts          # Clean TypeScript file (functions, classes, interfaces)
├── with-errors.ts    # Intentionally malformed TypeScript (missing brackets, etc.)
└── complex.ts        # Nested structures for deep navigation testing
```

### Integration Test (`__tests__/integration/tree-sitter.integration.test.ts`)

- Uses `@jest-environment node` docblock
- End-to-end flow: load language → create parser → parse fixture file → navigate tree → run query → verify captures
- Validates the full pipeline works together

### Jest Configuration

- `tree-sitter` is a native module — may need `transformIgnorePatterns` adjustment in `jest.config.js` (similar to `@c4312/scip` and `@bufbuild/protobuf`)
- Fixture `.ts` files excluded from test matching via existing `testPathIgnorePatterns`

## Non-Goals

- No downstream integration (visualization, SCIP bridging) — that's future work
- No `web-tree-sitter` support — Node-only via native bindings
- No tree editing / incremental reparsing
- No caching layer (unlike SCIP) — parsing is fast enough to not need it initially

## Dependencies on Existing Code

None. This is a standalone module with no imports from `lib/git/`, `lib/ts/`, `lib/scip/`, or `app/`.
