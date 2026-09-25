/**
 * Top-level analysis controller: detects language and dispatches to
 * the appropriate language-specific pipeline.
 *
 * @remarks
 * Consumed by the repo-analysis API route. Delegates to
 * {@link analyzeTsRepo} or {@link analyzeRubyRepo} based on language
 * detection.
 *
 * @packageDocumentation
 */
import * as fs from 'fs/promises';
import type { AnalysisResult } from '@/lib/analysis/types';
import { AnalysisError, UnsupportedLanguageError } from '@/lib/analysis/types';
import { detectLanguage } from './language-detector';
import { analyzeTsRepo } from './ts/controller';
import { analyzeRubyRepo } from './ruby/controller';

export interface AnalysisOptions {
  hideTestFiles?: boolean;
}

/**
 * Runs the full analysis pipeline for a repository: detects language,
 * delegates to the language-specific controller, and returns the result.
 *
 * @remarks
 * Validates the path exists, detects the language (TypeScript or Ruby),
 * and calls the appropriate sub-controller.
 *
 * @param repoPath - Absolute path to the git repository root.
 * @param options - Optional analysis options (e.g., `hideTestFiles`).
 * @returns The full {@link AnalysisResult} with nodes, edges, and metadata.
 * @throws {@link AnalysisError} When the path does not exist.
 * @throws {@link UnsupportedLanguageError} When language cannot be detected.
 * @see commit 4dff751
 */
export async function analyzeRepo(
  repoPath: string,
  options?: AnalysisOptions,
): Promise<AnalysisResult> {
  const hideTestFiles = options?.hideTestFiles ?? true;

  // Validate repoPath exists
  try {
    await fs.access(repoPath);
  } catch {
    throw new AnalysisError(`Repository path does not exist: ${repoPath}`, repoPath);
  }

  // Detect language
  const language = await detectLanguage(repoPath);
  if (!language) {
    throw new UnsupportedLanguageError(repoPath);
  }

  // Delegate to language-specific controller
  switch (language) {
    case 'typescript':
      return analyzeTsRepo(repoPath, { hideTestFiles });
    case 'ruby':
      return analyzeRubyRepo(repoPath, { hideTestFiles });
    default:
      throw new UnsupportedLanguageError(repoPath);
  }
}
