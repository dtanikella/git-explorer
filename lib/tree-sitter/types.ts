/**
 * Tree-sitter types, interfaces, and error classes for Git Explorer.
 * Re-exports core types from tree-sitter.
 */

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Thrown when a tree-sitter parse operation fails.
 *
 * @remarks
 * Carries a snippet of the source text that caused the parse failure
 * and the language name for diagnostic context.
 */
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

/**
 * Thrown when a tree-sitter language module cannot be loaded.
 *
 * @remarks
 * Carries the language name and the optional grammar module path
 * for diagnostic context.
 */
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

/**
 * Thrown when a tree-sitter query pattern is invalid.
 *
 * @remarks
 * Carries the pattern text and language name for diagnostic context.
 */
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

/**
 * The result of parsing a source file with tree-sitter.
 *
 * @remarks
 * Wraps the parsed tree, a flag for parse errors, and the language
 * identifier used for parsing.
 */
export interface ParseResult {
  tree: import('./tree').TreeWrapper;
  hasErrors: boolean;
  language: string;
}

// ============================================================================
// Re-exports from tree-sitter
// ============================================================================

export type { default as Parser } from 'tree-sitter';
