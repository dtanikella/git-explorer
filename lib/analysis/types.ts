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
