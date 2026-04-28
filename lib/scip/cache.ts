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

export async function saveCachedIndex(repoPath: string, indexPath: string): Promise<void> {
  const { cacheDir, metaPath } = getCachePaths(repoPath);

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
    const meta: CacheMeta = {
      headSha,
      indexedAt: new Date().toISOString(),
    };
    await fs.writeFile(metaPath, JSON.stringify(meta));
  } catch (err) {
    throw new ScipCacheError(
      `Failed to save cache metadata: ${(err as Error).message}`,
      repoPath,
    );
  }
}

export async function isCacheValid(repoPath: string): Promise<boolean> {
  const result = await getCachedIndex(repoPath);
  return result !== null;
}
