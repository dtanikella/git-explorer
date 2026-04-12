import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ts-analysis/route';

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200,
    })),
  },
}));

// Mock fs
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
  },
}));

const mockAccess = require('fs').promises.access;

// Mock the analyzer
jest.mock('@/lib/ts/analyzer', () => ({
  analyzeTypeScriptRepo: jest.fn(),
}));

const mockAnalyzeTypeScriptRepo = require('@/lib/ts/analyzer').analyzeTypeScriptRepo;

describe('POST /api/ts-analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockReset();
  });

  it('returns 400 when repoPath is missing', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
  });

  it('returns 404 when repo path does not exist', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({ repoPath: '/nonexistent' }),
    } as unknown as NextRequest;

    mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
  });

  it('returns 400 when tsconfig.json is missing', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({ repoPath: '/some/repo' }),
    } as unknown as NextRequest;

    mockAccess.mockImplementation((path) => {
      if (path === '/some/repo') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toContain('tsconfig.json');
  });

  it('returns graph data on success', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({ repoPath: '/some/repo' }),
    } as unknown as NextRequest;

    mockAccess.mockResolvedValue(undefined);

    const mockData = {
      nodes: [
        {
          id: 'file:index.ts',
          kind: 'FILE',
          parent: null,
          children: [],
          siblings: [],
          name: 'index.ts',
          path: '/repo/index.ts',
          fileType: 'ts',
        },
      ],
      edges: [],
    };
    mockAnalyzeTypeScriptRepo.mockReturnValue(mockData);

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.nodeCount).toBe(1);
    expect(result.metadata.edgeCount).toBe(0);
    expect(typeof result.metadata.analysisDurationMs).toBe('number');
  });

  it('returns 500 on analyzer error', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({ repoPath: '/some/repo' }),
    } as unknown as NextRequest;

    mockAccess.mockResolvedValue(undefined);
    mockAnalyzeTypeScriptRepo.mockImplementation(() => {
      throw new Error('Compiler error');
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
  });

  // T017
  it('[T017] hideTestFiles:true is passed to analyzer and response excludes test nodes', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({ repoPath: '/some/repo', hideTestFiles: true }),
    } as unknown as NextRequest;

    mockAccess.mockResolvedValue(undefined);

    const mockData = {
      nodes: [
        {
          id: 'file:src/index.ts',
          kind: 'FILE',
          parent: 'folder:src',
          children: [],
          siblings: [],
          name: 'index.ts',
          path: '/some/repo/src/index.ts',
          fileType: 'ts',
        },
      ],
      edges: [],
    };
    mockAnalyzeTypeScriptRepo.mockReturnValue(mockData);

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(mockAnalyzeTypeScriptRepo).toHaveBeenCalledWith('/some/repo', { hideTestFiles: true });

    const testFileNodes = result.data.nodes.filter(
      (n: { kind: string; id: string }) =>
        n.kind === 'FILE' &&
        (n.id.includes('.test.') || n.id.includes('.spec.') || n.id.includes('__tests__'))
    );
    expect(testFileNodes.length).toBe(0);
  });

  // T018
  it('[T018] hideTestFiles:false is passed to analyzer and response includes test nodes', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({ repoPath: '/some/repo', hideTestFiles: false }),
    } as unknown as NextRequest;

    mockAccess.mockResolvedValue(undefined);

    const mockData = {
      nodes: [
        {
          id: 'file:src/utils.test.ts',
          kind: 'FILE',
          parent: 'folder:src',
          children: [],
          siblings: [],
          name: 'utils.test.ts',
          path: '/some/repo/src/utils.test.ts',
          fileType: 'ts',
        },
      ],
      edges: [],
    };
    mockAnalyzeTypeScriptRepo.mockReturnValue(mockData);

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(mockAnalyzeTypeScriptRepo).toHaveBeenCalledWith('/some/repo', { hideTestFiles: false });

    const testFileNodes = result.data.nodes.filter(
      (n: { kind: string; id: string }) =>
        n.kind === 'FILE' &&
        (n.id.includes('.test.') || n.id.includes('.spec.') || n.id.includes('__tests__'))
    );
    expect(testFileNodes.length).toBeGreaterThan(0);
  });
});
