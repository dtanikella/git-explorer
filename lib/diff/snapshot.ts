import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { analyzeRepo, type AnalysisOptions } from '@/app/services/analysis/controller';
import type { AnalysisResult } from '@/lib/analysis/types';

/**
 * Analyze the repo as it was at one commit.
 *
 * Commands:
 * 1. `git -C <repo> worktree add --detach <tmpdir> <sha>`
 * 2. `ln -s <repo>/node_modules <tmpdir>/node_modules` (when node_modules exists)
 * 3. Seed the SCIP cache when the checkout's cache matches
 * 4. `analyzeRepo(<tmpdir>, options)`
 * 5. Cleanup: `git -C <repo> worktree remove --force <tmpdir>`, `git -C <repo> worktree prune`
 *
 * Seed rule: when <repo>/.git-explorer/cache-meta.json has headSha === sha,
 * <repo>/.git-explorer/index.scip exists, and `git -C <repo> status --porcelain -- '*.ts' '*.tsx'`
 * prints nothing, copy both files into <tmpdir>/.git-explorer/ so getCachedIndex finds them.
 *
 * @param repoPath absolute path of the user's checkout
 * @param sha resolved commit SHA
 * @param options passed through to analyzeRepo (hideTestFiles, etc.)
 */
export async function analyzeCommit(
  repoPath: string,
  sha: string,
  options?: AnalysisOptions,
): Promise<AnalysisResult> {
  // Create a temporary directory for the worktree
  const tmpWorktree = fsSync.mkdtempSync(join(tmpdir(), 'git-explorer-snapshot-'));

  try {
    // 1. Create the detached worktree
    execFileSync('git', ['worktree', 'add', '--detach', tmpWorktree, sha], {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // 2. Symlink node_modules if it exists in the main checkout
    const mainNodeModules = join(repoPath, 'node_modules');
    try {
      await fs.access(mainNodeModules);
      // Use relative symlink so it survives across different mount points
      await fs.symlink(mainNodeModules, join(tmpWorktree, 'node_modules'));
    } catch {
      // node_modules doesn't exist or symlink failed - proceed without it
    }

    // 3. Seed the SCIP cache
    await seedCache(repoPath, sha, tmpWorktree);

    // 4. Run analysis on the worktree
    const result = await analyzeRepo(tmpWorktree, options);

    // Fix the repoPath in metadata back to the real repo path
    result.metadata.repoPath = repoPath;

    return result;
  } finally {
    // 5. Cleanup: remove worktree and prune
    try {
      execFileSync('git', ['worktree', 'remove', '--force', tmpWorktree], {
        cwd: repoPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // Best effort cleanup
    }
    try {
      execFileSync('git', ['worktree', 'prune'], {
        cwd: repoPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // Best effort cleanup
    }

    // Also try to remove the tmp directory if worktree removal didn't do it
    try {
      await fs.rm(tmpWorktree, { recursive: true, force: true });
    } catch {
      // Best effort
    }
  }
}

/**
 * Seed the SCIP cache from the main checkout into the temp worktree
 * when the checkout's HEAD matches the requested commit and the repo is clean.
 */
async function seedCache(
  repoPath: string,
  sha: string,
  tmpWorktree: string,
): Promise<void> {
  // Read cache-meta.json from the main checkout
  let meta: { headSha: string } | null = null;
  try {
    const raw = await fs.readFile(join(repoPath, '.git-explorer', 'cache-meta.json'), 'utf8');
    meta = JSON.parse(raw);
  } catch {
    return; // no cache to seed
  }

  // Check if the cached index matches the requested SHA
  if (!meta || meta.headSha !== sha) return;

  // Check that index.scip exists
  try {
    await fs.access(join(repoPath, '.git-explorer', 'index.scip'));
  } catch {
    return;
  }

  // Check that the repo has no uncommitted changes to .ts/.tsx files
  try {
    const status = execFileSync(
      'git',
      ['status', '--porcelain', '--', '*.ts', '*.tsx'],
      { cwd: repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    if (status.length > 0) return; // uncommitted changes, don't seed
  } catch {
    return;
  }

  // Copy the cache into the temp worktree
  const tmpCacheDir = join(tmpWorktree, '.git-explorer');
  try {
    await fs.mkdir(tmpCacheDir, { recursive: true });
    await fs.copyFile(
      join(repoPath, '.git-explorer', 'index.scip'),
      join(tmpCacheDir, 'index.scip'),
    );
    await fs.copyFile(
      join(repoPath, '.git-explorer', 'cache-meta.json'),
      join(tmpCacheDir, 'cache-meta.json'),
    );
  } catch {
    // Seeding is best-effort
  }
}