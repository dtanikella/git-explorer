import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import type { NodeWrapper } from '@/lib/tree-sitter/node';
import {
  SyntaxType,
  type AnalysisNode,
  type ParamInfo,
} from '@/lib/analysis/types';
import { qualifySymbol } from '@/app/services/analysis/shared/symbol-utils';

// ============================================================================
// Constants
// ============================================================================

/**
 * Mapping of tree-sitter node types to internal SyntaxType.
 * Only these Ruby node types produce AnalysisNodes.
 */
const DECLARATION_TYPES: Record<string, SyntaxType> = {
  method: SyntaxType.METHOD,
  singleton_method: SyntaxType.METHOD,
  class: SyntaxType.CLASS,
  module: SyntaxType.MODULE,
};

/**
 * The four macro forms that synthesize getter/setter METHOD nodes.
 * Only plain identifier send (no explicit receiver) at class-body level is handled.
 */
const ACCESSOR_MACROS = new Set(['attr_accessor', 'attr_reader', 'attr_writer', 'attr']);

// ============================================================================
// Scope stack
// ============================================================================

interface ScopeFrame {
  name: string;    // qualified name of this scope (e.g. "Foo::Bar")
  kind: 'class' | 'module';
}

/**
 * Build a fully-qualified path string from a chain of scope frames.
 * Joins with "::".
 */
function qualifyScopePath(scopeStack: ScopeFrame[]): string {
  return scopeStack.map(f => f.name).join('::');
}

/**
 * Extract the full text of a class/module name field, handling both
 * simple `constant` nodes and compact `scope_resolution` nodes
 * (e.g. `Foo::Bar` in `class Foo::Bar < Baz`).
 */
function flattenClassName(nameNode: NodeWrapper): string | null {
  if (nameNode.type === 'constant') {
    return nameNode.text;
  }
  if (nameNode.type === 'scope_resolution') {
    // Recursively collect constant parts (e.g. "Foo::Bar::Baz")
    const parts: string[] = [];
    const collect = (node: NodeWrapper): void => {
      if (node.type === 'constant') {
        parts.push(node.text);
      } else if (node.type === 'scope_resolution') {
        // Left side is either a constant or another scope_resolution
        const scope = node.childForFieldName('scope');
        const name = node.childForFieldName('name');
        if (scope) collect(scope);
        if (name) parts.push(name.text);
      }
    };
    collect(nameNode);
    return parts.length > 0 ? parts.join('::') : null;
  }
  return null; // unexpected node type
}

// ============================================================================
// Accessor macro synthesis
// ============================================================================

/**
 * Given a `call` node for `attr_accessor :foo, :bar`, extract the symbol
 * arguments and return their string names.
 * Works for `attr_accessor`, `attr_reader`, `attr_writer`, and `attr`.
 */
function extractAccessorNames(callNode: NodeWrapper): string[] {
  const args = callNode.childForFieldName('arguments');
  if (!args) return [];

  const names: string[] = [];
  for (const child of args.children) {
    // tree-sitter-ruby represents :foo as `simple_symbol` with text ":foo"
    if (child.type === 'simple_symbol') {
      // Strip leading colon
      const name = child.text.startsWith(':') ? child.text.slice(1) : child.text;
      if (name.length > 0) names.push(name);
    }
  }
  return names;
}

/**
 * Check whether a `call` node at class-body level is one of the four
 * accessor macros with no explicit receiver (i.e. called on `self` implicitly).
 */
function isAccessorMacro(callNode: NodeWrapper): boolean {
  const methodChild = callNode.childForFieldName('method');
  if (!methodChild || methodChild.type !== 'identifier') return false;
  return ACCESSOR_MACROS.has(methodChild.text);
}

// ============================================================================
// Position Helpers
// ============================================================================

/**
 * For Ruby we use a generated symbol based on the scope-qualified path,
 * since there's no SCIP index. Format: `ruby:<filePath>#<qualifiedName>`.
 */
function makeRubySymbol(filePath: string, qualifiedName: string): string {
  return `ruby:${filePath}#${qualifiedName}`;
}

// ============================================================================
// AST Helpers
// ============================================================================

/**
 * Get method/singleton_method name from its `name` field.
 */
function getMethodName(node: NodeWrapper): string | null {
  const nameChild = node.childForFieldName('name');
  if (!nameChild) return null;
  // For `def foo`, nameChild is `identifier` with text "foo"
  // For `def self.foo`, this is still the identifier "foo"
  if (nameChild.type === 'identifier' || nameChild.type === 'constant') {
    return nameChild.text;
  }
  return nameChild.text ?? null;
}

/**
 * Check whether a `method` node is inside a `singleton_class` node
 * (i.e. `class << self; def foo; end; end`).
 */
function isInsideSingletonClass(node: NodeWrapper): boolean {
  let current = node.parent;
  while (current) {
    if (current.type === 'singleton_class') return true;
    if (current.type === 'class' || current.type === 'module') return false;
    current = current.parent;
  }
  return false;
}

/**
 * Extract parameters from a method/singleton_method node.
 * Ruby parameters can be: identifier (required), optional_parameter,
 * rest_parameter, keyword_parameter, block_parameter, etc.
 */
function extractParams(node: NodeWrapper): ParamInfo[] {
  const params: ParamInfo[] = [];
  const paramsNode = node.childForFieldName('parameters');
  if (!paramsNode) return params;

  for (const child of paramsNode.namedChildren) {
    // Common parameter types in Ruby
    if (
      child.type === 'identifier' ||
      child.type === 'optional_parameter' ||
      child.type === 'splat_parameter' ||
      child.type === 'keyword_parameter' ||
      child.type === 'block_parameter'
    ) {
      // For simple identifier, the node itself is the name
      let name: string;
      if (child.type === 'identifier') {
        name = child.text;
      } else {
        const nameChild = child.childForFieldName('name');
        name = nameChild?.text ?? child.text;
      }
      params.push({
        name: name ?? '',
        typeText: null, // Ruby has no static type annotations in AST
        isOptional: child.type === 'optional_parameter',
      });
    }
  }
  return params;
}

// ============================================================================
// Main Extraction
// ============================================================================

export interface RubyNodeExtractionInput {
  parsedFiles: Map<string, { tree: TreeWrapper; source: string }>;
  repoPath: string;
}

export interface RubyNodeExtractionOutput {
  nodes: AnalysisNode[];
  nodeMap: Map<string, AnalysisNode>;
}

export function extractRubyNodes(input: RubyNodeExtractionInput): RubyNodeExtractionOutput {
  const nodes: AnalysisNode[] = [];
  const nodeMap = new Map<string, AnalysisNode>();

  for (const [filePath, parsed] of input.parsedFiles) {
    const { tree } = parsed;
    const scopeStack: ScopeFrame[] = [];
    const inSingletonClass: boolean[] = []; // parallel to scopeStack

    walkRubyDeclarations(tree.rootNode, filePath, scopeStack, inSingletonClass, nodes, nodeMap);
  }

  return { nodes, nodeMap };
}

function walkRubyDeclarations(
  node: NodeWrapper,
  filePath: string,
  scopeStack: ScopeFrame[],
  inSingletonClass: boolean[],
  nodes: AnalysisNode[],
  nodeMap: Map<string, AnalysisNode>,
): void {
  const syntaxType = DECLARATION_TYPES[node.type];

  if (syntaxType) {
    processDeclaration(node, filePath, syntaxType, scopeStack, inSingletonClass, nodes, nodeMap);
  }

  // Handle singleton_class (class << self) — it's not a declaration itself
  // but methods inside it should be treated as singleton methods
  if (node.type === 'singleton_class') {
    const body = node.childForFieldName('body');
    if (body) {
      inSingletonClass.push(true);
      for (const child of body.children) {
        walkRubyDeclarations(child, filePath, scopeStack, inSingletonClass, nodes, nodeMap);
      }
      inSingletonClass.pop();
      return;
    }
  }

  // Handle accessor macros in class/module body
  if (node.type === 'call' && isAccessorMacro(node)) {
    processAccessorMacro(node, filePath, scopeStack, nodes, nodeMap);
    return; // don't walk into the accessor call's children
  }

  // Recurse into body of classes/modules
  if ((node.type === 'class' || node.type === 'module') && syntaxType) {
    const body = node.childForFieldName('body');
    if (body) {
      for (const child of body.children) {
        walkRubyDeclarations(child, filePath, scopeStack, inSingletonClass, nodes, nodeMap);
      }
    }
    return; // scope already managed in processDeclaration above
  }

  // General recursion for other node types
  for (const child of node.children) {
    walkRubyDeclarations(child, filePath, scopeStack, inSingletonClass, nodes, nodeMap);
  }
}

function processDeclaration(
  declNode: NodeWrapper,
  filePath: string,
  syntaxType: SyntaxType,
  scopeStack: ScopeFrame[],
  inSingletonClass: boolean[],
  nodes: AnalysisNode[],
  nodeMap: Map<string, AnalysisNode>,
): void {
  if (syntaxType === SyntaxType.CLASS || syntaxType === SyntaxType.MODULE) {
    const nameNode = declNode.childForFieldName('name');
    if (!nameNode) return;

    const className = flattenClassName(nameNode);
    if (!className) return;

    // Build full scope path for this class/module
    const parentScope = qualifyScopePath(scopeStack);
    const qualifiedName = parentScope ? `${parentScope}::${className}` : className;

    // For compact class paths (Foo::Bar), use the simple name (Bar) for the node name
    const simpleName = className.includes('::') ? className.split('::').pop()! : className;

    const line = nameNode.startPosition.row;
    const col = nameNode.startPosition.column;

    const symbol = makeRubySymbol(filePath, qualifiedName);

    const node: AnalysisNode = {
      syntaxType,
      name: simpleName,
      filePath,
      startLine: line,
      startCol: col,
      isAsync: false,
      isExported: false,
      params: [],
      returnTypeText: null,
      scipSymbol: symbol,
      isDefinition: true,
      inTestFile: false,
      referencedAt: [],
      outboundRefs: [],
    };

    nodes.push(node);
    nodeMap.set(symbol, node);

    // Push scope and recurse into body
    scopeStack.push({ name: className, kind: syntaxType === SyntaxType.CLASS ? 'class' : 'module' });
    inSingletonClass.push(false);

    const body = declNode.childForFieldName('body');
    if (body) {
      for (const child of body.children) {
        walkRubyDeclarations(child, filePath, scopeStack, inSingletonClass, nodes, nodeMap);
      }
    }

    scopeStack.pop();
    inSingletonClass.pop();
  }

  if (syntaxType === SyntaxType.METHOD) {
    processMethodNode(declNode, filePath, scopeStack, inSingletonClass, nodes, nodeMap);
  }
}

function processMethodNode(
  methodNode: NodeWrapper,
  filePath: string,
  scopeStack: ScopeFrame[],
  inSingletonClass: boolean[],
  nodes: AnalysisNode[],
  nodeMap: Map<string, AnalysisNode>,
): void {
  const name = getMethodName(methodNode);
  if (!name) return;

  const nameChild = methodNode.childForFieldName('name');
  if (!nameChild) return;

  // Determine whether this is a singleton method
  let isSingleton = methodNode.type === 'singleton_method';

  // Also check if inside a singleton_class (class << self)
  if (!isSingleton && inSingletonClass.length > 0 && inSingletonClass[inSingletonClass.length - 1]) {
    isSingleton = true;
  }

  // Build qualified name
  const scopePath = qualifyScopePath(scopeStack);
  const separator = isSingleton ? '.' : '#';
  const qualifiedName = scopePath ? `${scopePath}${separator}${name}` : name;

  const line = nameChild.startPosition.row;
  const col = nameChild.startPosition.column;

  const symbol = makeRubySymbol(filePath, qualifiedName);

  const node: AnalysisNode = {
    syntaxType: SyntaxType.METHOD,
    name,
    filePath,
    startLine: line,
    startCol: col,
    isAsync: false,
    isExported: false,
    params: extractParams(methodNode),
    returnTypeText: null,
    scipSymbol: symbol,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  };

  nodes.push(node);
  nodeMap.set(symbol, node);
}

function processAccessorMacro(
  callNode: NodeWrapper,
  filePath: string,
  scopeStack: ScopeFrame[],
  nodes: AnalysisNode[],
  nodeMap: Map<string, AnalysisNode>,
): void {
  const methodChild = callNode.childForFieldName('method');
  if (!methodChild) return;

  const macroName = methodChild.text;
  const names = extractAccessorNames(callNode);
  if (names.length === 0) return;

  // The method name determines what kind of accessor to synthesize.
  // attr_accessor → both reader and writer (getter and setter)
  // attr_reader → reader only (METHOD)
  // attr_writer → writer only (METHOD)
  // attr → reader only by convention, unless followed by accessor flag
  //   (We simplify: treat plain `attr` as reader only, same as attr_reader)
  const isWriter = macroName === 'attr_accessor' || macroName === 'attr_writer';

  const scopePath = qualifyScopePath(scopeStack);

  for (const attrName of names) {
    // Synthesize reader method
    const readerQualified = scopePath ? `${scopePath}#${attrName}` : attrName;
    const readerSymbol = makeRubySymbol(filePath, readerQualified);

    if (!nodeMap.has(readerSymbol)) {
      const readerNode: AnalysisNode = {
        syntaxType: SyntaxType.METHOD,
        name: attrName,
        filePath,
        startLine: callNode.startPosition.row,
        startCol: callNode.startPosition.column,
        isAsync: false,
        isExported: false,
        params: [],
        returnTypeText: null,
        scipSymbol: readerSymbol,
        isDefinition: true,
        inTestFile: false,
        referencedAt: [],
        outboundRefs: [],
      };
      nodes.push(readerNode);
      nodeMap.set(readerSymbol, readerNode);
    }

    // Synthesize writer method for attr_accessor and attr_writer
    if (isWriter) {
      const writerQualified = scopePath ? `${scopePath}#${attrName}=` : `${attrName}=`;
      const writerSymbol = makeRubySymbol(filePath, writerQualified);

      if (!nodeMap.has(writerSymbol)) {
        const writerNode: AnalysisNode = {
          syntaxType: SyntaxType.METHOD,
          name: `${attrName}=`,
          filePath,
          startLine: callNode.startPosition.row,
          startCol: callNode.startPosition.column,
          isAsync: false,
          isExported: false,
          params: [{ name: 'value', typeText: null, isOptional: false }],
          returnTypeText: null,
          scipSymbol: writerSymbol,
          isDefinition: true,
          inTestFile: false,
          referencedAt: [],
          outboundRefs: [],
        };
        nodes.push(writerNode);
        nodeMap.set(writerSymbol, writerNode);
      }
    }
  }
}