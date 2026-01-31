import { NextRequest } from 'next/server';

// Mock the file-tree module
jest.mock('../../../lib/file-tree', () => ({
  buildTree: jest.fn(),
}));

import { buildTree } from '../../../lib/file-tree';
import { POST } from '../../../app/api/file-tree/route';

describe('/api/file-tree POST', () => {
  const mockBuildTree = buildTree as jest.MockedFunction<typeof buildTree>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful requests', () => {
    it('should return FileTree JSON for valid directory path', async () => {
      const mockTree = {
        path: '/test/repo',
        name: 'repo',
        type: 'folder' as const,
        size: 1000,
        extension: '',
        children: [
          {
            path: '/test/repo/file1.txt',
            name: 'file1.txt',
            type: 'file' as const,
            size: 100,
            extension: '.txt',
            metadata: {},
          },
        ],
        metadata: {},
      };

      mockBuildTree.mockResolvedValue(mockTree);

      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({ path: '/test/repo' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toEqual({
        success: true,
        data: mockTree,
        stats: {
          totalFiles: 1,
          totalFolders: 1,
          totalSize: 1000,
        },
      });
      expect(mockBuildTree).toHaveBeenCalledWith('/test/repo');
    });

    it('should calculate stats correctly for complex tree', async () => {
      const mockTree = {
        path: '/test/repo',
        name: 'repo',
        type: 'folder' as const,
        size: 5000,
        extension: '',
        children: [
          {
            path: '/test/repo/src',
            name: 'src',
            type: 'folder' as const,
            size: 3000,
            extension: '',
            children: [
              {
                path: '/test/repo/src/index.ts',
                name: 'index.ts',
                type: 'file' as const,
                size: 500,
                extension: '.ts',
                metadata: {},
              },
              {
                path: '/test/repo/src/utils.ts',
                name: 'utils.ts',
                type: 'file' as const,
                size: 300,
                extension: '.ts',
                metadata: {},
              },
            ],
            metadata: {},
          },
          {
            path: '/test/repo/README.md',
            name: 'README.md',
            type: 'file' as const,
            size: 200,
            extension: '.md',
            metadata: {},
          },
        ],
        metadata: {},
      };

      mockBuildTree.mockResolvedValue(mockTree);

      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({ path: '/test/repo' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(result.stats).toEqual({
        totalFiles: 3,
        totalFolders: 2,
        totalSize: 5000,
      });
    });

    it('should trim whitespace from path', async () => {
      const mockTree = {
        path: '/test/repo',
        name: 'repo',
        type: 'folder' as const,
        size: 100,
        extension: '',
        metadata: {},
      };

      mockBuildTree.mockResolvedValue(mockTree);

      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({ path: '  /test/repo  ' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(mockBuildTree).toHaveBeenCalledWith('/test/repo');
    });
  });

  describe('error handling', () => {
    it('should return 400 for empty path', async () => {
      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({ path: '' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result).toEqual({
        success: false,
        error: {
          code: 'EMPTY_PATH',
          message: 'Please enter a path',
        },
      });
      expect(mockBuildTree).not.toHaveBeenCalled();
    });

    it('should return 400 for missing path field', async () => {
      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result).toEqual({
        success: false,
        error: {
          code: 'EMPTY_PATH',
          message: 'Please enter a path',
        },
      });
      expect(mockBuildTree).not.toHaveBeenCalled();
    });

    it('should return 400 for whitespace-only path', async () => {
      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({ path: '   ' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result).toEqual({
        success: false,
        error: {
          code: 'EMPTY_PATH',
          message: 'Please enter a path',
        },
      });
      expect(mockBuildTree).not.toHaveBeenCalled();
    });

    it('should return 400 for path not found', async () => {
      mockBuildTree.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({ path: '/nonexistent/path' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result).toEqual({
        success: false,
        error: {
          code: 'PATH_NOT_FOUND',
          message: 'Path does not exist',
        },
      });
    });

    it('should return 400 for path that is not a directory', async () => {
      mockBuildTree.mockRejectedValue(new Error('ENOTDIR: not a directory'));

      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({ path: '/path/to/file.txt' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result).toEqual({
        success: false,
        error: {
          code: 'NOT_A_DIRECTORY',
          message: 'Path must be a directory',
        },
      });
    });

    it('should return 400 for permission denied', async () => {
      mockBuildTree.mockRejectedValue(new Error('EACCES: permission denied'));

      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({ path: '/restricted/path' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result).toEqual({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Cannot read path: permission denied',
        },
      });
    });

    it('should return 500 for unexpected errors', async () => {
      mockBuildTree.mockRejectedValue(new Error('Unexpected error'));

      const request = new NextRequest('http://localhost:3000/api/file-tree', {
        method: 'POST',
        body: JSON.stringify({ path: '/test/path' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });
  });
});