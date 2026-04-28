import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IndexResult, IndexOptions, ScipIndexError } from '../types';
import { getCachedIndex, saveCachedIndex } from '../cache';

const DEFAULT_TIMEOUT = 60_000;

function resolveScipBinary(): string {
  return require.resolve('@sourcegraph/scip-typescript/dist/src/main.js');
}

function runScipIndex(
  binPath: string,
  outputPath: string,
  repoPath: string,
  timeout: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [binPath, 'index', '--output', outputPath],
      { cwd: repoPath, timeout },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout: stdout as string, stderr: stderr as string });
        }
      },
    );
  });
}

export async function indexTypeScriptRepo(
  repoPath: string,
  options?: IndexOptions,
): Promise<IndexResult> {
  const forceReindex = options?.forceReindex ?? false;
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  if (!forceReindex) {
    const cached = await getCachedIndex(repoPath);
    if (cached) {
      return { indexPath: cached.indexPath, fromCache: true };
    }
  }

  const cacheDir = path.join(repoPath, '.git-explorer');
  const outputPath = path.join(cacheDir, 'index.scip');

  await fs.mkdir(cacheDir, { recursive: true });

  const binPath = resolveScipBinary();

  try {
    await runScipIndex(binPath, outputPath, repoPath, timeout);
  } catch (err: unknown) {
    const error = err as Error & { code?: number };
    throw new ScipIndexError(
      `scip-typescript index failed: ${error.message}`,
      typeof error.code === 'number' ? error.code : 1,
      (err as { stderr?: string }).stderr ?? error.message,
    );
  }

  await saveCachedIndex(repoPath, outputPath);

  return { indexPath: outputPath, fromCache: false };
}
