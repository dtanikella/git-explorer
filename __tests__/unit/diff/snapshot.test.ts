/** @jest-environment node */

import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { analyzeCommit } from '@/lib/diff/snapshot';

// Mock analyzeRepo
jest.mock('@/app/services/analysis/controller', () => ({
  analyzeRepo: jest.fn(),
}));

const mockAnalyzeRepo = jest.requireMock('@/app/services/analysis/controller').analyzeRepo as jest.Mock;

describe('analyzeCommit', () => {
  let repoDir: string;
  let sha: string;

  beforeAll(() => {
    // Create a temp git repo with a TS file
    repoDir = mkdtempSync(join(tmpdir(), 'git-explorer-snapshot-test-'));
    execFileSync('git', ['init'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir, stdio: 'pipe' });

    writeFileSync(join(repoDir, 'test.ts'), 'export const x = 1;\n', 'utf8');
    execFileSync('git', ['add', 'test.ts'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: repoDir, stdio: 'pipe' });
    sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    }).trim();
  });

  afterAll(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    mockAnalyzeRepo.mockReset();
    mockAnalyzeRepo.mockResolvedValue({
      nodes: [],
      edges: [],
      metadata: { repoPath: '', nodeCount: 0, edgeCount: 0, analysisDurationMs: 0, missingNodeTypes: [], missingEdgeKinds: [] },
    });
  });

  it('creates and removes a worktree, leaving repo clean', async () => {
    // Check initial state
    const initialWorktrees = execFileSync('git', ['worktree', 'list'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    });
    const initialStatus = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    }).trim();

    await analyzeCommit(repoDir, sha, { hideTestFiles: true });

    // Check final state - same as initial
    const finalWorktrees = execFileSync('git', ['worktree', 'list'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    });
    const finalStatus = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    }).trim();

    expect(finalWorktrees).toBe(initialWorktrees);
    expect(finalStatus).toBe(initialStatus);
  });

  it('cleans up when analyzeRepo throws', async () => {
    mockAnalyzeRepo.mockRejectedValue(new Error('analysis failed'));

    const initialWorktrees = execFileSync('git', ['worktree', 'list'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    });

    await expect(
      analyzeCommit(repoDir, sha),
    ).rejects.toThrow('analysis failed');

    const finalWorktrees = execFileSync('git', ['worktree', 'list'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    });

    expect(finalWorktrees).toBe(initialWorktrees);
  });

  it('fixes repoPath in metadata', async () => {
    mockAnalyzeRepo.mockResolvedValue({
      nodes: [],
      edges: [],
      metadata: {
        repoPath: '/tmp/some-worktree',
        nodeCount: 0,
        edgeCount: 0,
        analysisDurationMs: 10,
        missingNodeTypes: [],
        missingEdgeKinds: [],
      },
    });

    const result = await analyzeCommit(repoDir, sha);
    expect(result.metadata.repoPath).toBe(repoDir);
  });
});