import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IndexResult, IndexOptions, ScipIndexError } from '../types';
import { getCachedIndex, saveCachedIndex } from '../cache';

const DEFAULT_TIMEOUT = 60_000;

function resolveScipBinary(): string {
  // Construct path manually to avoid Turbopack mangling require.resolve()
  return path.join(
    process.cwd(),
    'node_modules',
    '@sourcegraph',
    'scip-typescript',
    'dist',
    'src',
    'main.js',
  );
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

/**
 * Indexes a TypeScript repository by running the `scip-typescript` CLI
 * as a subprocess, with optional caching and timeout.
 *
 * @remarks
 * Checks the cache first (unless `forceReindex` is true). If no valid
 * cached index exists, resolves the `scip-typescript` binary and spawns
 * it to produce an index file at `.git-explorer/index.scip`. The caller
 * is responsible for saving the result to the long-term cache via
 * {@link saveCachedIndex}.
 *
 * @param repoPath - Absolute path to the git repository root.
 * @param options - Optional indexing options (force reindex, custom timeout).
 * @returns An {@link IndexResult} with the output path and cache hit status.
 * @throws When the `scip-typescript` binary cannot be found or the subprocess
 *   exits with a non-zero code.
 * @see {@link getCachedIndex}
 * @see {@link saveCachedIndex}
 * @see commit 96945e0
 */
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
