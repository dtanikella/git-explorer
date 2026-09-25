import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import type { NodeWrapper } from '@/lib/tree-sitter/node';
import {
  SyntaxType,
  type AnalysisNode,
  type ParamInfo,
} from '@/lib/analysis/types';
import { qualifySymbol } from '@/app/services/analysis/shared/symbol-utils';

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
  method_definition: SyntaxType.METHOD,
  class_declaration: SyntaxType.CLASS,
  interface_declaration: SyntaxType.INTERFACE,
  type_alias_declaration: SyntaxType.TYPE_ALIAS,
  enum_declaration: SyntaxType.ENUM,
  internal_module: SyntaxType.NAMESPACE,
};

// method_definition nodes that need reclassifying past the generic METHOD mapping.
const METHOD_LIKE_TYPES = new Set<SyntaxType>([
  SyntaxType.FUNCTION,
  SyntaxType.METHOD,
  SyntaxType.GETTER,
  SyntaxType.SETTER,
  SyntaxType.CONSTRUCTOR,
]);

/**
 * Classifies a method_definition node as CONSTRUCTOR, GETTER, SETTER, or
 * METHOD based on its name and child node types.
 *
 * @param declNode - The method_definition AST node.
 * @param name - The method name text.
 * @returns The appropriate {@link SyntaxType}.
 */
function classifyMethodDefinition(declNode: NodeWrapper, name: string): SyntaxType {
  if (name === 'constructor') return SyntaxType.CONSTRUCTOR;
  for (const child of declNode.children) {
    if (child.type === 'get') return SyntaxType.GETTER;
    if (child.type === 'set') return SyntaxType.SETTER;
  }
  return SyntaxType.METHOD;
}

// ============================================================================
// Position Helpers
// ============================================================================

type ScipDefLookup = Map<string, { symbol: string }>; // key: "line:col"

/**
 * Builds a lookup map from SCIP occurrence position to symbol, filtering
 * to only definition occurrences.
 *
 * @param occurrences - SCIP occurrence array with range and symbol data.
 * @returns A map keyed by `"line:col"` to the symbol string.
 */
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

/**
 * Gets the identifier text from a node's `name` child field.
 *
 * @param node - The AST node with a `name` child field.
 * @returns The name text, or null if no name field exists.
 */
function getIdentifierName(node: NodeWrapper): string | null {
  const nameChild = node.childForFieldName('name');
  return nameChild ? nameChild.text : null;
}

/**
 * Checks whether a node is wrapped in an `export_statement`.
 *
 * @param node - The node to check.
 * @returns True when the parent is an export statement.
 */
function isExported(node: NodeWrapper): boolean {
  const parent = node.parent;
  if (!parent) return false;
  return parent.type === 'export_statement';
}

/**
 * Checks whether a node has an `async` modifier child.
 *
 * @param node - The node to check.
 * @returns True when a child node has type `async`.
 */
function isAsyncFunction(node: NodeWrapper): boolean {
  for (const child of node.children) {
    if (child.type === 'async') return true;
  }
  return false;
}

/**
 * Extracts parameter information from a function-like node.
 *
 * @param node - The function-like AST node with a `parameters` child.
 * @returns An array of {@link ParamInfo} with names and optional types.
 */
function extractParams(node: NodeWrapper): ParamInfo[] {
  const params: ParamInfo[] = [];
  const paramsNode = node.childForFieldName('parameters');
  if (!paramsNode) return params;

  for (const child of paramsNode.namedChildren) {
    if (child.type === 'required_parameter' || child.type === 'optional_parameter') {
      const nameNode = child.childForFieldName('pattern') ?? child.childForFieldName('name');
      const typeNode = child.childForFieldName('type');
      // typeNode text includes the leading colon; get the inner type text
      const typeText = typeNode ? typeNode.firstNamedChild?.text ?? typeNode.text : null;
      params.push({
        name: nameNode?.text ?? '',
        typeText,
        isOptional: child.type === 'optional_parameter',
      });
    }
  }
  return params;
}

/**
 * Extracts the return type annotation text from a function-like node.
 *
 * @param node - The function-like AST node.
 * @returns The type text, or null if no return type annotation exists.
 */
function extractReturnType(node: NodeWrapper): string | null {
  const returnType = node.childForFieldName('return_type');
  if (!returnType) return null;
  // return_type node includes the colon; the actual type is the first named child
  const typeNode = returnType.firstNamedChild;
  return typeNode ? typeNode.text : returnType.text;
}

// ============================================================================
// Main Extraction
// ============================================================================

/**
 * Extracts analysis nodes from a set of parsed TypeScript files using
 * tree-sitter ASTs and SCIP occurrence data.
 *
 * @remarks
 * For each file, walks the tree-sitter AST to find function, method,
 * class, interface, type alias, and module declarations. Nodes are enriched
 * with SCIP symbol data (references, parameter info) when available.
 * Symbols without a corresponding SCIP document are still extracted as
 * basic nodes from the AST.
 *
 * @param input - The parsed files, SCIP documents, and language config.
 * @returns An object with `nodes` array and a symbol-to-node map.
 * @see commit 3c938d7
 */
export function extractNodes(input: NodeExtractionInput): NodeExtractionOutput {
  const nodes: AnalysisNode[] = [];
  const nodeMap = new Map<string, AnalysisNode>();

  for (const scipDoc of input.scipDocuments) {
    const filePath = scipDoc.relativePath;
    const parsed = input.parsedFiles.get(filePath);
    if (!parsed) continue;

    const defLookup = buildScipDefLookup(scipDoc.occurrences);
    const { tree } = parsed;

    walkDeclarations(tree.rootNode, filePath, defLookup, nodes, nodeMap);
  }

  return { nodes, nodeMap };
}

/**
 * Walks all declaration-type descendant nodes in a tree-sitter AST and
 * builds analysis nodes for each one.
 *
 * @param rootNode - The root tree-sitter node of a parsed file.
 * @param filePath - The file path for node metadata.
 * @param defLookup - SCIP definition lookup built by {@link buildScipDefLookup}.
 * @param nodes - Output array, mutated in place.
 * @param nodeMap - Output map, mutated in place.
 */
function walkDeclarations(
  rootNode: NodeWrapper,
  filePath: string,
  defLookup: ScipDefLookup,
  nodes: AnalysisNode[],
  nodeMap: Map<string, AnalysisNode>,
): void {
  const declarationTypes = Object.keys(DECLARATION_TYPES);
  const allDeclarations = rootNode.descendantsOfType(declarationTypes);

  for (const declNode of allDeclarations) {
    const mappedType = DECLARATION_TYPES[declNode.type];
    if (!mappedType) continue;

    const name = getIdentifierName(declNode);
    if (!name) continue;

    const syntaxType = declNode.type === 'method_definition'
      ? classifyMethodDefinition(declNode, name)
      : mappedType;

    const nameNode = declNode.childForFieldName('name');
    if (!nameNode) continue;

    const line = nameNode.startPosition.row;
    const col = nameNode.startPosition.column;
    const scipDef = defLookup.get(`${line}:${col}`);
    const scipSymbol = qualifySymbol(filePath, scipDef?.symbol ?? '');
    if (scipSymbol === null) continue;

    const isMethodLike = METHOD_LIKE_TYPES.has(syntaxType);
    const node: AnalysisNode = {
      syntaxType,
      name,
      filePath,
      startLine: line,
      startCol: col,
      isAsync: isMethodLike ? isAsyncFunction(declNode) : false,
      isExported: isExported(declNode),
      params: isMethodLike ? extractParams(declNode) : [],
      returnTypeText: isMethodLike ? extractReturnType(declNode) : null,
      scipSymbol,
      isDefinition: true,
      inTestFile: false,
      referencedAt: [],
      outboundRefs: [],
    };

    nodes.push(node);
    nodeMap.set(scipSymbol, node);
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
    const scipSymbol = qualifySymbol(filePath, scipDef?.symbol ?? '');
    if (scipSymbol === null) continue;

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
    nodeMap.set(scipSymbol, node);
  }

  // Plain variable/constant declarations: const FOO = ...
  // (arrow-function-valued declarators are already captured above as FUNCTION;
  // destructuring patterns are skipped since they have no single symbol name)
  const variableDeclarators = rootNode.descendantsOfType(['variable_declarator']);
  for (const varNode of variableDeclarators) {
    const valueNode = varNode.childForFieldName('value');
    if (valueNode?.type === 'arrow_function') continue;

    const nameNode = varNode.childForFieldName('name');
    if (!nameNode || nameNode.type !== 'identifier') continue;

    const name = nameNode.text;
    const line = nameNode.startPosition.row;
    const col = nameNode.startPosition.column;
    const scipDef = defLookup.get(`${line}:${col}`);
    const scipSymbol = qualifySymbol(filePath, scipDef?.symbol ?? '');
    if (scipSymbol === null) continue;

    const declaration = varNode.parent; // variable_declaration / lexical_declaration
    const exported = declaration?.parent?.type === 'export_statement';

    const node: AnalysisNode = {
      syntaxType: SyntaxType.VARIABLE,
      name,
      filePath,
      startLine: line,
      startCol: col,
      isAsync: false,
      isExported: exported ?? false,
      params: [],
      returnTypeText: null,
      scipSymbol,
      isDefinition: true,
      inTestFile: false,
      referencedAt: [],
      outboundRefs: [],
    };

    nodes.push(node);
    nodeMap.set(scipSymbol, node);
  }

  // Decorators (@Component, @Injectable(), ...): these reference an existing
  // declaration rather than defining a new symbol, so there's no SCIP
  // definition to look up — synthesize a position-qualified id instead,
  // mirroring the `${filePath}#local N` convention for local scip symbols.
  const decorators = rootNode.descendantsOfType(['decorator']);
  for (const decNode of decorators) {
    const nameChild = decNode.namedChildren[0];
    const callee = nameChild?.type === 'call_expression' ? nameChild.childForFieldName('function') : null;
    const name = (callee ?? nameChild)?.text ?? decNode.text.replace(/^@/, '');
    const line = decNode.startPosition.row;
    const col = decNode.startPosition.column;
    const scipSymbol = qualifySymbol(filePath, `local decorator ${line}:${col}`);
    if (scipSymbol === null) continue;

    const node: AnalysisNode = {
      syntaxType: SyntaxType.DECORATOR,
      name,
      filePath,
      startLine: line,
      startCol: col,
      isAsync: false,
      isExported: false,
      params: [],
      returnTypeText: null,
      scipSymbol,
      isDefinition: false,
      inTestFile: false,
      referencedAt: [],
      outboundRefs: [],
    };

    nodes.push(node);
    nodeMap.set(scipSymbol, node);
  }
}
