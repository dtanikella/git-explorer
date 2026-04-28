import * as fs from 'fs/promises';
import * as path from 'path';

export type SupportedLanguage = 'typescript';

export async function detectLanguage(repoPath: string): Promise<SupportedLanguage | null> {
  const tsconfigPath = path.join(repoPath, 'tsconfig.json');
  try {
    await fs.access(tsconfigPath);
    return 'typescript';
  } catch {
    return null;
  }
}
