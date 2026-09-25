// ============================================================================
// Enums
// ============================================================================

/**
 * Classifies the syntactic role of an analysis node. Each value corresponds
 * to a tree-sitter AST node type or a SCIP symbol kind.
 *
 * @remarks
 * Values come from the tree-sitter and SCIP extraction pipelines. The
 * visualization layer uses these to determine node color, icon, and
 * filtering behavior.
 *
 * @see commit 3c938d7
 */
export enum SyntaxType {
  FUNCTION = 'FUNCTION',
  METHOD = 'METHOD',
  CLASS = 'CLASS',
  INTERFACE = 'INTERFACE',
  TYPE_ALIAS = 'TYPE_ALIAS',
  MODULE = 'MODULE',
  ENUM = 'ENUM',
  VARIABLE = 'VARIABLE',
  NAMESPACE = 'NAMESPACE',
  DECORATOR = 'DECORATOR',
  GETTER = 'GETTER',
  SETTER = 'SETTER',
  CONSTRUCTOR = 'CONSTRUCTOR',
}

/**
 * Classifies the kind of relationship between two analysis nodes.
 *
 * @remarks
 * Values are determined by the edge extraction pipeline from
 * tree-sitter AST and SCIP occurrence data. Ruby-only kinds like
 * INCLUDES are produced by the Ruby extractor.
 *
 * @see commit 3c938d7
 */
export enum EdgeKind {
  /**
   * A symbol is a call target.
   * @see commit 3c938d7
   */
  CALLS = 'CALLS',

/**
 * A symbol instantiates another symbol via `new`.
 */
  INSTANTIATES = 'INSTANTIATES',

/**
 * A symbol references a type (interface/type alias).
 */
  USES_TYPE = 'USES_TYPE',

/**
 * A symbol imports another symbol.
 */
  IMPORTS = 'IMPORTS',

/**
 * A symbol extends a class or interface.
 */
  EXTENDS = 'EXTENDS',

/**
 * A symbol implements an interface.
 */
  IMPLEMENTS = 'IMPLEMENTS',

/**
 * A symbol includes/extend a Ruby module.
 */
  INCLUDES = 'INCLUDES',
  // NOT YET INCLUDED: OVERRIDES, DECORATES, RETURNS_TYPE, THROWS, GENERIC_PARAM
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Describes a function/method parameter.
 */
export interface ParamInfo {
  name: string;
  typeText: string | null;
  isOptional: boolean;
}

/**
 * Describes a single reference to a SCIP symbol from a file location.
 *
 * @remarks
 * Each reference maps a source position to the SCIP symbol it refers to.
 * Used to build cross-file reference counts and edge relationships.
 */
export interface ReferenceLocation {
  filePath: string;
  line: number;
  col: number;
  scipSymbol: string;
}

/**
 * A single symbol in the analysis graph: a declaration extracted from
 * source code with its metadata and cross-file references.
 *
 * @remarks
 * Produced by the node extraction pipeline (TypeScript or Ruby).
 * The node carries its tree-sitter derived syntax type, SCIP symbol
 * for cross-referencing, positions, and arrays of inbound/outbound
 * references used for graph layout.
 */
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

/**
 * A directed relationship between two analysis nodes.
 *
 * @remarks
 * Produced by the edge extraction pipeline. The edge kind classifies
 * the relationship (call, extends, implements, etc.). An edge is
 * `isExternal` when the target belongs to a different package or is
 * outside the analyzed project.
 */
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
  isAmbiguous: boolean;
  edgePosition: { line: number; col: number };
  isOptionalChain: boolean;
  isAsync: boolean;
}

/**
 * Metadata about an analysis run.
 *
 * @remarks
 * Includes the repo path, language, counts of nodes and edges, the
 * wall-clock duration, and lists of syntax types or edge kinds that
 * were encountered but are not yet handled by the extractors.
 */
export interface AnalysisMetadata {
  repoPath: string;
  language: string;
  nodeCount: number;
  edgeCount: number;
  analysisDurationMs: number;
  missingNodeTypes: string[];
  missingEdgeKinds: string[];
}

/**
 * The complete output of a repository analysis.
 */
export interface AnalysisResult {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  metadata: AnalysisMetadata;
}

// ============================================================================
// Documented Gaps (for metadata.missingNodeTypes / missingEdgeKinds)
// ============================================================================

/**
 * Syntax types that were found during extraction but are not yet handled
 * by the node or edge extractors. These are reported in
 * {@link AnalysisMetadata.missingNodeTypes} so the UI can surface gaps.
 */
export const MISSING_NODE_TYPES = [
  'ENUM', 'VARIABLE', 'NAMESPACE', 'DECORATOR', 'GETTER', 'SETTER', 'CONSTRUCTOR',
];

/**
 * Edge kinds that were found in SCIP data but are not yet extracted.
 * Listed in {@link AnalysisMetadata.missingEdgeKinds} to surface gaps.
 */
export const MISSING_EDGE_KINDS = [
  'OVERRIDES', 'DECORATES', 'RETURNS_TYPE', 'THROWS', 'GENERIC_PARAM',
];

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base class for all analysis pipeline errors.
 *
 * @remarks
 * Thrown by the analysis controller and language-specific extractors.
 * Carries the repo path for diagnostic context.
 */
export class AnalysisError extends Error {
  readonly name: string = 'AnalysisError';

  constructor(
    message: string,
    readonly repoPath: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, AnalysisError.prototype);
  }
}

/**
 * Thrown when no supported language can be detected for a repository.
 *
 * @remarks
 * Produced by the analysis controller when {@link detectLanguage}
 * returns null.
 */
export class UnsupportedLanguageError extends AnalysisError {
  declare readonly name: string;

  constructor(repoPath: string) {
    super(`No supported language detected in ${repoPath}`, repoPath);
    this.name = 'UnsupportedLanguageError';
    Object.setPrototypeOf(this, UnsupportedLanguageError.prototype);
  }
}

/**
 * Thrown when the node extraction pipeline encounters an error.
 *
 * @remarks
 * Carries the file path and phase (parsing, extraction, etc.) where
 * the error occurred.
 */
export class NodeExtractionError extends AnalysisError {
  declare readonly name: string;

  constructor(
    message: string,
    repoPath: string,
    readonly filePath: string,
    readonly phase: string,
  ) {
    super(message, repoPath);
    this.name = 'NodeExtractionError';
    Object.setPrototypeOf(this, NodeExtractionError.prototype);
  }
}

/**
 * Thrown when the edge extraction pipeline encounters an error.
 *
 * @remarks
 * Carries the file path where the error occurred.
 */
export class EdgeExtractionError extends AnalysisError {
  declare readonly name: string;

  constructor(
    message: string,
    repoPath: string,
    readonly filePath: string,
    readonly phase: string,
  ) {
    super(message, repoPath);
    this.name = 'EdgeExtractionError';
    Object.setPrototypeOf(this, EdgeExtractionError.prototype);
  }
}
