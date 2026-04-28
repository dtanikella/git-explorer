/**
 * @jest-environment node
 */
import { createQuery, QueryWrapper } from '@/lib/tree-sitter/query';
import { createParser } from '@/lib/tree-sitter/parser';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { TreeSitterQueryError } from '@/lib/tree-sitter/types';
import { NodeWrapper } from '@/lib/tree-sitter/node';

describe('QueryWrapper', () => {
  const lang = loadLanguage('typescript');
  const parser = createParser(lang, 'typescript');

  describe('createQuery', () => {
    it('creates a query from a valid pattern', () => {
      const query = createQuery(lang, '(function_declaration name: (identifier) @func.name)');
      expect(query).toBeInstanceOf(QueryWrapper);
    });

    it('throws TreeSitterQueryError for invalid pattern', () => {
      expect(() => createQuery(lang, '(((invalid_unclosed')).toThrow(TreeSitterQueryError);
    });

    it('error includes the pattern and language', () => {
      try {
        createQuery(lang, '(((bad_pattern');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TreeSitterQueryError);
        expect((err as TreeSitterQueryError).pattern).toBe('(((bad_pattern');
        expect((err as TreeSitterQueryError).language).toBe('typescript');
      }
    });
  });

  describe('matches', () => {
    it('returns matches for function declarations', () => {
      const result = parser.parse(`
        function foo() { return 1; }
        function bar() { return 2; }
      `);
      const query = createQuery(lang, '(function_declaration name: (identifier) @func.name)');
      const matches = query.matches(result.tree.rootNode);
      expect(matches.length).toBe(2);
      expect(matches[0].captures.length).toBeGreaterThan(0);
      expect(matches[0].captures[0].name).toBe('func.name');
    });

    it('captures are NodeWrapper instances', () => {
      const result = parser.parse('function test() {}');
      const query = createQuery(lang, '(function_declaration name: (identifier) @name)');
      const matches = query.matches(result.tree.rootNode);
      expect(matches[0].captures[0].node).toBeInstanceOf(NodeWrapper);
      expect(matches[0].captures[0].node.text).toBe('test');
    });

    it('returns empty array when no matches', () => {
      const result = parser.parse('const x = 1;');
      const query = createQuery(lang, '(class_declaration name: (type_identifier) @class.name)');
      const matches = query.matches(result.tree.rootNode);
      expect(matches).toEqual([]);
    });
  });

  describe('captures', () => {
    it('returns a flat list of all captures', () => {
      const result = parser.parse(`
        function foo() {}
        function bar() {}
      `);
      const query = createQuery(lang, '(function_declaration name: (identifier) @func.name)');
      const captures = query.captures(result.tree.rootNode);
      expect(captures.length).toBe(2);
      expect(captures[0].name).toBe('func.name');
      expect(captures[0].node).toBeInstanceOf(NodeWrapper);

      const names = captures.map(c => c.node.text);
      expect(names).toContain('foo');
      expect(names).toContain('bar');
    });
  });
});
