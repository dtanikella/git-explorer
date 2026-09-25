/** @jest-environment node */

import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock the test file detector
jest.mock('@/app/services/analysis/test-file-detector', () => ({
  isTestFile: jest.fn((path: string) => /\.test\.(ts|tsx)$/.test(path)),
}));

describe('listChangedTsFiles', () => {
  let repoDir: string;
  let baseSha: string;
  let compareSha: string;

  beforeAll(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'git-explorer-diff-test-'));
    execFileSync('git', ['init'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir, stdio: 'pipe' });

    // Base commit
    writeFileSync(join(repoDir, 'added.ts'), 'export const added = 1;\n', 'utf8');
    writeFileSync(join(repoDir, 'deleted.ts'), 'export const deleted = 1;\n', 'utf8');
    writeFileSync(join(repoDir, 'modified.ts'), 'export const old = 1;\n', 'utf8');
    writeFileSync(join(repoDir, 'renamed.ts'), 'export const renamed = 1;\n', 'utf8');
    writeFileSync(join(repoDir, 'foo.test.ts'), 'export const test = 1;\n', 'utf8');
    writeFileSync(join(repoDir, 'readme.md'), '# Readme\n', 'utf8');

    execFileSync('git', ['add', '-A'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'base'], { cwd: repoDir, stdio: 'pipe' });
    baseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    }).trim();

    // Compare commit
    // Delete deleted.ts
    execFileSync('git', ['rm', 'deleted.ts'], { cwd: repoDir, stdio: 'pipe' });
    // Modify modified.ts
    writeFileSync(join(repoDir, 'modified.ts'), 'export const changed = 2;\n', 'utf8');
    // Rename: delete renamed.ts, create new.ts
    execFileSync('git', ['rm', 'renamed.ts'], { cwd: repoDir, stdio: 'pipe' });
    writeFileSync(join(repoDir, 'new.ts'), 'export const renamed = 1;\n', 'utf8');
    // Modify foo.test.ts
    writeFileSync(join(repoDir, 'foo.test.ts'), 'export const test = 2;\n', 'utf8');

    execFileSync('git', ['add', '-A'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'compare'], { cwd: repoDir, stdio: 'pipe' });
    compareSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    }).trim();
  });

  afterAll(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('returns correct files: one added, one delete+rename, one modified, test hidden', async () => {
    const { listChangedTsFiles } = await import('@/lib/diff/git-diff');
    const files = await listChangedTsFiles(repoDir, baseSha, compareSha, {
      hideTestFiles: true,
    });

    const added = files.filter(f => f.status === 'added');
    const deleted = files.filter(f => f.status === 'deleted');
    const modified = files.filter(f => f.status === 'modified');

    // new.ts is added
    expect(added).toHaveLength(1);
    expect(added[0].path).toBe('new.ts');
    expect(added[0].newSource).toBeDefined();
    expect(added[0].oldSource).toBeUndefined();

    // deleted.ts and renamed.ts (rename source) are deleted = 2
    expect(deleted).toHaveLength(2);
    const deletedPaths = deleted.map(f => f.path).sort();
    expect(deletedPaths).toEqual(['deleted.ts', 'renamed.ts']);
    deleted.forEach(f => {
      expect(f.oldSource).toBeDefined();
      expect(f.newSource).toBeUndefined();
    });

    // modified.ts is modified
    expect(modified).toHaveLength(1);
    expect(modified[0].path).toBe('modified.ts');
    expect(modified[0].oldSource).toBeDefined();
    expect(modified[0].newSource).toBeDefined();

    // foo.test.ts should be hidden
    const testFiles = files.filter(f => f.path.includes('foo.test'));
    expect(testFiles).toHaveLength(0);

    // readme.md should not appear
    const mdFiles = files.filter(f => f.path === 'readme.md');
    expect(mdFiles).toHaveLength(0);
  });

  it('includes test files when hideTestFiles is false', async () => {
    const { listChangedTsFiles } = await import('@/lib/diff/git-diff');
    const files = await listChangedTsFiles(repoDir, baseSha, compareSha, {
      hideTestFiles: false,
    });

    const testFiles = files.filter(f => f.path.includes('foo.test'));
    expect(testFiles.length).toBeGreaterThan(0);
  });

  it('handles rename as delete + add', async () => {
    const { listChangedTsFiles } = await import('@/lib/diff/git-diff');
    const files = await listChangedTsFiles(repoDir, baseSha, compareSha, {
      hideTestFiles: true,
    });

    const deletedPaths = files.filter(f => f.status === 'deleted').map(f => f.path);
    const addedPaths = files.filter(f => f.status === 'added').map(f => f.path);

    expect(deletedPaths).toContain('renamed.ts');
    expect(addedPaths).toContain('new.ts');
  });
});

describe('runDifftastic', () => {
  it('throws DifftUnavailableError with DIFFT_MISSING code when difft missing', async () => {
    const { runDifftastic, DifftUnavailableError } = await import('@/lib/diff/difftastic');

    const origPath = process.env.DIFFT_PATH;
    process.env.DIFFT_PATH = '/nonexistent/difft';

    let caught: any;
    try {
      await runDifftastic('const x = 1;', 'const x = 2;', '.ts');
    } catch (e: any) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(DifftUnavailableError);
    expect(caught.code).toBe('DIFFT_MISSING');

    process.env.DIFFT_PATH = origPath;
  });
});