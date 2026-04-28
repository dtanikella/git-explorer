/**
 * SCIP types, interfaces, and error classes for Git Explorer.
 * Re-exports protobuf bindings from @c4312/scip.
 */

// ============================================================================
// Error Classes
// ============================================================================

export class ScipIndexError extends Error {
  readonly name = 'ScipIndexError';

  constructor(
    message: string,
    readonly exitCode: number,
    readonly stderr: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, ScipIndexError.prototype);
  }
}

export class ScipReadError extends Error {
  readonly name = 'ScipReadError';

  constructor(
    message: string,
    readonly filePath: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, ScipReadError.prototype);
  }
}

export class ScipCacheError extends Error {
  readonly name = 'ScipCacheError';

  constructor(
    message: string,
    readonly repoPath: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, ScipCacheError.prototype);
  }
}

// ============================================================================
// Interfaces
// ============================================================================

export interface IndexResult {
  indexPath: string;
  fromCache: boolean;
}

export interface CacheResult {
  indexPath: string;
  headSha: string;
  indexedAt: string;
}

export interface IndexOptions {
  forceReindex?: boolean;
  timeout?: number;
}

// ============================================================================
// Re-exports from @c4312/scip
// ============================================================================

export { deserializeSCIP, serializeSCIP } from '@c4312/scip';
export type {
  IndexSchema,
  DocumentSchema,
  SymbolSchema,
  OccurrenceSchema,
} from '@c4312/scip';
