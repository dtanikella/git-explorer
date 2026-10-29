import * as path from 'path';
import { getCurrentHead } from '@/lib/scip/cache';

// Bodies for a large repo run to tens of MB, so keep just enough for both "hide test files" states.
const MAX_ENTRIES = 2;
const entries = new Map<string, string>();

/**
 * Builds the response cache key for an analysis request.
 *
 * @remarks
 * Keyed on HEAD, the same rule the SCIP index cache uses: uncommitted edits do not invalidate it.
 *
 * @param repoPath - Path the analysis was requested for.
 * @param hideTestFiles - Whether test files are excluded.
 * @returns The key, or null when HEAD can't be resolved (the request then isn't cached).
 */
export async function responseCacheKey(repoPath: string, hideTestFiles: boolean): Promise<string | null> {
  try {
    const head = await getCurrentHead(repoPath);
    return `${path.resolve(repoPath)}\0${head}\0${hideTestFiles}`;
  } catch {
    return null;
  }
}

/**
 * Returns a cached serialized response body and marks it most recently used.
 *
 * @param key - Key from {@link responseCacheKey}.
 * @returns The body, or undefined on a miss.
 */
export function getCachedResponse(key: string): string | undefined {
  const body = entries.get(key);
  if (body !== undefined) {
    entries.delete(key);
    entries.set(key, body);
  }
  return body;
}

/**
 * Stores a serialized response body, evicting the least recently used entry when full.
 *
 * @param key - Key from {@link responseCacheKey}.
 * @param body - The JSON response body.
 */
export function setCachedResponse(key: string, body: string): void {
  entries.delete(key);
  entries.set(key, body);
  while (entries.size > MAX_ENTRIES) {
    entries.delete(entries.keys().next().value as string);
  }
}

/** Empties the cache. */
export function clearResponseCache(): void {
  entries.clear();
}
