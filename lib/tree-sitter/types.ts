/**
 * Tree-sitter types, interfaces, and error classes for Git Explorer.
 * Re-exports core types from tree-sitter.
 */

// ============================================================================
// Error Classes
// ============================================================================

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

export interface ParseResult {
  tree: import('./tree').TreeWrapper;
  hasErrors: boolean;
  language: string;
}

// ============================================================================
// Re-exports from tree-sitter
// ============================================================================

export type { default as Parser } from 'tree-sitter';
