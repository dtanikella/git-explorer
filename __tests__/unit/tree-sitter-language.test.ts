/**
 * @jest-environment node
 */
import { loadLanguage, clearLanguageCache } from '@/lib/tree-sitter/language';
import { TreeSitterLanguageError } from '@/lib/tree-sitter/types';

describe('tree-sitter language loader', () => {
  afterEach(() => {
    clearLanguageCache();
  });

  it('loads the typescript grammar', () => {
    const lang = loadLanguage('typescript');
    expect(lang).toBeDefined();
    expect(typeof lang).toBe('object');
  });

  it('loads the tsx grammar', () => {
    const lang = loadLanguage('tsx');
    expect(lang).toBeDefined();
  });

  it('returns the same instance on repeated loads (caching)', () => {
    const lang1 = loadLanguage('typescript');
    const lang2 = loadLanguage('typescript');
    expect(lang1).toBe(lang2);
  });

  it('throws TreeSitterLanguageError for unknown language', () => {
    expect(() => loadLanguage('unknown-lang-xyz')).toThrow(TreeSitterLanguageError);
  });

  it('error includes the language name', () => {
    try {
      loadLanguage('brainfuck');
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TreeSitterLanguageError);
      expect((err as TreeSitterLanguageError).languageName).toBe('brainfuck');
    }
  });
});
