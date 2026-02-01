import { fileSizeStrategy, uniformStrategy } from '../../lib/strategies/sizing';
import { FileNode } from '../../lib/types';

describe('sizing strategies', () => {
  const mockFileNode: FileNode = {
    path: '/test/file.txt',
    name: 'file.txt',
    type: 'file',
    size: 100,
    extension: '.txt',
    metadata: {},
  };

  const mockFolderNode: FileNode = {
    path: '/test/folder',
    name: 'folder',
    type: 'folder',
    size: 500,
    extension: '',
    children: [mockFileNode],
    metadata: {},
  };

  describe('fileSizeStrategy', () => {
    it('should return the file size for files', () => {
      expect(fileSizeStrategy(mockFileNode)).toBe(100);
    });

    it('should return the folder size for folders', () => {
      expect(fileSizeStrategy(mockFolderNode)).toBe(500);
    });
  });

  describe('uniformStrategy', () => {
    it('should return 1 for any node', () => {
      expect(uniformStrategy(mockFileNode)).toBe(1);
      expect(uniformStrategy(mockFolderNode)).toBe(1);
    });
  });
});