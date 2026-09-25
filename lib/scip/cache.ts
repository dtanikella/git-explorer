import * as fs from 'fs/promises';
import * as path from 'path';
import simpleGit from 'simple-git';
import { CacheResult, ScipCacheError } from './types';

const CACHE_DIR_NAME = '.git-explorer';
const INDEX_FILE_NAME = 'index.scip';
const META_FILE_NAME = 'cache-meta.json';

interface CacheMeta {
  headSha: string;
  indexedAt: string;
}

function getCachePaths(repoPath: string) {
  const cacheDir = path.join(repoPath, CACHE_DIR_NAME);
  return {
    cacheDir,
    indexPath: path.join(cacheDir, INDEX_FILE_NAME),
    metaPath: path.join(cacheDir, META_FILE_NAME),
  };
}

async function getCurrentHead(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);
  return (await git.revparse(['HEAD'])).trim();
}

/**
 * Reads a previously cached SCIP index for the repository, returning null
 * when the cache is absent, invalid, or stale (HEAD mismatch).
 *
 * @remarks
 * Checks that both `cache-meta.json` and `index.scip` exist under
 * `.git-explorer/` and that the saved HEAD SHA matches the current HEAD.
 * If any check fails, returns null (the caller falls through to indexing).
 *
 * @param repoPath - Absolute path to the git repository root.
 * @returns A {@link CacheResult} with the index path and metadata, or null
 *   when the cache is missing or stale.
 * @throws {@link ScipCacheError} Propagated from file system errors.
 * @see commit 7074a17
 */
export async function getCachedIndex(repoPath: string): Promise<CacheResult | null> {
  const { indexPath, metaPath } = getCachePaths(repoPath);

  let meta: CacheMeta;
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    meta = JSON.parse(raw);
  } catch {
    return null;
  }

  let headSha: string;
  try {
    headSha = await getCurrentHead(repoPath);
  } catch {
    return null;
  }

  if (meta.headSha !== headSha) {
    return null;
  }

  try {
    await fs.access(indexPath);
  } catch {
    return null;
  }

  return {
    indexPath,
    headSha: meta.headSha,
    indexedAt: meta.indexedAt,
  };
}

/**
 * Copies a freshly-built SCIP index into the cache directory and writes
 * metadata (HEAD SHA, timestamp) so future reads can validate freshness.
 *
 * @remarks
 * Creates `.git-explorer/` if it does not exist. When `indexPath` already
 * points inside the cache directory (same resolved path), the copy is
 * skipped to avoid self-copying. Always writes/updates `cache-meta.json`.
 *
 * @param repoPath - Absolute path to the git repository root.
 * @param indexPath - Path to the SCIP index file to cache (usually a temp file).
 * @throws {@link ScipCacheError} When the HEAD SHA cannot be resolved, file
 *   operations fail, or the index file is missing after copy.
 * @see commit 7074a17
 */
export async function saveCachedIndex(repoPath: string, indexPath: string): Promise<void> {
  const { cacheDir, indexPath: cachedIndexPath, metaPath } = getCachePaths(repoPath);

  let headSha: string;
  try {
    headSha = await getCurrentHead(repoPath);
  } catch (err) {
    throw new ScipCacheError(
      `Failed to get HEAD SHA: ${(err as Error).message}`,
      repoPath,
    );
  }

  try {
    await fs.mkdir(cacheDir, { recursive: true });

    const resolvedSource = path.resolve(indexPath);
    const resolvedDest = path.resolve(cachedIndexPath);
    if (resolvedSource !== resolvedDest) {
      await fs.copyFile(indexPath, cachedIndexPath);
    }

    // Verify the index file is present before writing metadata
    await fs.access(cachedIndexPath);

    const meta: CacheMeta = {
      headSha,
      indexedAt: new Date().toISOString(),
    };
    await fs.writeFile(metaPath, JSON.stringify(meta));
  } catch (err) {
    if (err instanceof ScipCacheError) throw err;
    throw new ScipCacheError(
      `Failed to save cache: ${(err as Error).message}`,
      repoPath,
    );
  }
}

/**
 * Quick check: returns true when the cached index exists and matches HEAD.
 *
 * @remarks
 * Convenience wrapper around {@link getCachedIndex}. Does not distinguish
 * between "no cache" and "stale cache" — both return false.
 *
 * @param repoPath - Absolute path to the git repository root.
 * @returns True when a valid cached index exists for the current HEAD.
 * @see commit 7074a17
 */
export async function isCacheValid(repoPath: string): Promise<boolean> {
  const result = await getCachedIndex(repoPath);
  return result !== null;
}
