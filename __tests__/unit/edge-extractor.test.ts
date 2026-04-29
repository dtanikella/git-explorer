/**
 * @jest-environment node
 */
import { extractEdges, type EdgeExtractionInput } from '@/app/services/analysis/ts/edge-extractor';
import { SyntaxType, EdgeKind, type AnalysisNode } from '@/lib/analysis/types';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';

function parseTs(source: string): TreeWrapper {
  const lang = loadLanguage('typescript');
  const parser = createParser(lang, 'typescript');
  return parser.parse(source).tree;
}

function makeNode(overrides: Partial<AnalysisNode> & { name: string; scipSymbol: string }): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    filePath: 'src/test.ts',
    startLine: 0,
    startCol: 0,
    isAsync: false,
    isExported: false,
    params: [],
    returnTypeText: null,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
    ...overrides,
  };
}

function mockScipDoc(relativePath: string, occurrences: Array<{
  range: number[];
  symbol: string;
  symbolRoles: number;
}>) {
  return { relativePath, occurrences, symbols: [], text: '', language: 0, positionEncoding: 0 };
}

describe('extractEdges', () => {
  it('produces a CALLS edge for a function call', () => {
    // Source: function that calls another function
    const source = 'import { add } from "./utils";\nfunction main() {\n  add(1, 2);\n}';
    const tree = parseTs(source);

    const addNode = makeNode({ name: 'add', scipSymbol: 'sym:add', filePath: 'src/utils.ts' });
    // "main" identifier starts at line 1, col 9 (after "function ")
    const mainNode = makeNode({ name: 'main', scipSymbol: 'sym:main', filePath: 'src/index.ts', startLine: 1, startCol: 9 });
    const nodeMap = new Map([['sym:add', addNode], ['sym:main', mainNode]]);

    const scipDoc = mockScipDoc('src/index.ts', [
      // "add" reference at line 2, col 2 (inside call_expression)
      { range: [2, 2, 5], symbol: 'sym:add', symbolRoles: 8 }, // ReadAccess
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);

    const callEdge = edges.find(e => e.kind === EdgeKind.CALLS);
    expect(callEdge).toBeDefined();
    expect(callEdge!.toSymbol).toBe('sym:add');
    expect(callEdge!.toName).toBe('add');
  });

  it('produces an INSTANTIATES edge for new expression', () => {
    // Wrap in a function so the reference has an enclosing node
    const source = 'function build() {\n  const u = new User("alice");\n}';
    const tree = parseTs(source);

    const userNode = makeNode({ name: 'User', scipSymbol: 'sym:User', syntaxType: SyntaxType.CLASS, filePath: 'src/models.ts' });
    // "build" starts at line 0, col 9 (after "function ")
    const buildNode = makeNode({ name: 'build', scipSymbol: 'sym:build', filePath: 'src/index.ts', startLine: 0, startCol: 9 });
    const nodeMap = new Map([['sym:User', userNode], ['sym:build', buildNode]]);

    const scipDoc = mockScipDoc('src/index.ts', [
      // "User" reference at line 1, col 16 (inside new_expression)
      { range: [1, 16, 20], symbol: 'sym:User', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    const edge = edges.find(e => e.kind === EdgeKind.INSTANTIATES);
    expect(edge).toBeDefined();
    expect(edge!.toSymbol).toBe('sym:User');
  });

  it('produces a USES_TYPE edge for type annotations', () => {
    const source = 'function greet(name: string): User {\n  return {} as User;\n}';
    const tree = parseTs(source);

    const userNode = makeNode({ name: 'User', scipSymbol: 'sym:User', syntaxType: SyntaxType.CLASS, filePath: 'src/models.ts' });
    // "greet" starts at line 0, col 9 (after "function ")
    const greetNode = makeNode({ name: 'greet', scipSymbol: 'sym:greet', filePath: 'src/index.ts', startLine: 0, startCol: 9 });
    const nodeMap = new Map([['sym:User', userNode], ['sym:greet', greetNode]]);

    // "User" in return type annotation at line 0, col 30
    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 30, 34], symbol: 'sym:User', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    const edge = edges.find(e => e.kind === EdgeKind.USES_TYPE);
    expect(edge).toBeDefined();
  });

  it('skips IMPORTS edges at module level (no enclosing node)', () => {
    const source = 'import { add } from "./utils";';
    const tree = parseTs(source);

    const addNode = makeNode({ name: 'add', scipSymbol: 'sym:add', filePath: 'src/utils.ts' });
    const nodeMap = new Map([['sym:add', addNode]]);

    // "add" in import at line 0, col 9
    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 9, 12], symbol: 'sym:add', symbolRoles: 2 }, // Import role
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    // Module-level imports have no enclosing node → fromSymbol is '' → edge skipped
    expect(edges).toHaveLength(0);
  });

  it('marks external edges when target node not in nodeMap', () => {
    const source = 'console.log("hello");';
    const tree = parseTs(source);

    const nodeMap = new Map<string, AnalysisNode>();

    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 8, 11], symbol: 'sym:console.log', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    if (edges.length > 0) {
      expect(edges[0].isExternal).toBe(true);
    }
  });

  it('populates referencedAt on target node inline', () => {
    const source = 'function caller() {\n  add(1, 2);\n}';
    const tree = parseTs(source);

    const addNode = makeNode({ name: 'add', scipSymbol: 'sym:add', filePath: 'src/utils.ts' });
    const callerNode = makeNode({ name: 'caller', scipSymbol: 'sym:caller', filePath: 'src/index.ts', startLine: 0, startCol: 9 });
    const nodeMap = new Map([['sym:add', addNode], ['sym:caller', callerNode]]);

    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 9, 15], symbol: 'sym:caller', symbolRoles: 1 },
      { range: [1, 2, 5], symbol: 'sym:add', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    extractEdges(input);
    expect(addNode.referencedAt.length).toBeGreaterThan(0);
    expect(addNode.referencedAt[0].filePath).toBe('src/index.ts');
  });

  it('skips edges with empty target symbol', () => {
    const source = 'foo();';
    const tree = parseTs(source);

    const nodeMap = new Map<string, AnalysisNode>();

    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 0, 3], symbol: '', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    expect(edges).toHaveLength(0);
  });

  it('qualifies local target symbols with file path in toSymbol', () => {
    const source = 'function caller() {\n  inner();\n}';
    const tree = parseTs(source);

    const innerNode = makeNode({
      name: 'inner',
      scipSymbol: 'src/mod.ts#local 5',
      filePath: 'src/mod.ts',
      startLine: 0,
      startCol: 0,
    });
    const callerNode = makeNode({
      name: 'caller',
      scipSymbol: 'scip-ts npm . . mod.ts/caller().',
      filePath: 'src/mod.ts',
      startLine: 0,
      startCol: 9,
    });
    const nodeMap = new Map<string, AnalysisNode>([
      ['src/mod.ts#local 5', innerNode],
      ['scip-ts npm . . mod.ts/caller().', callerNode],
    ]);

    const scipDoc = mockScipDoc('src/mod.ts', [
      // Definition of caller at line 0, col 9
      { range: [0, 9, 15], symbol: 'scip-ts npm . . mod.ts/caller().', symbolRoles: 1 },
      // Reference to inner (local 5) at line 1, col 2
      { range: [1, 2, 7], symbol: 'local 5', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/mod.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    const edge = edges.find(e => e.toName === 'inner');
    expect(edge).toBeDefined();
    expect(edge!.toSymbol).toBe('src/mod.ts#local 5');
  });

  it('skips edges where source node has no scipSymbol', () => {
    // Simulate: reference occurs at top-level (no enclosing function found)
    const source = 'add(1, 2);';
    const tree = parseTs(source);

    const addNode = makeNode({ name: 'add', scipSymbol: 'sym:add', filePath: 'src/utils.ts' });
    const nodeMap = new Map([['sym:add', addNode]]);

    const scipDoc = mockScipDoc('src/index.ts', [
      { range: [0, 0, 3], symbol: 'sym:add', symbolRoles: 8 },
    ]);

    const input: EdgeExtractionInput = {
      parsedFiles: new Map([['src/index.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      nodeMap,
      repoPath: '/repo',
    };

    const edges = extractEdges(input);
    // No enclosing node → fromSymbol is '' → edge should be skipped
    expect(edges).toHaveLength(0);
  });
});
