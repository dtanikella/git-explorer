import * as fs from 'fs/promises';
import * as path from 'path';

export type SupportedLanguage = 'typescript' | 'ruby';

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
