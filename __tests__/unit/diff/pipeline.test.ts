/** @jest-environment node */

import { execFileSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runDiffPipeline } from '@/lib/diff/pipeline';

// Mock the heavy dependencies
jest.mock('@/lib/diff/snapshot', () => ({
  analyzeCommit: jest.fn(),
}));

// Mock difftastic and git-diff to avoid requiring real difft
jest.mock('@/lib/diff/difftastic', () => ({
  DifftUnavailableError: class extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = 'DifftUnavailableError';
    }
  },
  runDifftastic: jest.fn(),
}));

// Mock git-diff's listChangedTsFiles to return results without real difft
jest.mock('@/lib/diff/git-diff', () => ({
  ...jest.requireActual('@/lib/diff/git-diff') as any,
  listChangedTsFiles: jest.fn(),
}));

const mockAnalyzeCommit = jest.requireMock('@/lib/diff/snapshot').analyzeCommit as jest.Mock;
const mockListChangedTsFiles = jest.requireMock('@/lib/diff/git-diff').listChangedTsFiles as jest.Mock;
const mockRunDifftastic = jest.requireMock('@/lib/diff/difftastic').runDifftastic as jest.Mock;

describe('runDiffPipeline', () => {
  let repoDir: string;
  let baseSha: string;
  let compareSha: string;

  beforeAll(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'git-explorer-pipeline-test-'));
    execFileSync('git', ['init'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir, stdio: 'pipe' });

    writeFileSync(join(repoDir, 'test.ts'), 'export function foo() { return 1; }\n', 'utf8');
    execFileSync('git', ['add', 'test.ts'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'base'], { cwd: repoDir, stdio: 'pipe' });
    baseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    }).trim();

    writeFileSync(join(repoDir, 'test.ts'), 'export function foo() { return 2; }\n', 'utf8');
    execFileSync('git', ['add', 'test.ts'], { cwd: repoDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'compare'], { cwd: repoDir, stdio: 'pipe' });
    compareSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoDir, encoding: 'utf8', stdio: 'pipe',
    }).trim();
  });

  afterAll(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockRunDifftastic.mockResolvedValue({
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0]],
      chunks: [[{
        lhs: { line_number: 0, changes: [{ start: 24, end: 25, content: '1', highlight: 'normal' as const }] },
        rhs: { line_number: 0, changes: [{ start: 24, end: 25, content: '2', highlight: 'normal' as const }] },
      }]],
    });

    mockListChangedTsFiles.mockResolvedValue([
      {
        status: 'modified' as const,
        path: 'test.ts',
        ext: '.ts' as const,
        oldSource: 'export function foo() { return 1; }\n',
        newSource: 'export function foo() { return 2; }\n',
        difft: {
          status: 'changed',
          language: 'TypeScript',
          path: 'test.ts',
          aligned_lines: [[0, 0]],
          chunks: [[{
            lhs: { line_number: 0, changes: [{ start: 24, end: 25, content: '1', highlight: 'normal' as const }] },
            rhs: { line_number: 0, changes: [{ start: 24, end: 25, content: '2', highlight: 'normal' as const }] },
          }]],
        },
      },
    ]);

    const makeAnalysis = (repo: string) => Promise.resolve({
      nodes: [{
        syntaxType: 0,
        name: 'foo',
        filePath: 'test.ts',
        startLine: 0,
        startCol: 9,
        isAsync: false,
        isExported: true,
        params: [],
        returnTypeText: null,
        scipSymbol: 'test.ts#local 0',
        isDefinition: true,
        inTestFile: false,
        referencedAt: [],
        outboundRefs: [],
      }],
      edges: [],
      metadata: {
        repoPath,
        language: 'typescript',
        nodeCount: 1,
        edgeCount: 0,
        analysisDurationMs: 10,
        missingNodeTypes: [],
        missingEdgeKinds: [],
      },
    });

    mockAnalyzeCommit.mockImplementation((repo: string) =>
      Promise.resolve({
        nodes: [{
          syntaxType: 0,
          name: 'foo',
          filePath: 'test.ts',
          startLine: 0,
          startCol: 9,
          isAsync: false,
          isExported: true,
          params: [],
          returnTypeText: null,
          scipSymbol: 'test.ts#local 0',
          isDefinition: true,
          inTestFile: false,
          referencedAt: [],
          outboundRefs: [],
        }],
        edges: [],
        metadata: { repoPath: '/tmp', language: 'typescript', nodeCount: 1, edgeCount: 0, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] },
      })
    );
  });

  it('returns ok with non-zero counts for a repo with TS changes', async () => {
    const result = await runDiffPipeline({
      repoPath: repoDir,
      base: baseSha,
      compare: compareSha,
      hideTestFiles: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.state).toBe('ok');
      expect(result.changedFiles).toBe(1);
      expect(result.counts).toBeDefined();
    }
  });

  it('returns no-changes when no TS files changed', async () => {
    mockListChangedTsFiles.mockResolvedValue([]);

    const result = await runDiffPipeline({
      repoPath: repoDir,
      base: baseSha,
      compare: compareSha,
      hideTestFiles: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.state).toBe('no-changes');
      expect(result.changedFiles).toBe(0);
      expect(result.counts.added).toBe(0);
      expect(result.counts.modified).toBe(0);
      expect(result.counts.deleted).toBe(0);
    }
  });

  it('returns BAD_REQUEST when repoPath is missing', async () => {
    const result = await runDiffPipeline({
      repoPath: '',
      base: baseSha,
      compare: compareSha,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('BAD_REQUEST');
    }
  });
});