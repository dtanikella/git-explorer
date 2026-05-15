/**
 * @jest-environment node
 */
import {
  TreeSitterParseError,
  TreeSitterLanguageError,
  TreeSitterQueryError,
  ParseResult,
} from '@/lib/tree-sitter/types';

describe('tree-sitter types', () => {
  describe('TreeSitterParseError', () => {
    it('captures source snippet and language', () => {
      const err = new TreeSitterParseError('parse failed', 'const x =', 'typescript');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TreeSitterParseError);
      expect(err.name).toBe('TreeSitterParseError');
      expect(err.message).toBe('parse failed');
      expect(err.sourceSnippet).toBe('const x =');
      expect(err.language).toBe('typescript');
    });
  });

  describe('TreeSitterLanguageError', () => {
    it('captures language name and optional grammar path', () => {
      const err = new TreeSitterLanguageError('not found', 'rust', '/path/to/grammar');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TreeSitterLanguageError);
      expect(err.name).toBe('TreeSitterLanguageError');
      expect(err.message).toBe('not found');
      expect(err.languageName).toBe('rust');
      expect(err.grammarPath).toBe('/path/to/grammar');
    });

    it('works without grammar path', () => {
      const err = new TreeSitterLanguageError('not found', 'rust');
      expect(err.grammarPath).toBeUndefined();
    });
  });

  describe('TreeSitterQueryError', () => {
    it('captures pattern and language', () => {
      const err = new TreeSitterQueryError('invalid pattern', '(bad_query)', 'typescript');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TreeSitterQueryError);
      expect(err.name).toBe('TreeSitterQueryError');
      expect(err.message).toBe('invalid pattern');
      expect(err.pattern).toBe('(bad_query)');
      expect(err.language).toBe('typescript');
    });
  });

  describe('ParseResult', () => {
    it('has tree, hasErrors, and language fields', () => {
      // Type-level check — just verify the shape compiles
      const result = {
        tree: {} as any,
        hasErrors: false,
        language: 'typescript',
      } satisfies ParseResult;
      expect(result.hasErrors).toBe(false);
      expect(result.language).toBe('typescript');
    });
  });
});
