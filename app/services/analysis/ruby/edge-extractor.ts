import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import { NodeWrapper } from '@/lib/tree-sitter/node';
import {
  EdgeKind,
  SyntaxType,
  type AnalysisEdge,
  type AnalysisNode,
} from '@/lib/analysis/types';

// ============================================================================
// Types
// ============================================================================

export interface RubyEdgeExtractionInput {
  parsedFiles: Map<string, { tree: TreeWrapper; source: string }>;
  nodeMap: Map<string, AnalysisNode>;
  repoPath: string;
}

// method_definition-like node kinds Ruby's extractor now produces alongside
// plain METHOD (getters/setters/constructor) — call-target resolution below
// needs to treat all of them as "a method", not just SyntaxType.METHOD.
const RUBY_METHOD_LIKE_TYPES = new Set<SyntaxType>([
  SyntaxType.METHOD,
  SyntaxType.GETTER,
  SyntaxType.SETTER,
  SyntaxType.CONSTRUCTOR,
]);

// ============================================================================
// AST analysis helpers
// ============================================================================

/**
 * Check whether a `call` node is an `include`/`extend`/`prepend` invocation
 * with no explicit receiver (implicit self).
 */
function isMixinCall(callNode: NodeWrapper): boolean {
  const methodChild = callNode.childForFieldName('method');
  if (!methodChild || methodChild.type !== 'identifier') return false;
  const methodName = methodChild.text;
  return methodName === 'include' || methodName === 'extend' || methodName === 'prepend';
}

/**
 * Check if a `call` node is a `new` expression with a constant receiver.
 */
function isConstantNewCall(callNode: NodeWrapper): boolean {
  const methodChild = callNode.childForFieldName('method');
  if (!methodChild || methodChild.type !== 'identifier') return false;
  if (methodChild.text !== 'new') return false;
  const receiver = getCallReceiver(callNode);
  if (!receiver) return false;
  return receiver.type === 'constant' || receiver.type === 'scope_resolution';
}

/**
 * Get the receiver of a call node (the part before the dot).
 * Returns null for implicit self calls.
 */
function getCallReceiver(callNode: NodeWrapper): NodeWrapper | null {
  const children = callNode.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.isNamed && child.type !== 'identifier' && child.type !== 'constant') continue;
    // Check if next sibling is a "." or "::" operator
    const next = children[i + 1];
    if (next && (next.type === '.' || next.type === '::')) {
      return child;
    }
    // For receiver followed by method name without explicit dot (like `a.b`)
    // In tree-sitter-ruby, call children with receiver have: receiver ., method, ...
    if (next && next.isNamed) break;
  }
  return null;
}

/**
 * Extract the full text of a constant/scope_resolution name as a flat string.
 */
function flattenConstantName(node: NodeWrapper): string {
  if (node.type === 'constant') {
    return node.text;
  }
  if (node.type === 'scope_resolution') {
    const parts: string[] = [];
    const collect = (n: NodeWrapper): void => {
      if (n.type === 'constant') {
        parts.push(n.text);
      } else if (n.type === 'scope_resolution') {
        const scope = n.childForFieldName('scope');
        const name = n.childForFieldName('name');
        if (scope) collect(scope);
        if (name) parts.push(name.text);
      }
    };
    collect(node);
    return parts.join('::');
  }
  return node.text;
}

/**
 * Flatten a class/module name node, handling both constant and scope_resolution.
 */
function flattenClassName(nameNode: NodeWrapper): string | null {
  if (nameNode.type === 'constant') {
    return nameNode.text;
  }
  if (nameNode.type === 'scope_resolution') {
    const parts: string[] = [];
    const collect = (n: NodeWrapper): void => {
      if (n.type === 'constant') {
        parts.push(n.text);
      } else if (n.type === 'scope_resolution') {
        const scope = n.childForFieldName('scope');
        const name = n.childForFieldName('name');
        if (scope) collect(scope);
        if (name) parts.push(name.text);
      }
    };
    collect(nameNode);
    return parts.length > 0 ? parts.join('::') : null;
  }
  return null;
}

// ============================================================================
// CALLS Resolution — scope-first search
// ============================================================================

/**
 * Parse a ruby symbol of the form ruby:filepath#scope.name or ruby:filepath#scope#name
 */
function parseRubySymbol(symbol: string): { scope: string; name: string; isSingleton: boolean } | null {
  if (!symbol.startsWith('ruby:')) return null;
  const qualifier = symbol.slice(5);
  // Find the first '#' after the filepath (which is everything before the last # or .)
  const fileHashIdx = qualifier.indexOf('#');
  if (fileHashIdx < 0) return null;

  const qualifiedName = qualifier.slice(fileHashIdx + 1);

  // Find the last dot or hash that separates scope from method name
  const dotIdx = qualifiedName.lastIndexOf('.');
  const hashIdx = qualifiedName.lastIndexOf('#');

  if (dotIdx > hashIdx) {
    return { scope: qualifiedName.slice(0, dotIdx), name: qualifiedName.slice(dotIdx + 1), isSingleton: true };
  }
  if (hashIdx >= 0) {
    return { scope: qualifiedName.slice(0, hashIdx), name: qualifiedName.slice(hashIdx + 1), isSingleton: false };
  }
  // Top-level method
  return { scope: '', name: qualifiedName, isSingleton: false };
}

/**
 * Find the enclosing scope for a given position in the file.
 */
/**
 * Finds the function/method body that encloses a given source position.
 *
 * @param tree - The parsed file tree.
 * @param line - 0-indexed line number.
 * @param col - 0-indexed column number.
 * @param filePath - Path for error context.
 * @returns The scope path and singleton status, or null if not inside a
 *   function/method body.
 */
function findEnclosingScope(
  tree: TreeWrapper,
  line: number,
  col: number,
  filePath: string,
): { scopePath: string; isSingleton: boolean } | null {
  const tsNode = tree.rootNode.raw.descendantForPosition({ row: line, column: col });
  if (!tsNode) return null;

  let current = tsNode;
  const scopeParts: string[] = [];
  let isSingleton = false;
  let inSingletonClass = false;

  while (current.parent) {
    const parent = current.parent;

    if (parent.type === 'class' || parent.type === 'module') {
      const nameNode = parent.childForFieldName('name');
      if (nameNode) {
        const className = flattenClassName(new NodeWrapper(nameNode)) ?? '';
        const simpleName = className.includes('::') ? className.split('::').pop()! : className;
        scopeParts.unshift(simpleName);
      }
      if (inSingletonClass) {
        isSingleton = true;
      }
      inSingletonClass = false;
    }

    if (parent.type === 'singleton_class') {
      inSingletonClass = true;
    }

    current = current.parent;
  }

  if (scopeParts.length === 0) return null;
  return { scopePath: scopeParts.join('::'), isSingleton };
}

// ============================================================================
// Find enclosing method node
// ============================================================================

/**
 * Finds the nearest enclosing Ruby AST node (method, class, or block)
 * at a given source position.
 *
 * @param tree - The parsed file tree.
 * @param line - 0-indexed line number.
 * @param col - 0-indexed column number.
 * @returns The closest enclosing node, or null.
 */
function findEnclosingRubyNode(
  tree: TreeWrapper,
  line: number,
  col: number,
  filePath: string,
  nodeMap: Map<string, AnalysisNode>,
): AnalysisNode | null {
  const tsNode = tree.rootNode.raw.descendantForPosition({ row: line, column: col });
  if (!tsNode) return null;

  let current = tsNode;
  while (current.parent) {
    const parent = current.parent;
    if (parent.type === 'method' || parent.type === 'singleton_method') {
      const nameChild = parent.childForFieldName('name');
      if (nameChild) {
        for (const node of nodeMap.values()) {
          if (
            node.filePath === filePath &&
            node.startLine === nameChild.startPosition.row &&
            node.startCol === nameChild.startPosition.column
          ) {
            return node;
          }
        }
      }
    }
    current = current.parent;
  }

  // No enclosing method found — try finding enclosing class/module
  current = tsNode;
  while (current.parent) {
    const parent = current.parent;
    if (parent.type === 'class' || parent.type === 'module') {
      const nameNode = parent.childForFieldName('name');
      if (nameNode) {
        // For class/module, match by position
        for (const node of nodeMap.values()) {
          if (
            node.filePath === filePath &&
            node.startLine === nameNode.startPosition.row &&
            node.startCol === nameNode.startPosition.column
          ) {
            return node;
          }
        }
      }
    }
    current = current.parent;
  }

  return null;
}

/**
 * Determine if a position is inside a singleton context.
 */
function positionIsInSingletonContext(
  tree: TreeWrapper,
  line: number,
  col: number,
): boolean {
  const tsNode = tree.rootNode.raw.descendantForPosition({ row: line, column: col });
  if (!tsNode) return false;
  let current = tsNode;
  while (current.parent) {
    if (current.parent.type === 'singleton_class') return true;
    if (current.parent.type === 'singleton_method') return true;
    if (current.parent.type === 'method') return false; // regular method
    if (current.parent.type === 'class' || current.parent.type === 'module') return false;
    current = current.parent;
  }
  return false;
}

/**
 * Build a scope index from the node map for resolution.
 */
interface ScopeIndex {
  bySimpleName: Map<string, AnalysisNode[]>;
  byScope: Map<string, AnalysisNode[]>;
}

function buildScopeIndex(nodeMap: Map<string, AnalysisNode>): ScopeIndex {
  const bySimpleName = new Map<string, AnalysisNode[]>();
  const byScope = new Map<string, AnalysisNode[]>();

  for (const node of nodeMap.values()) {
    const parsed = parseRubySymbol(node.scipSymbol);
    if (!parsed) continue;

    const existing = bySimpleName.get(parsed.name) ?? [];
    existing.push(node);
    bySimpleName.set(parsed.name, existing);

    if (parsed.scope) {
      const scopeNodes = byScope.get(parsed.scope) ?? [];
      scopeNodes.push(node);
      byScope.set(parsed.scope, scopeNodes);
    }
  }

  return { bySimpleName, byScope };
}

/**
 * Resolve a method call target using scope-first resolution.
 */
function resolveCallTarget(
  callName: string,
  sourceScope: string | null,
  isSingletonCallSite: boolean,
  index: ScopeIndex,
  filePath: string,
): { target: AnalysisNode | null; isAmbiguous: boolean } {
  // Step 1: Own enclosing scope (singleton-aware)
  if (sourceScope) {
    const scopeNodes = index.byScope.get(sourceScope) ?? [];
    const candidates = scopeNodes.filter(n => {
      const p = parseRubySymbol(n.scipSymbol);
      return p && p.name === callName && p.isSingleton === isSingletonCallSite;
    });

    if (candidates.length === 1) return { target: candidates[0], isAmbiguous: false };
    if (candidates.length > 1) return { target: candidates[0], isAmbiguous: true };
  }

  // Step 5: Repo-wide name search fallback
  return resolveRepoWideFallback(callName, index, filePath);
}

function resolveRepoWideFallback(
  callName: string,
  index: ScopeIndex,
  filePath: string,
): { target: AnalysisNode | null; isAmbiguous: boolean } {
  const candidates = index.bySimpleName.get(callName) ?? [];
  if (candidates.length === 0) return { target: null, isAmbiguous: false };
  if (candidates.length === 1) return { target: candidates[0], isAmbiguous: false };

  // Tie-break: same file first
  const sameFile = candidates.filter(n => n.filePath === filePath);
  if (sameFile.length >= 1) return { target: sameFile[0], isAmbiguous: true };

  // Then by scope depth (shorter first)
  const byDepth = [...candidates].sort((a, b) => {
    const aParsed = parseRubySymbol(a.scipSymbol);
    const bParsed = parseRubySymbol(b.scipSymbol);
    const aDepth = aParsed ? aParsed.scope.split('::').length : 0;
    const bDepth = bParsed ? bParsed.scope.split('::').length : 0;
    return aDepth - bDepth;
  });
  return { target: byDepth[0], isAmbiguous: true };
}

// ============================================================================
// Reference scanning helpers
// ============================================================================

/**
 * Check if a node is in a position where it represents a name definition
 * (class/module name, method name, parameter) and should not be treated as
 * a reference.
 */
function isDefinitionPosition(node: NodeWrapper): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // Method/class/module name definitions
  const nameField = parent.childForFieldName('name');
  if (nameField && nameField.id === node.id) return true;

  // Parameter names
  const paramsField = parent.childForFieldName('parameters');
  if (paramsField) {
    for (const child of paramsField.namedChildren) {
      if (child.id === node.id) return true;
      // optional_parameter, splat_parameter, block_parameter contain identifiers
      if (child.type === 'optional_parameter') {
        const n = child.childForFieldName('name');
        if (n && n.id === node.id) return true;
      }
      if (child.type === 'splat_parameter') {
        const n = child.childForFieldName('name');
        if (n && n.id === node.id) return true;
      }
      if (child.type === 'block_parameter') {
        const n = child.childForFieldName('name');
        if (n && n.id === node.id) return true;
      }
      if (child.type === 'keyword_parameter') {
        const n = child.childForFieldName('name');
        if (n && n.id === node.id) return true;
      }
    }
  }

  // Variable assignment
  if (parent.type === 'assignment') {
    const left = parent.children[0];
    if (left && left.id === node.id) return true;
  }

  return false;
}

/**
 * Check if an identifier is likely a local variable reference rather than
 * a method call. Uses simple heuristics.
 */
function isLocalVariableReference(
  node: NodeWrapper,
  scopeIdentifiers: Set<string>,
): boolean {
  const text = node.text;

  // Keywords and special references
  if (text === 'self' || text === 'super' || text === 'nil' || text === 'true' || text === 'false' || text === '__FILE__' || text === '__LINE__' || text === '__ENCODING__') {
    return true;
  }

  // Known local variable from same scope
  if (scopeIdentifiers.has(text)) {
    return true;
  }

  return false;
}

/**
 * Collect identifiers declared as local variables within a given scope.
 */
function collectLocalVariables(bodyNode: NodeWrapper): Set<string> {
  const locals = new Set<string>();

  // Simple assignment: x = ...
  const assignments = bodyNode.descendantsOfType(['assignment']);
  for (const a of assignments) {
    const left = a.children[0];
    if (left && left.isNamed && left.type === 'identifier') {
      locals.add(left.text);
    }
  }

  // Method parameter
  const parameters = bodyNode.descendantsOfType(['method_parameters']);
  for (const p of parameters) {
    for (const child of p.namedChildren) {
      if (child.type === 'identifier') {
        locals.add(child.text);
      } else {
        const nameChild = child.childForFieldName('name');
        if (nameChild) locals.add(nameChild.text);
      }
    }
  }

  return locals;
}

// ============================================================================
// INCLUDES / mixin helpers
// ============================================================================

/**
 * Extract module names from an include/extend/prepend call's arguments.
 */
function extractMixinTargets(callNode: NodeWrapper): string[] {
  const args = callNode.childForFieldName('arguments');
  if (!args) return [];

  const targets: string[] = [];
  for (const child of args.namedChildren) {
    if (child.type === 'constant' || child.type === 'scope_resolution') {
      targets.push(flattenConstantName(child));
    }
  }
  return targets;
}

/**
 * Find a node by its simple name or scope name.
 */
function findNodeByMixinName(name: string, nodeMap: Map<string, AnalysisNode>): AnalysisNode | null {
  for (const node of nodeMap.values()) {
    if (node.name === name) return node;
    const parsed = parseRubySymbol(node.scipSymbol);
    if (parsed && parsed.scope === name && !RUBY_METHOD_LIKE_TYPES.has(node.syntaxType)) return node;
  }
  return null;
}

// ============================================================================
// Populating refs
// ============================================================================

function addRef(
  sourceNode: AnalysisNode | null,
  targetNode: AnalysisNode | null,
  filePath: string,
  line: number,
  col: number,
  fromSymbol: string,
  toSymbol: string,
): void {
  if (targetNode) {
    targetNode.referencedAt.push({ filePath, line, col, scipSymbol: fromSymbol });
  }
  if (sourceNode) {
    sourceNode.outboundRefs.push({
      filePath: targetNode?.filePath ?? '',
      line,
      col,
      scipSymbol: toSymbol,
    });
  }
}

// ============================================================================
// Main Extraction
// ============================================================================

/**
 * Extracts edges from Ruby source files via tree-sitter AST traversal.
 *
 * @remarks
 * Finds all method call sites and resolves them against the node map.
 * Edges include calls, references to constants, and includes/extend
 * relationships. Ruby edge extraction uses tree-sitter only (no SCIP).
 *
 * @param input - Parsed Ruby files, node map, and language configuration.
 * @returns An array of {@link AnalysisEdge} objects for all discovered
 *   relationships.
 * @see commit e20b947
 */
export function extractRubyEdges(input: RubyEdgeExtractionInput): AnalysisEdge[] {
  const edges: AnalysisEdge[] = [];
  const edgeDedup = new Set<string>();
  const index = buildScopeIndex(input.nodeMap);

  for (const [filePath, parsed] of input.parsedFiles) {
    const { tree } = parsed;

    // Process all call nodes (explicit method calls with receiver or arguments)
    const callNodes = findAllCallNodes(tree.rootNode);
    for (const callNode of callNodes) {
      processCallNode(callNode, tree, filePath, index, input.nodeMap, edges, edgeDedup);
    }

    // Process bare identifier references (potential implicit self calls)
    const bareRefs = findBareIdentifierRefs(tree.rootNode);
    for (const { node, localVars } of bareRefs) {
      processBareIdentifier(node, localVars, tree, filePath, index, input.nodeMap, edges, edgeDedup);
    }
  }

  return edges;
}

/**
 * Find all `call` nodes in the tree.
 */
function findAllCallNodes(rootNode: NodeWrapper): NodeWrapper[] {
  const result: NodeWrapper[] = [];
  const walk = (node: NodeWrapper): void => {
    if (node.type === 'call') {
      result.push(node);
    }
    for (const child of node.children) {
      if (child.isNamed) walk(child);
    }
  };
  walk(rootNode);
  return result;
}

/**
 * Find bare identifier references that could be method calls.
 * Returns identifiers inside method bodies that:
 * - Are not definition positions
 * - Are not local variable references
 * - Are not keywords/self/super
 */
function findBareIdentifierRefs(rootNode: NodeWrapper): Array<{ node: NodeWrapper; localVars: Set<string> }> {
  const results: Array<{ node: NodeWrapper; localVars: Set<string> }> = [];
  const walk = (node: NodeWrapper, localVars: Set<string>): void => {
    // Check if this is a method body, collect local vars in its scope
    let currentLocals = localVars;
    if (node.type === 'method' || node.type === 'singleton_method') {
      currentLocals = new Set([...localVars, ...collectLocalVariables(node)]);
    }

    // Check for bare identifier references
    if (node.type === 'identifier' && !isDefinitionPosition(node)) {
      results.push({ node, localVars: currentLocals });
    }

    for (const child of node.children) {
      if (child.isNamed) walk(child, currentLocals);
    }
  };

  walk(rootNode, new Set<string>());
  return results;
}

/**
 * Get the method name from a call node.
 */
function getCallMethodName(callNode: NodeWrapper): string | null {
  const methodChild = callNode.childForFieldName('method');
  if (methodChild) return methodChild.text;

  // For calls like `foo.bar` without explicit method field, the method
  // name is the last identifier child
  const namedChildren = callNode.namedChildren;
  if (namedChildren.length > 0) {
    const last = namedChildren[namedChildren.length - 1];
    // If it has arguments, the real method is the child before args
    const argsChild = callNode.childForFieldName('arguments');
    if (argsChild) {
      for (let i = 0; i < callNode.children.length; i++) {
        if (callNode.children[i].id === argsChild.id && i > 0) {
          const prev = callNode.children[i - 1];
          return prev.text;
        }
      }
    }
    return last.type === 'identifier' ? last.text : null;
  }
  return null;
}

function processCallNode(
  callNode: NodeWrapper,
  tree: TreeWrapper,
  filePath: string,
  index: ScopeIndex,
  nodeMap: Map<string, AnalysisNode>,
  edges: AnalysisEdge[],
  edgeDedup: Set<string>,
): void {
  const methodName = getCallMethodName(callNode);
  if (!methodName) return;

  const line = callNode.startPosition.row;
  const col = callNode.startPosition.column;

  // --- INCLUDES edge ---
  if (isMixinCall(callNode)) {
    const targets = extractMixinTargets(callNode);
    const sourceNode = findEnclosingRubyNode(tree, line, col, filePath, nodeMap);
    if (!sourceNode) return;

    const fromSymbol = sourceNode.scipSymbol;

    for (const targetName of targets) {
      const targetNode = findNodeByMixinName(targetName, nodeMap);
      const toSymbol = targetNode?.scipSymbol ?? `ruby:${targetName}`;

      addRef(sourceNode, targetNode, filePath, line, col, fromSymbol, toSymbol);

      const dedupeKey = `${filePath}:${fromSymbol}|${toSymbol}|${EdgeKind.INCLUDES}`;
      if (edgeDedup.has(dedupeKey)) return;
      edgeDedup.add(dedupeKey);

      edges.push({
        kind: EdgeKind.INCLUDES,
        fromFile: filePath,
        fromName: sourceNode.name,
        fromSymbol,
        toText: targetName,
        toFile: targetNode?.filePath ?? null,
        toName: targetName,
        toSymbol,
        isExternal: !targetNode,
        isAmbiguous: false,
        edgePosition: { line, col },
        isOptionalChain: false,
        isAsync: false,
      });
    }
    return;
  }

  // --- INSTANTIATES edge ---
  if (methodName === 'new' && isConstantNewCall(callNode)) {
    const receiver = getCallReceiver(callNode);
    if (receiver && (receiver.type === 'constant' || receiver.type === 'scope_resolution')) {
      const className = flattenConstantName(receiver);
      const sourceNode = findEnclosingRubyNode(tree, line, col, filePath, nodeMap);
      if (!sourceNode) return;

      const fromSymbol = sourceNode.scipSymbol;
      let targetNode: AnalysisNode | null = null;
      for (const node of nodeMap.values()) {
        if (node.syntaxType === SyntaxType.CLASS && node.name === className) {
          targetNode = node;
          break;
        }
      }

      const toSymbol = targetNode?.scipSymbol ?? `ruby:${className}`;
      addRef(sourceNode, targetNode, filePath, line, col, fromSymbol, toSymbol);

      const dedupeKey = `${filePath}:${fromSymbol}|${toSymbol}|${EdgeKind.INSTANTIATES}`;
      if (edgeDedup.has(dedupeKey)) return;
      edgeDedup.add(dedupeKey);

      edges.push({
        kind: EdgeKind.INSTANTIATES,
        fromFile: filePath,
        fromName: sourceNode.name,
        fromSymbol,
        toText: className,
        toFile: targetNode?.filePath ?? null,
        toName: className,
        toSymbol,
        isExternal: !targetNode,
        isAmbiguous: false,
        edgePosition: { line, col },
        isOptionalChain: false,
        isAsync: false,
      });
    }
    return;
  }

  // --- CALLS edge (from call node with receiver) ---
  const receiver = getCallReceiver(callNode);
  if (receiver && (receiver.type === 'constant' || receiver.type === 'scope_resolution')) {
    const constantName = flattenConstantName(receiver);
    const sourceNode = findEnclosingRubyNode(tree, line, col, filePath, nodeMap);
    if (!sourceNode) return;

    const fromSymbol = sourceNode.scipSymbol;

    // Find method in constant's scope
    let targetNode: AnalysisNode | null = null;
    let isAmbiguous = false;
    for (const node of nodeMap.values()) {
      if (RUBY_METHOD_LIKE_TYPES.has(node.syntaxType) && node.name === methodName) {
        const parsed = parseRubySymbol(node.scipSymbol);
        if (parsed && parsed.scope === constantName && parsed.isSingleton) {
          if (targetNode) isAmbiguous = true;
          else targetNode = node;
        }
      }
    }

    const toSymbol = targetNode?.scipSymbol ?? `ruby:${constantName}.${methodName}`;
    addRef(sourceNode, targetNode, filePath, line, col, fromSymbol, toSymbol);

    const dedupeKey = `${filePath}:${fromSymbol}|${toSymbol}|${EdgeKind.CALLS}`;
    if (edgeDedup.has(dedupeKey)) return;
    edgeDedup.add(dedupeKey);

    edges.push({
      kind: EdgeKind.CALLS,
      fromFile: filePath,
      fromName: sourceNode.name,
      fromSymbol,
      toText: methodName,
      toFile: targetNode?.filePath ?? null,
      toName: methodName,
      toSymbol,
      isExternal: !targetNode,
      isAmbiguous,
      edgePosition: { line, col },
      isOptionalChain: false,
      isAsync: false,
    });
    return;
  }

  // Implicit self calls from call nodes (e.g. foo(), foo.bar where foo is not a receiver)
  // Actually, for call nodes without explicit receiver, the first identifier IS the method
  if (!receiver) {
    // This is a direct method call like `foo()` or `include Bar` (already handled above)
    // The method name is the first identifier
    const sourceNode = findEnclosingRubyNode(tree, line, col, filePath, nodeMap);
    if (!sourceNode) return;

    const fromSymbol = sourceNode.scipSymbol;
    const sourceScope = getScopeFromSymbol(sourceNode.scipSymbol);
    const isSingleton = positionIsInSingletonContext(tree, line, col);

    const { target: targetNode, isAmbiguous } = resolveCallTarget(
      methodName,
      sourceScope,
      isSingleton,
      index,
      filePath,
    );

    const toSymbol = targetNode?.scipSymbol ?? `ruby:${methodName}`;
    addRef(sourceNode, targetNode, filePath, line, col, fromSymbol, toSymbol);

    const dedupeKey = `${filePath}:${fromSymbol}|${toSymbol}|${EdgeKind.CALLS}`;
    if (edgeDedup.has(dedupeKey)) return;
    edgeDedup.add(dedupeKey);

    edges.push({
      kind: EdgeKind.CALLS,
      fromFile: filePath,
      fromName: sourceNode.name,
      fromSymbol,
      toText: methodName,
      toFile: targetNode?.filePath ?? null,
      toName: methodName,
      toSymbol,
      isExternal: !targetNode,
      isAmbiguous,
      edgePosition: { line, col },
      isOptionalChain: false,
      isAsync: false,
    });
    return;
  }
  // Dynamic receiver — skip (no edge emitted)
}

function getScopeFromSymbol(symbol: string): string | null {
  const parsed = parseRubySymbol(symbol);
  return parsed?.scope ?? null;
}

function processBareIdentifier(
  identNode: NodeWrapper,
  localVars: Set<string>,
  tree: TreeWrapper,
  filePath: string,
  index: ScopeIndex,
  nodeMap: Map<string, AnalysisNode>,
  edges: AnalysisEdge[],
  edgeDedup: Set<string>,
): void {
  const methodName = identNode.text;

  // Skip if it's a local variable reference
  if (isLocalVariableReference(identNode, localVars)) return;

  const line = identNode.startPosition.row;
  const col = identNode.startPosition.column;

  const sourceNode = findEnclosingRubyNode(tree, line, col, filePath, nodeMap);
  if (!sourceNode) return;

  const fromSymbol = sourceNode.scipSymbol;
  const sourceScope = getScopeFromSymbol(sourceNode.scipSymbol);
  const isSingleton = positionIsInSingletonContext(tree, line, col);

  const { target: targetNode, isAmbiguous } = resolveCallTarget(
    methodName,
    sourceScope,
    isSingleton,
    index,
    filePath,
  );

  const toSymbol = targetNode?.scipSymbol ?? `ruby:${methodName}`;
  addRef(sourceNode, targetNode, filePath, line, col, fromSymbol, toSymbol);

  const dedupeKey = `${filePath}:${fromSymbol}|${toSymbol}|${EdgeKind.CALLS}`;
  if (edgeDedup.has(dedupeKey)) return;
  edgeDedup.add(dedupeKey);

  edges.push({
    kind: EdgeKind.CALLS,
    fromFile: filePath,
    fromName: sourceNode.name,
    fromSymbol,
    toText: methodName,
    toFile: targetNode?.filePath ?? null,
    toName: methodName,
    toSymbol,
    isExternal: !targetNode,
    isAmbiguous,
    edgePosition: { line, col },
    isOptionalChain: false,
    isAsync: false,
  });
}