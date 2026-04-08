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
});
