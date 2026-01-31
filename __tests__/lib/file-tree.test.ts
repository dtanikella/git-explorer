import { buildTree } from '../../lib/file-tree';
import { FileTree } from '../../lib/types';

// Mock fs module
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
}));

const mockReaddir = require('fs/promises').readdir as jest.MockedFunction<any>;
const mockStat = require('fs/promises').stat as jest.MockedFunction<any>;

describe('buildTree', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should build a tree structure for a directory with files and subdirectories', async () => {
    // Mock filesystem structure:
    // /test-repo/
    //   ├── file1.txt (100 bytes)
    //   ├── file2.js (200 bytes)
    //   └── src/
    //       └── index.ts (300 bytes)

    mockStat.mockImplementation((path: string) => {
      const stats = {
        isDirectory: () => false,
        size: 0,
      };

      if (path === '/test-repo') {
        stats.isDirectory = () => true;
      } else if (path === '/test-repo/src') {
        stats.isDirectory = () => true;
      } else if (path === '/test-repo/file1.txt') {
        stats.size = 100;
      } else if (path === '/test-repo/file2.js') {
        stats.size = 200;
      } else if (path === '/test-repo/src/index.ts') {
        stats.size = 300;
      }

      return Promise.resolve(stats);
    });

    mockReaddir.mockImplementation((path: string) => {
      if (path === '/test-repo') {
        return Promise.resolve([
          { name: 'file1.txt', isDirectory: () => false },
          { name: 'file2.js', isDirectory: () => false },
          { name: 'src', isDirectory: () => true },
        ]);
      } else if (path === '/test-repo/src') {
        return Promise.resolve([
          { name: 'index.ts', isDirectory: () => false },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await buildTree('/test-repo');

    expect(result).toEqual({
      path: '/test-repo',
      name: 'test-repo',
      type: 'folder',
      size: 600, // 100 + 200 + 300
      extension: '',
      children: [
        {
          path: '/test-repo/file1.txt',
          name: 'file1.txt',
          type: 'file',
          size: 100,
          extension: '.txt',
          metadata: {},
        },
        {
          path: '/test-repo/file2.js',
          name: 'file2.js',
          type: 'file',
          size: 200,
          extension: '.js',
          metadata: {},
        },
        {
          path: '/test-repo/src',
          name: 'src',
          type: 'folder',
          size: 300, // 300
          extension: '',
          children: [
            {
              path: '/test-repo/src/index.ts',
              name: 'index.ts',
              type: 'file',
              size: 300,
              extension: '.ts',
              metadata: {},
            },
          ],
          metadata: {},
        },
      ],
      metadata: {},
    });
  });

  it('should handle empty directories', async () => {
    mockStat.mockResolvedValue({
      isDirectory: () => true,
      size: 0,
    });
    mockReaddir.mockResolvedValue([]);

    const result = await buildTree('/empty-repo');

    expect(result).toEqual({
      path: '/empty-repo',
      name: 'empty-repo',
      type: 'folder',
      size: 0,
      extension: '',
      children: [],
      metadata: {},
    });
  });

  it('should skip hidden files and directories', async () => {
    mockStat.mockImplementation((path: string) => {
      const stats = {
        isDirectory: () => false,
        size: 100,
      };

      if (path === '/test-repo') {
        stats.isDirectory = () => true;
      } else if (path === '/test-repo/.git') {
        stats.isDirectory = () => true;
      }

      return Promise.resolve(stats);
    });

    mockReaddir.mockResolvedValue([
      { name: 'file.txt', isDirectory: () => false },
      { name: '.git', isDirectory: () => true },
      { name: '.DS_Store', isDirectory: () => false },
    ]);

    const result = await buildTree('/test-repo');

    expect(result.children).toHaveLength(1);
    expect(result.children![0].name).toBe('file.txt');
  });
});

describe('FileTree types', () => {
  it('should import types successfully', () => {
    const node: FileTree = {
      path: '/test',
      name: 'test',
      type: 'folder',
      size: 0,
      extension: '',
      children: [],
      metadata: {},
    };
    expect(node.type).toBe('folder');
  });
});