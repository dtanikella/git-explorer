import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import {
  EdgeKind,
  type AnalysisEdge,
  type AnalysisNode,
} from '@/lib/analysis/types';
import { qualifySymbol } from './symbol-utils';

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

      const qualifiedTarget = qualifySymbol(filePath, occ.symbol);
      if (qualifiedTarget === null) continue;

      const kind = classifyEdgeKind(tree, line, col, occ.symbolRoles);
      const targetNode = input.nodeMap.get(qualifiedTarget);

      const isExternal = !targetNode;
      const toFile = targetNode?.filePath ?? null;
      const toName = targetNode?.name ?? occ.symbol.split('/').pop()?.replace(/[().#]/g, '') ?? '';

      // Find the enclosing (source) node
      const sourceNode = findEnclosingNode(tree, line, col, filePath, input.nodeMap);

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
        toSymbol: qualifiedTarget,
        isExternal,
        edgePosition: { line, col },
        isOptionalChain: isOptionalChainContext(tree, line, col),
        isAsync: isAsyncContext(tree, line, col),
      };

      edges.push(edge);
    }
  }

  return edges;
}
