/**
 * @jest-environment node
 */
import { POST } from '@/app/api/areas/generate/route';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateAreaFile } from '@/lib/areas/types';
import type { AnalysisNode, AnalysisEdge, AnalysisResult } from '@/lib/analysis/types';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';

const mockAnalyzeRepo = jest.fn();
jest.mock('@/app/services/analysis/controller', () => ({
  analyzeRepo: (...args: unknown[]) => mockAnalyzeRepo(...args),
}));

import * as hierarchyModule from '@/lib/analysis/communities/hierarchy';

function makeNode(id: string): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name: id,
    filePath: `/src/${id}.ts`,
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: id,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  };
}

function makeEdge(from: string, to: string): AnalysisEdge {
  return {
    kind: EdgeKind.CALLS,
    fromFile: `/src/${from}.ts`,
    fromName: from,
    fromSymbol: from,
    toText: to,
    toFile: `/src/${to}.ts`,
    toName: to,
    toSymbol: to,
    isExternal: false,
    edgePosition: { line: 1, col: 0 },
    isOptionalChain: false,
    isAsync: false,
  };
}

/** Two disjoint, fully-connected triangles — a clean 2-community graph. */
function makeAnalysis() {
  return {
    nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map(makeNode),
    edges: [
      makeEdge('a', 'b'), makeEdge('a', 'c'), makeEdge('b', 'c'),
      makeEdge('d', 'e'), makeEdge('d', 'f'), makeEdge('e', 'f'),
    ],
    metadata: {
      repoPath: '/x',
      language: 'typescript',
      nodeCount: 6,
      edgeCount: 6,
      analysisDurationMs: 1,
      missingNodeTypes: [],
      missingEdgeKinds: [],
    },
  } as AnalysisResult;
}

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/areas/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/areas/generate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'areas-generate-test-'));
    fs.mkdirSync(path.join(tmpDir, '.git'));
    mockAnalyzeRepo.mockReset();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns 200 with a valid Area[] payload and persists it through the saved file layout', async () => {
    mockAnalyzeRepo.mockResolvedValue(makeAnalysis());

    const res = await POST(makeRequest({ repoPath: tmpDir }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.version).toBe(1);
    expect(Array.isArray(json.data.areas)).toBe(true);
    expect(json.data.areas.length).toBeGreaterThan(0);
    expect(validateAreaFile(json.data).valid).toBe(true);

    // Same on-disk layout as the existing save action.
    const filePath = path.join(tmpDir, '.git-explorer', 'areas.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(onDisk.version).toBe(1);
    expect(onDisk.areas.length).toBe(json.data.areas.length);
  });

  it('keeps Area ids stable across two regeneration runs on unchanged analysis', async () => {
    mockAnalyzeRepo.mockResolvedValue(makeAnalysis());

    const first = await (await POST(makeRequest({ repoPath: tmpDir }))).json();
    const second = await (await POST(makeRequest({ repoPath: tmpDir }))).json();

    const firstIds = (first.data.areas as Array<{ id: string }>).map((a) => a.id).sort();
    const secondIds = (second.data.areas as Array<{ id: string }>).map((a) => a.id).sort();
    expect(secondIds).toEqual(firstIds);
    expect(secondIds.length).toBeGreaterThan(0);
  });

  it('returns a non-200 error and does not persist anything when generation throws', async () => {
    mockAnalyzeRepo.mockResolvedValue(makeAnalysis());
    const spy = jest
      .spyOn(hierarchyModule, 'buildHierarchy')
      .mockImplementation(() => {
        throw new Error('simulated detection failure');
      });

    const res = await POST(makeRequest({ repoPath: tmpDir }));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.success).toBe(false);

    // The existing areas.json must be left untouched — here it never got created.
    expect(fs.existsSync(path.join(tmpDir, '.git-explorer', 'areas.json'))).toBe(false);
    spy.mockRestore();
  });

  it('rejects repoPath without a .git directory', async () => {
    const noGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-git-'));
    const res = await POST(makeRequest({ repoPath: noGitDir }));
    expect(res.status).toBe(400);
    fs.rmSync(noGitDir, { recursive: true, force: true });
  });
});