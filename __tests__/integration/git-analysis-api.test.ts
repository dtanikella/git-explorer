import { NextRequest } from 'next/server';
import { POST } from '@/app/api/git-analysis/route';

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

// Mock the git analyzer functions
jest.mock('@/lib/git/analyzer', () => ({
  getCommits: jest.fn(),
  countCommitsByFile: jest.fn(),
  filterTopFiles: jest.fn(),
  calculateFrequencyScores: jest.fn(),
}));

jest.mock('@/lib/git/tree-builder', () => ({
  buildTreeFromFiles: jest.fn(),
}));

jest.mock('@/lib/treemap/data-transformer', () => ({
  applyColors: jest.fn(),
}));

jest.mock('@/lib/utils/date-helpers', () => ({
  createTimeRangeConfig: jest.fn(),
}));

const mockGetCommits = require('@/lib/git/analyzer').getCommits;
const mockCountCommitsByFile = require('@/lib/git/analyzer').countCommitsByFile;
const mockFilterTopFiles = require('@/lib/git/analyzer').filterTopFiles;
const mockCalculateFrequencyScores = require('@/lib/git/analyzer').calculateFrequencyScores;
const mockBuildTreeFromFiles = require('@/lib/git/tree-builder').buildTreeFromFiles;
const mockApplyColors = require('@/lib/treemap/data-transformer').applyColors;
const mockCreateTimeRangeConfig = require('@/lib/utils/date-helpers').createTimeRangeConfig;

describe('/api/git-analysis POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockReset();
  });

  it('returns 200 with valid tree data for valid repo', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        repoPath: '/valid/repo',
        timeRange: '2w',
      }),
    } as unknown as NextRequest;

    mockAccess.mockImplementation((path) => {
      if (path === '/valid/repo' || path === '/valid/repo/.git') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('Access denied'));
    });

    mockCreateTimeRangeConfig.mockReturnValue({
      startDate: new Date('2026-01-15T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
      midpoint: new Date('2026-01-23T12:00:00.000Z'),
      label: 'Last 2 weeks',
      preset: '2w',
    });

    mockGetCommits.mockResolvedValue([
      {
        sha: 'abc123',
        date: new Date('2026-01-20T10:00:00.000Z'),
        files: ['src/App.tsx'],
      },
    ]);

    mockCountCommitsByFile.mockReturnValue([
      {
        filePath: 'src/App.tsx',
        totalCommitCount: 1,
        recentCommitCount: 1,
        frequencyScore: 1,
      },
    ]);

    mockFilterTopFiles.mockReturnValue([
      {
        filePath: 'src/App.tsx',
        totalCommitCount: 1,
        recentCommitCount: 1,
        frequencyScore: 1,
      },
    ]);

    mockCalculateFrequencyScores.mockReturnValue([
      {
        filePath: 'src/App.tsx',
        totalCommitCount: 1,
        recentCommitCount: 1,
        frequencyScore: 1,
      },
    ]);

    mockBuildTreeFromFiles.mockReturnValue({
      name: 'root',
      path: '',
      value: 1,
      isFile: false,
      children: [
        {
          name: 'src',
          path: 'src',
          value: 1,
          isFile: false,
          children: [
            {
              name: 'App.tsx',
              path: 'src/App.tsx',
              value: 1,
              isFile: true,
              color: '#006400',
              fileData: {
                filePath: 'src/App.tsx',
                totalCommitCount: 1,
                recentCommitCount: 1,
                frequencyScore: 1,
              },
            },
          ],
        },
      ],
    });

    mockApplyColors.mockReturnValue({
      name: 'root',
      path: '',
      value: 1,
      isFile: false,
      children: [
        {
          name: 'src',
          path: 'src',
          value: 1,
          isFile: false,
          children: [
            {
              name: 'App.tsx',
              path: 'src/App.tsx',
              value: 1,
              isFile: true,
              color: '#006400',
              fileData: {
                filePath: 'src/App.tsx',
                totalCommitCount: 1,
                recentCommitCount: 1,
                frequencyScore: 1,
              },
            },
          ],
        },
      ],
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it('returns 400 for missing repoPath', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        timeRange: '2w',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Repository path is required');
  });

  it('returns 400 for invalid timeRange', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        repoPath: '/repo',
        timeRange: 'invalid',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid time range');
  });

  it('returns 404 for non-existent path', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        repoPath: '/nonexistent',
        timeRange: '2w',
      }),
    } as unknown as NextRequest;

    mockAccess.mockRejectedValue(new Error('Access denied'));

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Repository path does not exist');
  });

  it('returns 400 for non-git directory', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        repoPath: '/not/git',
        timeRange: '2w',
      }),
    } as unknown as NextRequest;

    mockAccess.mockImplementation((path) => {
      if (path === '/not/git') {
        return Promise.resolve();
      }
      return Promise.reject(new Error('Access denied'));
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toBe('The selected folder is not a git repository');
  });
});