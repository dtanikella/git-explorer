# Analysis Controller Design Spec

**Issue:** [#18 — Introduce analysis controller](https://github.com/dtanikella/git-explorer/issues/18)
**Date:** 2026-04-28

## Problem

The current TypeScript analysis (`lib/ts/analyzer.ts`, 1201 lines) uses the TypeScript Compiler API for everything — parsing, type resolution, and cross-file references. SCIP and tree-sitter libraries have been built (`lib/scip/`, `lib/tree-sitter/`) but aren't yet used in analysis.

This spec introduces a new **analysis controller** that replaces the TS Compiler API with tree-sitter (syntax parsing) and SCIP (cross-file symbol resolution), exposed via a new `/api/repo-analysis` endpoint.

## Approach

Pipeline architecture with a language-agnostic orchestrator delegating to a TS-specific sub-controller. Five stages: SCIP indexing → tree-sitter parsing → node extraction → edge extraction → graph assembly.

## Module Structure

```
app/services/analysis/
  controller.ts          # Language-agnostic orchestrator
  language-detector.ts   # Detects repo language from config files
  ts/
    controller.ts        # TS-specific pipeline orchestrator
    node-extractor.ts    # Tree-sitter AST → AnalysisNode[]
    edge-extractor.ts    # SCIP refs + AST context → AnalysisEdge[]
    graph-assembler.ts   # Metadata computation, final result assembly

lib/analysis/
  types.ts               # Shared schema (AnalysisNode, AnalysisEdge, enums)

app/api/repo-analysis/
  route.ts               # POST endpoint
```

Existing libraries consumed as-is: `lib/scip/` (indexing, caching, deserialization) and `lib/tree-sitter/` (parsing, AST navigation, queries).

## Schema

### Node

```typescript
enum SyntaxType {
  FUNCTION = 'FUNCTION',
  METHOD = 'METHOD',
  CLASS = 'CLASS',
  INTERFACE = 'INTERFACE',
  TYPE_ALIAS = 'TYPE_ALIAS',
  MODULE = 'MODULE',
}

interface AnalysisNode {
  syntaxType: SyntaxType;
  name: string;
  filePath: string;               // relative to repo root
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

interface ParamInfo {
  name: string;
  typeText: string | null;
  isOptional: boolean;
}

interface ReferenceLocation {
  filePath: string;
  line: number;
  col: number;
  scipSymbol: string;
}
```

**Missing SyntaxTypes (documented for future):** `ENUM`, `VARIABLE`, `NAMESPACE`, `DECORATOR`, `GETTER`, `SETTER`, `CONSTRUCTOR`.

### Edge

```typescript
enum EdgeKind {
  CALLS = 'CALLS',
  INSTANTIATES = 'INSTANTIATES',
  USES_TYPE = 'USES_TYPE',
  IMPORTS = 'IMPORTS',
  EXTENDS = 'EXTENDS',
  IMPLEMENTS = 'IMPLEMENTS',
}

interface AnalysisEdge {
  kind: EdgeKind;
  fromFile: string;
  fromName: string;
  fromSymbol: string;
  toText: string;
  toFile: string | null;          // null if external
  toName: string;
  toSymbol: string;
  isExternal: boolean;
  edgePosition: { line: number; col: number };
  isOptionalChain: boolean;       // foo?.bar() — traverses optional chain operator
  isAsync: boolean;               // await foo() or async call context
}
```

**Missing EdgeKinds (documented for future):** `OVERRIDES`, `DECORATES`, `RETURNS_TYPE`, `THROWS`, `GENERIC_PARAM`.

### Output

```typescript
interface AnalysisResult {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  metadata: {
    repoPath: string;
    language: string;
    nodeCount: number;
    edgeCount: number;
    analysisDurationMs: number;
    missingNodeTypes: string[];
    missingEdgeKinds: string[];
  };
}
```

## Pipeline Stages

### Stage 1: SCIP Indexing

```
Input:  repoPath
Action: indexTypeScript(repoPath) → index path (with cache check)
        deserializeSCIP(readFileSync(indexPath)) → ScipIndex
Output: ScipIndex (documents with occurrences and symbols)
```

Uses existing `lib/scip/ts/indexer.ts` and `lib/scip/reader.ts`. The indexer checks cache (HEAD SHA-based) and re-indexes only if stale.

### Stage 2: Tree-sitter Parsing

```
Input:  repoPath, file list (from ScipIndex documents), hideTestFiles flag
Action: Filter out test files if hideTestFiles=true
        For each remaining file → ParserWrapper.parse(source) → TreeWrapper
Output: Map<filePath, { tree: TreeWrapper, source: string }>
```

**Test file detection:** Pattern-based matching — `*.test.ts`, `*.spec.ts`, `__tests__/**`, `test/**`. Implemented as a reusable utility function.

The file list comes from the SCIP index's document list, which reflects what `tsconfig.json` includes. This avoids redundant file discovery.

The SCIP index is not filtered — it indexes everything (cached and shared). Filtering happens here at parse time.

### Stage 3: Node Extraction

```
Input:  Parsed trees + SCIP index
Action: Walk each tree's AST for declarations (functions, methods, classes, interfaces, type aliases)
        Match each declaration to its SCIP symbol via position correlation
        Build AnalysisNode with syntax info (tree-sitter) + symbol ID (SCIP)
Output: AnalysisNode[], Map<scipSymbol, AnalysisNode> (lookup index)
```

**Position correlation:** SCIP occurrences have `[startLine, startChar, endLine, endChar]`. Tree-sitter nodes have `startPosition`/`endPosition`. Match by finding the SCIP definition occurrence whose range contains the tree-sitter node's identifier position.

**Tree-sitter node types to match:**
- `function_declaration`, `arrow_function`, `function` → `FUNCTION`
- `method_definition` → `METHOD`
- `class_declaration` → `CLASS`
- `interface_declaration` → `INTERFACE`
- `type_alias_declaration` → `TYPE_ALIAS`
- Source file itself → `MODULE`

### Stage 4: Edge Extraction

```
Input:  SCIP index, parsed trees, node lookup map
Action: Walk SCIP occurrences that are references (not definitions)
        For each reference:
          - Look up target node via SCIP symbol in node map
          - Determine EdgeKind from AST context at reference position
          - Extract isAsync and isOptionalChain from tree-sitter context
          - Build AnalysisEdge
          - Populate referencedAt[] on target node inline
          - Populate outboundRefs[] on source node inline
Output: AnalysisEdge[] (nodes already have referencedAt/outboundRefs populated)
```

**Edge kind classification via AST context:**
- Reference inside `call_expression` → `CALLS`
- Reference inside `new_expression` → `INSTANTIATES`
- Reference inside type annotation (`type_annotation`, `type_reference`) → `USES_TYPE`
- Reference inside `import_statement` → `IMPORTS`
- Reference inside heritage clause with `extends` keyword → `EXTENDS`
- Reference inside heritage clause with `implements` keyword → `IMPLEMENTS`

SCIP provides "symbol X references symbol Y at position P." Tree-sitter provides the syntactic context at position P. Combining both yields typed edges.

### Stage 5: Graph Assembly

```
Input:  AnalysisNode[], AnalysisEdge[]
Action: Compute metadata (counts, duration, documented gaps)
Output: AnalysisResult
```

Lightweight — `referencedAt`/`outboundRefs` are already populated inline during Stage 4.

## Controller Delegation

### Language Detection

```typescript
type SupportedLanguage = 'typescript';

function detectLanguage(repoPath: string): SupportedLanguage | null
```

Checks for `tsconfig.json` at repo root. Returns `'typescript'` or `null`. Extensible — add checks for other languages later.

### Top-Level Controller

```typescript
async function analyzeRepo(
  repoPath: string,
  options?: { hideTestFiles?: boolean }
): Promise<AnalysisResult>
```

1. Validate `repoPath` exists
2. `detectLanguage(repoPath)` → language
3. If `null` → throw `UnsupportedLanguageError`
4. Delegate: `'typescript'` → `analyzeTsRepo(repoPath, options)`
5. Return result

`hideTestFiles` defaults to `true`.

### TS Controller

```typescript
async function analyzeTsRepo(
  repoPath: string,
  options: { hideTestFiles: boolean }
): Promise<AnalysisResult>
```

Orchestrates Stages 1–5, threading data between stages.

### API Route

```
POST /api/repo-analysis
Body: { repoPath: string, hideTestFiles?: boolean }
Response: { success: true, data: AnalysisResult }
      or: { success: false, error: string }
```

Same pattern as existing `/api/ts-analysis` — validate input, call controller, handle errors with appropriate HTTP status codes (400, 404, 500).

## Error Handling

Custom error classes following existing SCIP/tree-sitter patterns:

```typescript
class AnalysisError extends Error { repoPath: string }
class UnsupportedLanguageError extends AnalysisError { detectedFiles: string[] }
class NodeExtractionError extends AnalysisError { filePath: string; phase: string }
class EdgeExtractionError extends AnalysisError { filePath: string; phase: string }
```

Each pipeline stage wraps errors with context (file path, stage name). First pass uses **fail-fast** — any stage error fails the analysis. Partial-result support can be added later.

## Testing Strategy

- **Unit tests** for `node-extractor` and `edge-extractor` using small fixture `.ts` files
- **Unit tests** for `language-detector`
- **Integration test** for the full TS controller pipeline against a fixture project (follows `__tests__/integration/` pattern)
- **API route test** for `/api/repo-analysis` with mocked controller

## Documented Gaps

### Missing Node SyntaxTypes
- `ENUM` — enum declarations
- `VARIABLE` — const/let/var declarations at module scope
- `NAMESPACE` — TypeScript namespace declarations
- `DECORATOR` — decorator definitions
- `GETTER` / `SETTER` — accessor methods
- `CONSTRUCTOR` — standalone constructor node (currently part of CLASS)

### Missing Edge Kinds
- `OVERRIDES` — method overriding a parent class method
- `DECORATES` — decorator applied to a class/method/property
- `RETURNS_TYPE` — function return type reference
- `THROWS` — thrown error type
- `GENERIC_PARAM` — generic type parameter usage

### Not Yet Handled
- JSX component usage as CALLS edges
- Re-export / barrel file resolution
- Namespace member access (`ns.foo`)
- Higher-order function detection (function passed as argument)
