import { extensionColorStrategy, typeColorStrategy } from '../../lib/strategies/coloring';
import { FileNode } from '../../lib/types';

describe('coloring strategies', () => {
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

  describe('extensionColorStrategy', () => {
    it('should return correct color for TypeScript files', () => {
      const tsNode = { ...mockFileNode, extension: '.ts' };
      expect(extensionColorStrategy(tsNode)).toBe('#3178c6');

      const tsxNode = { ...mockFileNode, extension: '.tsx' };
      expect(extensionColorStrategy(tsxNode)).toBe('#3178c6');
    });

    it('should return correct color for JavaScript files', () => {
      const jsNode = { ...mockFileNode, extension: '.js' };
      expect(extensionColorStrategy(jsNode)).toBe('#f7df1e');

      const jsxNode = { ...mockFileNode, extension: '.jsx' };
      expect(extensionColorStrategy(jsxNode)).toBe('#f7df1e');
    });

    it('should return correct color for CSS files', () => {
      const cssNode = { ...mockFileNode, extension: '.css' };
      expect(extensionColorStrategy(cssNode)).toBe('#663399');

      const scssNode = { ...mockFileNode, extension: '.scss' };
      expect(extensionColorStrategy(scssNode)).toBe('#663399');
    });

    it('should return correct color for JSON files', () => {
      const jsonNode = { ...mockFileNode, extension: '.json' };
      expect(extensionColorStrategy(jsonNode)).toBe('#f5a623');
    });

    it('should return correct color for Markdown files', () => {
      const mdNode = { ...mockFileNode, extension: '.md' };
      expect(extensionColorStrategy(mdNode)).toBe('#00d4aa');
    });

    it('should return correct color for HTML files', () => {
      const htmlNode = { ...mockFileNode, extension: '.html' };
      expect(extensionColorStrategy(htmlNode)).toBe('#e34c26');
    });

    it('should return correct color for YAML files', () => {
      const ymlNode = { ...mockFileNode, extension: '.yml' };
      expect(extensionColorStrategy(ymlNode)).toBe('#cb171e');

      const yamlNode = { ...mockFileNode, extension: '.yaml' };
      expect(extensionColorStrategy(yamlNode)).toBe('#cb171e');
    });

    it('should return correct color for Python files', () => {
      const pyNode = { ...mockFileNode, extension: '.py' };
      expect(extensionColorStrategy(pyNode)).toBe('#3572a5');
    });

    it('should return correct color for Ruby files', () => {
      const rbNode = { ...mockFileNode, extension: '.rb' };
      expect(extensionColorStrategy(rbNode)).toBe('#cc342d');
    });

    it('should return correct color for Go files', () => {
      const goNode = { ...mockFileNode, extension: '.go' };
      expect(extensionColorStrategy(goNode)).toBe('#00add8');
    });

    it('should return correct color for Rust files', () => {
      const rsNode = { ...mockFileNode, extension: '.rs' };
      expect(extensionColorStrategy(rsNode)).toBe('#dea584');
    });

    it('should return gray for unknown extensions', () => {
      const unknownNode = { ...mockFileNode, extension: '.unknown' };
      expect(extensionColorStrategy(unknownNode)).toBe('#8b8b8b');
    });

    it('should return gray for folders', () => {
      expect(extensionColorStrategy(mockFolderNode)).toBe('#8b8b8b');
    });
  });

  describe('typeColorStrategy', () => {
    it('should return blue for files', () => {
      expect(typeColorStrategy(mockFileNode)).toBe('#3178c6');
    });

    it('should return light gray for folders', () => {
      expect(typeColorStrategy(mockFolderNode)).toBe('#e0e0e0');
    });
  });
});