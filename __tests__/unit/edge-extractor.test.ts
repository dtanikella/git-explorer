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
    const mainNode = makeNode({ name: 'main', scipSymbol: 'sym:main', filePath: 'src/index.ts' });
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
    const source = 'const u = new User("alice");';
    const tree = parseTs(source);

    const userNode = makeNode({ name: 'User', scipSymbol: 'sym:User', syntaxType: SyntaxType.CLASS, filePath: 'src/models.ts' });
    const nodeMap = new Map([['sym:User', userNode]]);

    const scipDoc = mockScipDoc('src/index.ts', [
      // "User" reference at line 0, col 14 (inside new_expression)
      { range: [0, 14, 18], symbol: 'sym:User', symbolRoles: 8 },
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
    const nodeMap = new Map([['sym:User', userNode]]);

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

  it('produces an IMPORTS edge for import declarations', () => {
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
    const edge = edges.find(e => e.kind === EdgeKind.IMPORTS);
    expect(edge).toBeDefined();
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

    extractEdges(input);
    expect(addNode.referencedAt.length).toBeGreaterThan(0);
    expect(addNode.referencedAt[0].filePath).toBe('src/index.ts');
  });
});
