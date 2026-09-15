/**
 * @jest-environment node
 */
import { extractRubyEdges, type RubyEdgeExtractionInput } from '@/app/services/analysis/ruby/edge-extractor';
import { SyntaxType, EdgeKind, type AnalysisNode } from '@/lib/analysis/types';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';

function parseRuby(source: string): TreeWrapper {
  const lang = loadLanguage('ruby');
  const parser = createParser(lang, 'ruby');
  return parser.parse(source).tree;
}

function makeRubySymbol(filePath: string, qualifiedName: string): string {
  return `ruby:${filePath}#${qualifiedName}`;
}

function makeMethodNode(
  name: string,
  scipSymbol: string,
  filePath: string,
  startLine: number,
  startCol: number,
): AnalysisNode {
  return {
    syntaxType: SyntaxType.METHOD,
    name,
    filePath,
    startLine,
    startCol,
    isAsync: false,
    isExported: false,
    params: [],
    returnTypeText: null,
    scipSymbol,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  };
}

function makeClassNode(
  name: string,
  scipSymbol: string,
  filePath: string,
  startLine: number,
  startCol: number,
): AnalysisNode {
  return {
    syntaxType: SyntaxType.CLASS,
    name,
    filePath,
    startLine,
    startCol,
    isAsync: false,
    isExported: false,
    params: [],
    returnTypeText: null,
    scipSymbol,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  };
}

describe('extractRubyEdges', () => {
  it('produces a CALLS edge for implicit-self method call', () => {
    // Source: method that calls another method in the same class
    // Positions verified via tree-sitter:
    // Foo constant at (0,6), bar identifier at (1,6), baz call at (2,4), baz def at (5,6)
    const source = `class Foo
  def bar
    baz
  end

  def baz
  end
end`;
    const tree = parseRuby(source);

    const barSym = makeRubySymbol('src/foo.rb', 'Foo#bar');
    const bazSym = makeRubySymbol('src/foo.rb', 'Foo#baz');

    const barNode = makeMethodNode('bar', barSym, 'src/foo.rb', 1, 6);
    const bazNode = makeMethodNode('baz', bazSym, 'src/foo.rb', 5, 6);
    const fooNode = makeClassNode('Foo', makeRubySymbol('src/foo.rb', 'Foo'), 'src/foo.rb', 0, 6);

    const nodeMap = new Map([
      [fooNode.scipSymbol, fooNode],
      [barSym, barNode],
      [bazSym, bazNode],
    ]);

    const input: RubyEdgeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractRubyEdges(input);
    const callEdge = edges.find(e => e.kind === EdgeKind.CALLS && e.fromName === 'bar' && e.toName === 'baz');
    expect(callEdge).toBeDefined();
    expect(callEdge!.isExternal).toBe(false);
    expect(callEdge!.isAmbiguous).toBe(false);
  });

  it('produces a CALLS edge with isExternal for unknown method', () => {
    // Positions: foo at (0,4), something_unknown at (1,2)
    const source = `def foo
  something_unknown
end`;
    const tree = parseRuby(source);

    const fooSym = makeRubySymbol('src/bar.rb', 'foo');
    const fooNode = makeMethodNode('foo', fooSym, 'src/bar.rb', 0, 4);
    const nodeMap = new Map([[fooSym, fooNode]]);

    const input: RubyEdgeExtractionInput = {
      parsedFiles: new Map([['src/bar.rb', { tree, source }]]),
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractRubyEdges(input);
    const externalEdge = edges.find(e => e.kind === EdgeKind.CALLS && e.toName === 'something_unknown');
    expect(externalEdge).toBeDefined();
    expect(externalEdge!.isExternal).toBe(true);
    expect(externalEdge!.isAmbiguous).toBe(false);
  });

  it('produces an INCLUDES edge for include call', () => {
    // Positions: Persistence module at (0,7), save at (1,6),
    // Foo class at (5,6), include Persistence at (6,2)
    const source = `module Persistence
  def save
  end
end

class Foo
  include Persistence
end`;
    const tree = parseRuby(source);

    const persistSym = makeRubySymbol('src/models.rb', 'Persistence');
    const fooSym = makeRubySymbol('src/models.rb', 'Foo');
    const persistNode = makeClassNode('Persistence', persistSym, 'src/models.rb', 0, 7);
    const fooNode = makeClassNode('Foo', fooSym, 'src/models.rb', 5, 6);

    const nodeMap = new Map([
      [persistSym, persistNode],
      [fooSym, fooNode],
    ]);

    const input: RubyEdgeExtractionInput = {
      parsedFiles: new Map([['src/models.rb', { tree, source }]]),
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractRubyEdges(input);
    const includeEdge = edges.find(e => e.kind === EdgeKind.INCLUDES && e.toName === 'Persistence');
    expect(includeEdge).toBeDefined();
    expect(includeEdge!.isExternal).toBe(false);
  });

  it('produces an INSTANTIATES edge for constant.new', () => {
    // Positions: Foo at (0,6), build at (1,6), Bar.new at (2,4), Bar at (6,0)
    const source = `class Foo
  def build
    Bar.new
  end
end

class Bar
end`;
    const tree = parseRuby(source);

    const fooSym = makeRubySymbol('src/app.rb', 'Foo');
    const buildSym = makeRubySymbol('src/app.rb', 'Foo#build');
    const barSym = makeRubySymbol('src/app.rb', 'Bar');

    const fooNode = makeClassNode('Foo', fooSym, 'src/app.rb', 0, 6);
    const buildNode = makeMethodNode('build', buildSym, 'src/app.rb', 1, 6);
    const barNode = makeClassNode('Bar', barSym, 'src/app.rb', 6, 0);

    const nodeMap = new Map([
      [fooSym, fooNode],
      [buildSym, buildNode],
      [barSym, barNode],
    ]);

    const input: RubyEdgeExtractionInput = {
      parsedFiles: new Map([['src/app.rb', { tree, source }]]),
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractRubyEdges(input);
    const instantiateEdge = edges.find(
      e => e.kind === EdgeKind.INSTANTIATES && e.toName === 'Bar',
    );
    expect(instantiateEdge).toBeDefined();
    expect(instantiateEdge!.isExternal).toBe(false);
  });

  it('skips INSTANTIATES edge for dynamic receiver (self.class.new)', () => {
    const source = `class Foo
  def clone
    self.class.new
  end
end`;
    const tree = parseRuby(source);

    const fooSym = makeRubySymbol('src/app.rb', 'Foo');
    const cloneSym = makeRubySymbol('src/app.rb', 'Foo#clone');
    const fooNode = makeClassNode('Foo', fooSym, 'src/app.rb', 0, 6);
    const cloneNode = makeMethodNode('clone', cloneSym, 'src/app.rb', 1, 6);

    const nodeMap = new Map([[fooSym, fooNode], [cloneSym, cloneNode]]);

    const input: RubyEdgeExtractionInput = {
      parsedFiles: new Map([['src/app.rb', { tree, source }]]),
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractRubyEdges(input);
    // Should not emit INSTANTIATES for dynamic receiver
    const instantiateEdges = edges.filter(e => e.kind === EdgeKind.INSTANTIATES);
    expect(instantiateEdges).toHaveLength(0);
  });

  it('populates referencedAt on target node', () => {
    // Positions: Foo at (0,6), caller at (1,6), callee def at (5,6), callee call at (2,4)
    const source = `class Foo
  def caller
    callee
  end

  def callee
  end
end`;
    const tree = parseRuby(source);

    const callerSym = makeRubySymbol('src/foo.rb', 'Foo#caller');
    const calleeSym = makeRubySymbol('src/foo.rb', 'Foo#callee');

    const callerNode = makeMethodNode('caller', callerSym, 'src/foo.rb', 1, 6);
    const calleeNode = makeMethodNode('callee', calleeSym, 'src/foo.rb', 5, 6);
    const fooNode = makeClassNode('Foo', makeRubySymbol('src/foo.rb', 'Foo'), 'src/foo.rb', 0, 6);

    const nodeMap = new Map([
      [fooNode.scipSymbol, fooNode],
      [callerSym, callerNode],
      [calleeSym, calleeNode],
    ]);

    const input: RubyEdgeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      nodeMap,
      repoPath: '/repo',
    };

    extractRubyEdges(input);
    expect(calleeNode.referencedAt.length).toBeGreaterThan(0);
    expect(calleeNode.referencedAt[0].filePath).toBe('src/foo.rb');
    expect(callerNode.outboundRefs.length).toBeGreaterThan(0);
  });

  it('deduplicates identical CALLS edges', () => {
    const source = `class Foo
  def bar
    baz
    baz
  end

  def baz
  end
end`;
    const tree = parseRuby(source);

    const barSym = makeRubySymbol('src/foo.rb', 'Foo#bar');
    const bazSym = makeRubySymbol('src/foo.rb', 'Foo#baz');

    const barNode = makeMethodNode('bar', barSym, 'src/foo.rb', 1, 6);
    const bazNode = makeMethodNode('baz', bazSym, 'src/foo.rb', 6, 6);
    const fooNode = makeClassNode('Foo', makeRubySymbol('src/foo.rb', 'Foo'), 'src/foo.rb', 0, 6);

    const nodeMap = new Map([
      [fooNode.scipSymbol, fooNode],
      [barSym, barNode],
      [bazSym, bazNode],
    ]);

    const input: RubyEdgeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractRubyEdges(input);
    // Should deduplicate the two bar→baz edges
    const bazEdges = edges.filter(
      e => e.kind === EdgeKind.CALLS && e.fromName === 'bar' && e.toName === 'baz',
    );
    expect(bazEdges).toHaveLength(1);
  });

  it('handles singleton method call resolution', () => {
    // Positions: Foo at (0,6), create at (1,11), new call at (2,4)
    const source = `class Foo
  def self.create
    new
  end
end`;
    const tree = parseRuby(source);

    const createSym = makeRubySymbol('src/foo.rb', 'Foo.create');
    const createNode = makeMethodNode('create', createSym, 'src/foo.rb', 1, 11);
    const fooNode = makeClassNode('Foo', makeRubySymbol('src/foo.rb', 'Foo'), 'src/foo.rb', 0, 6);

    const nodeMap = new Map([
      [fooNode.scipSymbol, fooNode],
      [createSym, createNode],
    ]);

    const input: RubyEdgeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractRubyEdges(input);
    // `new` inside a singleton method is an instance method call via implicit self
    const newEdge = edges.find(
      e => e.kind === EdgeKind.CALLS && e.toName === 'new' && e.fromName === 'create',
    );
    expect(newEdge).toBeDefined();
    expect(newEdge!.isExternal).toBe(true); // 'new' is not defined in the repo
  });

  it('emits extend as INCLUDES edge', () => {
    // Positions: ClassMethods at (0,7), Foo at (5,6), extend at (6,2)
    const source = `module ClassMethods
  def class_method
  end
end

class Foo
  extend ClassMethods
end`;
    const tree = parseRuby(source);

    const cmSym = makeRubySymbol('src/foo.rb', 'ClassMethods');
    const cmNode = makeClassNode('ClassMethods', cmSym, 'src/foo.rb', 0, 7);
    const fooSym = makeRubySymbol('src/foo.rb', 'Foo');
    const fooNode = makeClassNode('Foo', fooSym, 'src/foo.rb', 5, 6);

    const nodeMap = new Map([
      [cmSym, cmNode],
      [fooSym, fooNode],
    ]);

    const input: RubyEdgeExtractionInput = {
      parsedFiles: new Map([['src/foo.rb', { tree, source }]]),
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractRubyEdges(input);
    const extendEdge = edges.find(
      e => e.kind === EdgeKind.INCLUDES && e.toName === 'ClassMethods',
    );
    expect(extendEdge).toBeDefined();
  });
});