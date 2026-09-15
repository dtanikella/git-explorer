/**
 * @jest-environment node
 */
import { extractRubyNodes, type RubyNodeExtractionInput } from '@/app/services/analysis/ruby/node-extractor';
import { SyntaxType } from '@/lib/analysis/types';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';

// Helper to parse a Ruby string and return TreeWrapper
function parseRuby(source: string): TreeWrapper {
  const lang = loadLanguage('ruby');
  const parser = createParser(lang, 'ruby');
  return parser.parse(source).tree;
}

describe('extractRubyNodes', () => {
  it('extracts a class declaration with method', () => {
    const source = `class Foo\n  def bar\n  end\nend`;
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);

    // Should find Foo class and Foo#bar method
    const fooNode = output.nodes.find(n => n.name === 'Foo');
    expect(fooNode).toBeDefined();
    expect(fooNode!.syntaxType).toBe(SyntaxType.CLASS);
    expect(fooNode!.filePath).toBe('src/foo.rb');

    const barNode = output.nodes.find(n => n.name === 'bar');
    expect(barNode).toBeDefined();
    expect(barNode!.syntaxType).toBe(SyntaxType.METHOD);
    expect(barNode!.scipSymbol).toContain('#');
  });

  it('extracts a module declaration', () => {
    const source = 'module Persistence\n  def save\n  end\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/persistence.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const modNode = output.nodes.find(n => n.name === 'Persistence');
    expect(modNode).toBeDefined();
    expect(modNode!.syntaxType).toBe(SyntaxType.MODULE);
  });

  it('extracts a singleton method (def self.bar)', () => {
    const source = 'class Foo\n  def self.bar\n  end\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const barNode = output.nodes.find(n => n.name === 'bar');
    expect(barNode).toBeDefined();
    expect(barNode!.scipSymbol).toMatch(/Foo\.bar/);
  });

  it('extracts methods inside singleton_class (class << self)', () => {
    const source = 'class Foo\n  class << self\n    def bar\n    end\n  end\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const barNode = output.nodes.find(n => n.name === 'bar');
    expect(barNode).toBeDefined();
    // Inside class << self → singleton → uses "." for the singleton separator
    expect(barNode!.scipSymbol).toMatch(/Foo\.bar/);
  });

  it('handles compact class paths (class Foo::Bar)', () => {
    const source = 'class Foo::Bar < Baz\n  def qux\n  end\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const barNode = output.nodes.find(n => n.name === 'Bar');
    expect(barNode).toBeDefined();
    // The qualified scope should include Foo:: prefix
    expect(barNode!.scipSymbol).toContain('Foo::Bar');
  });

  it('extracts top-level method (def outside class)', () => {
    const source = 'def top_level\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const topNode = output.nodes.find(n => n.name === 'top_level');
    expect(topNode).toBeDefined();
    expect(topNode!.syntaxType).toBe(SyntaxType.METHOD);
    // Top-level method: symbol is ruby:filePath#methodName
    // The '#' is the filePath separator, not an instance-method indicator
    expect(topNode!.scipSymbol).toMatch(/ruby:src\/foo\.rb#top_level$/);
  });

  it('synthesizes attr_accessor reader and writer methods', () => {
    const source = 'class Foo\n  attr_accessor :name, :age\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const nameNode = output.nodes.find(n => n.name === 'name');
    expect(nameNode).toBeDefined();
    expect(nameNode!.syntaxType).toBe(SyntaxType.METHOD);
    expect(nameNode!.scipSymbol).toContain('#');

    const nameEqualsNode = output.nodes.find(n => n.name === 'name=');
    expect(nameEqualsNode).toBeDefined();
    expect(nameEqualsNode!.syntaxType).toBe(SyntaxType.METHOD);
    expect(nameEqualsNode!.scipSymbol).toContain('#');
    expect(nameEqualsNode!.params).toEqual([{ name: 'value', typeText: null, isOptional: false }]);
  });

  it('synthesizes attr_reader only (no writer)', () => {
    const source = 'class Foo\n  attr_reader :id\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const idNode = output.nodes.find(n => n.name === 'id');
    expect(idNode).toBeDefined();

    // Should NOT synthesize writer for attr_reader
    const writerNode = output.nodes.find(n => n.name === 'id=');
    expect(writerNode).toBeUndefined();
  });

  it('synthesizes attr_writer only (no reader)', () => {
    const source = 'class Foo\n  attr_writer :secret\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const writerNode = output.nodes.find(n => n.name === 'secret=');
    expect(writerNode).toBeDefined();
    expect(writerNode!.name).toBe('secret=');
  });

  it('synthesizes attr (treated as reader)', () => {
    const source = 'class Foo\n  attr :value\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const valueNode = output.nodes.find(n => n.name === 'value');
    expect(valueNode).toBeDefined();
  });

  it('produces one node per physical declaration site (reopened classes)', () => {
    const source = `class Foo\n  def bar\n  end\nend\nclass Foo\n  def baz\n  end\nend`;
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    // Two Foo nodes (one per declaration site)
    const fooNodes = output.nodes.filter(n => n.name === 'Foo');
    expect(fooNodes.length).toBe(2);

    // bar and baz methods
    const barNode = output.nodes.find(n => n.name === 'bar');
    expect(barNode).toBeDefined();
    const bazNode = output.nodes.find(n => n.name === 'baz');
    expect(bazNode).toBeDefined();
  });

  it('builds nodeMap keyed by ruby symbol', () => {
    const source = 'class Foo\n  def bar\n  end\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    // Each node should be in nodeMap
    for (const node of output.nodes) {
      expect(output.nodeMap.has(node.scipSymbol)).toBe(true);
    }
  });

  it('extracts nested class scope paths correctly', () => {
    const source = 'module Outer\n  class Inner\n    def foo\n    end\n  end\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/nested.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const outerNode = output.nodes.find(n => n.name === 'Outer');
    expect(outerNode).toBeDefined();
    expect(outerNode!.scipSymbol).toContain('Outer');

    const innerNode = output.nodes.find(n => n.name === 'Inner');
    expect(innerNode).toBeDefined();
    expect(innerNode!.scipSymbol).toContain('Outer::Inner');

    const fooNode = output.nodes.find(n => n.name === 'foo');
    expect(fooNode).toBeDefined();
    expect(fooNode!.scipSymbol).toContain('Outer::Inner#foo');
  });

  it('extracts method parameters', () => {
    const source = 'class Foo\n  def bar(x, y=1, *args, &block)\n  end\nend';
    const tree = parseRuby(source);

    const input: RubyNodeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      repoPath: '/repo',
    };

    const output = extractRubyNodes(input);
    const barNode = output.nodes.find(n => n.name === 'bar');
    expect(barNode).toBeDefined();
    // x, y (optional_parameter), *args (splat_parameter), &block (block_parameter)
    expect(barNode!.params.length).toBe(4);
  });
});