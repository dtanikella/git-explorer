import * as fs from 'fs/promises';
import type { AnalysisResult } from '@/lib/analysis/types';
import { AnalysisError, UnsupportedLanguageError } from '@/lib/analysis/types';
import { detectLanguage } from './language-detector';
import { analyzeTsRepo } from './ts/controller';

export interface AnalysisOptions {
  hideTestFiles?: boolean;
}

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
    default:
      throw new UnsupportedLanguageError(repoPath);
  }
}
