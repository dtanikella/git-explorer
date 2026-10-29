import type TreeSitterParser from 'tree-sitter';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import {
  EdgeKind,
  type AnalysisEdge,
  type AnalysisNode,
} from '@/lib/analysis/types';
import { qualifySymbol } from '@/app/services/analysis/shared/symbol-utils';

type SyntaxNode = TreeSitterParser.SyntaxNode;

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

const TYPE_CONTEXT_TYPES = new Set([
  'type_annotation',
  'type_reference',
  'generic_type',
  'union_type',
  'intersection_type',
  'type_alias_declaration',
]);

const ENCLOSING_DECLARATION_TYPES = new Set([
  'function_declaration', 'method_definition', 'class_declaration',
  'interface_declaration', 'type_alias_declaration', 'arrow_function',
]);

// ============================================================================
// Ancestor Chain
// ============================================================================

/**
 * The ancestors of one AST node, walked lazily and cached.
 *
 * @remarks
 * Each reference needs several upward walks (edge kind, enclosing declaration, async and optional-chain
 * context). Every `parent` access crosses into the native binding, so the chain is walked at most once and
 * shared by all of them.
 */
class AncestorChain {
  private readonly nodes: SyntaxNode[];
  private complete = false;

  constructor(start: SyntaxNode) {
    this.nodes = [start];
  }

  /**
   * Returns the node `depth` levels above the start node (0 is the start node itself), or null past the root.
   *
   * @param depth - How many levels to climb.
   * @returns The ancestor at that depth, or null.
   */
  at(depth: number): SyntaxNode | null {
    while (this.nodes.length <= depth && !this.complete) {
      const parent = this.nodes[this.nodes.length - 1].parent;
      if (parent) this.nodes.push(parent);
      else this.complete = true;
    }
    return this.nodes[depth] ?? null;
  }
}

// ============================================================================
// AST Context Classification
// ============================================================================

/**
 * Classifies an SCIP reference into an {@link EdgeKind} by walking up the
 * tree-sitter AST from the reference position.
 *
 * @param chain - Ancestors of the AST node at the reference position.
 * @param symbolRoles - SCIP symbol role flags.
 * @returns The classified edge kind (CALLS, INSTANTIATES, EXTENDS, etc.).
 */
function classifyEdgeKind(chain: AncestorChain, symbolRoles: number): EdgeKind {
  // Import role in SCIP means this is an import binding
  if ((symbolRoles & SCIP_IMPORT) !== 0) {
    return EdgeKind.IMPORTS;
  }

  for (let depth = 1; ; depth++) {
    const parent = chain.at(depth);
    if (!parent) break;
    const parentType = parent.type;

    if (parentType === 'new_expression') {
      return EdgeKind.INSTANTIATES;
    }

    if (parentType === 'call_expression') {
      // Check if our node is the function being called (not an argument)
      const funcChild = parent.childForFieldName('function');
      if (funcChild && isNodeOrAncestorOf(funcChild, chain.at(depth - 1)!)) {
        return EdgeKind.CALLS;
      }
    }

    if (parentType === 'extends_clause') {
      return EdgeKind.EXTENDS;
    }

    if (parentType === 'implements_clause') {
      return EdgeKind.IMPLEMENTS;
    }

    if (TYPE_CONTEXT_TYPES.has(parentType)) {
      return EdgeKind.USES_TYPE;
    }

    if (parentType === 'import_statement' || parentType === 'import_clause') {
      return EdgeKind.IMPORTS;
    }
  }

  // Default: if we can't determine context, treat as CALLS
  return EdgeKind.CALLS;
}

/**
 * Checks whether one AST node is an ancestor of (or the same as) another.
 *
 * @param ancestor - The potential ancestor node.
 * @param descendant - The potential descendant node.
 * @returns True when descendant is contained within ancestor's byte range.
 */
function isNodeOrAncestorOf(
  ancestor: { startIndex: number; endIndex: number },
  descendant: { startIndex: number; endIndex: number },
): boolean {
  return descendant.startIndex >= ancestor.startIndex && descendant.endIndex <= ancestor.endIndex;
}

/**
 * Checks whether a reference is inside an async context (inside an
 * `await` expression, before the nearest enclosing call).
 *
 * @param chain - Ancestors of the AST node at the reference position.
 * @returns True when the position is inside an `await_expression`.
 */
function isAsyncContext(chain: AncestorChain): boolean {
  for (let depth = 1; ; depth++) {
    const parent = chain.at(depth);
    if (!parent) return false;
    if (parent.type === 'await_expression') return true;
    if (parent.type === 'call_expression') return false;
  }
}

/**
 * Checks whether a reference is inside an optional chaining (`?.`)
 * member or call expression.
 *
 * @param chain - Ancestors of the AST node at the reference position.
 * @returns True when the position is inside a `?.` chain.
 */
function isOptionalChainContext(chain: AncestorChain): boolean {
  for (let depth = 1; ; depth++) {
    const parent = chain.at(depth);
    if (!parent) return false;
    if (parent.type === 'member_expression') {
      const opChild = parent.childForFieldName('operator');
      if (opChild && opChild.text === '?.') return true;
    }
    if (parent.type === 'call_expression') {
      for (const child of parent.children) {
        if (child.type === '?.') return true;
      }
    }
  }
}

// ============================================================================
// Find Enclosing Node
// ============================================================================

type PositionIndex = Map<string, Map<string, AnalysisNode>>; // filePath → "line:col" → node

function positionKey(line: number, col: number): string {
  return `${line}:${col}`;
}

/**
 * Indexes nodes by file and name position, so the enclosing declaration of a
 * reference can be found without scanning every node.
 *
 * @param nodeMap - All extracted nodes, keyed by SCIP symbol.
 * @returns A per-file map from `"line:col"` to node.
 */
function buildPositionIndex(nodeMap: Map<string, AnalysisNode>): PositionIndex {
  const index: PositionIndex = new Map();
  for (const node of nodeMap.values()) {
    let byPosition = index.get(node.filePath);
    if (!byPosition) {
      byPosition = new Map();
      index.set(node.filePath, byPosition);
    }
    const key = positionKey(node.startLine, node.startCol);
    // When two nodes share a position, the first one in nodeMap order wins.
    if (!byPosition.has(key)) byPosition.set(key, node);
  }
  return index;
}

/**
 * Finds the nearest enclosing declaration of a reference that matches a known node.
 *
 * @param chain - Ancestors of the AST node at the reference position.
 * @param byPosition - Nodes in the reference's file, keyed by name position.
 * @returns The innermost enclosing known node, or null if none is found.
 */
function findEnclosingNode(
  chain: AncestorChain,
  byPosition: Map<string, AnalysisNode>,
): AnalysisNode | null {
  for (let depth = 1; ; depth++) {
    const parent = chain.at(depth);
    if (!parent) return null;
    if (!ENCLOSING_DECLARATION_TYPES.has(parent.type)) continue;

    const nameChild = parent.childForFieldName('name');
    if (nameChild) {
      const node = byPosition.get(positionKey(nameChild.startPosition.row, nameChild.startPosition.column));
      if (node) return node;
    }
    // For arrow functions, check variable_declarator parent
    if (parent.type === 'arrow_function') {
      const declarator = chain.at(depth + 1);
      if (declarator?.type === 'variable_declarator') {
        const varName = declarator.childForFieldName('name');
        if (varName) {
          const node = byPosition.get(positionKey(varName.startPosition.row, varName.startPosition.column));
          if (node) return node;
        }
      }
    }
  }
}

// ============================================================================
// Main Extraction
// ============================================================================

/**
 * Extracts analysis edges from TypeScript parsed files using tree-sitter
 * ASTs and SCIP occurrence data.
 *
 * @remarks
 * Identifies cross-references between nodes: calls, extends, implements,
 * instantiates, imports, and uses-type relationships. Each edge carries
 * the source and target symbols, the edge kind, and whether the reference
 * crosses file boundaries.
 *
 * @param input - The parsed files, SCIP occurrences, and language config.
 * @returns An array of {@link AnalysisEdge} objects representing all
 *   discovered relationships.
 */
export function extractEdges(input: EdgeExtractionInput): AnalysisEdge[] {
  const edges: AnalysisEdge[] = [];
  const edgeDedup = new Set<string>();
  const positionIndex = buildPositionIndex(input.nodeMap);

  for (const scipDoc of input.scipDocuments) {
    const filePath = scipDoc.relativePath;
    const parsed = input.parsedFiles.get(filePath);
    if (!parsed) continue;

    // Without known nodes in this file no reference has a source node, so no edge can be produced.
    const byPosition = positionIndex.get(filePath);
    if (!byPosition) continue;

    const root = parsed.tree.rootNode.raw;

    for (const occ of scipDoc.occurrences) {
      // Skip definitions — we only care about references for edges
      if ((occ.symbolRoles & SCIP_DEFINITION) !== 0) continue;

      const line = occ.range[0];
      const col = occ.range[1];

      const qualifiedTarget = qualifySymbol(filePath, occ.symbol);
      if (qualifiedTarget === null) continue;

      const start = root.descendantForPosition({ row: line, column: col });
      if (!start) continue;
      const chain = new AncestorChain(start);

      // Skip edges from nodes with no SCIP identity
      const sourceNode = findEnclosingNode(chain, byPosition);
      const fromSymbol = sourceNode?.scipSymbol;
      if (!sourceNode || !fromSymbol) continue;

      const targetNode = input.nodeMap.get(qualifiedTarget);
      const toFile = targetNode?.filePath ?? null;

      // Populate referencedAt/outboundRefs for every occurrence (not gated by dedup)
      if (targetNode) {
        targetNode.referencedAt.push({
          filePath,
          line,
          col,
          scipSymbol: fromSymbol,
        });
      }

      sourceNode.outboundRefs.push({
        filePath: toFile ?? '',
        line,
        col,
        scipSymbol: qualifiedTarget,
      });

      const kind = classifyEdgeKind(chain, occ.symbolRoles);

      // Dedup edges by file + fromSymbol + toSymbol + kind
      const dedupeKey = `${filePath}:${fromSymbol}|${qualifiedTarget}|${kind}`;
      if (edgeDedup.has(dedupeKey)) continue;
      edgeDedup.add(dedupeKey);

      const toName = targetNode?.name ?? occ.symbol.split('/').pop()?.replace(/[().#]/g, '') ?? '';

      edges.push({
        kind,
        fromFile: filePath,
        fromName: sourceNode.name,
        fromSymbol,
        toText: toName,
        toFile,
        toName,
        toSymbol: qualifiedTarget,
        isExternal: !targetNode,
        isAmbiguous: false,
        edgePosition: { line, col },
        isOptionalChain: isOptionalChainContext(chain),
        isAsync: isAsyncContext(chain),
      });
    }
  }

  return edges;
}
