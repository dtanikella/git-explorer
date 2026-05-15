/**
 * @jest-environment node
 */
import { createParser, ParserWrapper } from '@/lib/tree-sitter/parser';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { TreeWrapper } from '@/lib/tree-sitter/tree';
import { NodeWrapper } from '@/lib/tree-sitter/node';

describe('ParserWrapper', () => {
  let parser: ParserWrapper;

  beforeAll(() => {
    const lang = loadLanguage('typescript');
    parser = createParser(lang, 'typescript');
  });

  describe('parse', () => {
    it('parses valid TypeScript and returns a ParseResult', () => {
      const result = parser.parse('const x: number = 42;');
      expect(result.tree).toBeInstanceOf(TreeWrapper);
      expect(result.hasErrors).toBe(false);
      expect(result.language).toBe('typescript');
    });

    it('returns hasErrors=true for invalid source', () => {
      const result = parser.parse('function broken( { return; }');
      expect(result.hasErrors).toBe(true);
      expect(result.tree).toBeInstanceOf(TreeWrapper);
    });

    it('tree rootNode is a NodeWrapper', () => {
      const result = parser.parse('const x = 1;');
      expect(result.tree.rootNode).toBeInstanceOf(NodeWrapper);
      expect(result.tree.rootNode.type).toBe('program');
    });

    it('parses empty string without error', () => {
      const result = parser.parse('');
      expect(result.tree).toBeInstanceOf(TreeWrapper);
      expect(result.hasErrors).toBe(false);
    });

    it('parses multiline source', () => {
      const source = `
        interface Foo { bar: string; }
        function test(): Foo { return { bar: 'hello' }; }
      `;
      const result = parser.parse(source);
      expect(result.hasErrors).toBe(false);
      const funcs = result.tree.rootNode.descendantsOfType('function_declaration');
      expect(funcs.length).toBe(1);
    });
  });

  describe('getLanguage', () => {
    it('returns the language object', () => {
      const lang = parser.getLanguage();
      expect(lang).toBeDefined();
    });
  });

  describe('setTimeoutMicros', () => {
    it('accepts a timeout value without throwing', () => {
      expect(() => parser.setTimeoutMicros(100000)).not.toThrow();
    });
  });
});
