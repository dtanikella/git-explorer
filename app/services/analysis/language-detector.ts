import * as fs from 'fs/promises';
import * as path from 'path';

export type SupportedLanguage = 'typescript' | 'ruby';

/**
 * Detects the primary language of a repository by probing for well-known
 * configuration files.
 *
 * @remarks
 * Checks for `tsconfig.json` (TypeScript) first, then `Gemfile` (Ruby).
 * Returns null when neither is found. This is a heuristic only — a monorepo
 * with both files would be classified as TypeScript because the tsconfig
 * check runs first.
 *
 * @param repoPath - Absolute path to the repository root.
 * @returns `'typescript'`, `'ruby'`, or `null` if unknown.
 * @see commit d938660
 */
export async function detectLanguage(repoPath: string): Promise<SupportedLanguage | null> {
  const tsconfigPath = path.join(repoPath, 'tsconfig.json');
  try {
    await fs.access(tsconfigPath);
    return 'typescript';
  } catch {
    // No tsconfig.json — try Ruby heuristic
  }

  const gemfilePath = path.join(repoPath, 'Gemfile');
  try {
    await fs.access(gemfilePath);
    return 'ruby';
  } catch {
    return null;
  }
}
