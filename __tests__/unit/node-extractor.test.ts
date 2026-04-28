/**
 * @jest-environment node
 */
import { extractNodes, type NodeExtractionInput, type NodeExtractionOutput } from '@/app/services/analysis/ts/node-extractor';
import { SyntaxType } from '@/lib/analysis/types';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';

// Helper to parse a TS string and return TreeWrapper
function parseTs(source: string): TreeWrapper {
  const lang = loadLanguage('typescript');
  const parser = createParser(lang, 'typescript');
  return parser.parse(source).tree;
}

// Minimal SCIP document mock matching the @c4312/scip deserialized shape
function mockScipDoc(relativePath: string, occurrences: Array<{
  range: number[];
  symbol: string;
  symbolRoles: number;
}>) {
  return { relativePath, occurrences, symbols: [], text: '', language: 0, positionEncoding: 0 };
}

describe('extractNodes', () => {
  it('extracts a function declaration', () => {
    const source = 'export function add(a: number, b: number): number {\n  return a + b;\n}';
    const tree = parseTs(source);

    // "add" identifier starts at row 0, col 16
    const scipDoc = mockScipDoc('src/utils.ts', [
      { range: [0, 16, 19], symbol: 'scip-ts npm . . utils.ts/add().', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/utils.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);

    expect(output.nodes.length).toBeGreaterThanOrEqual(1);
    const addNode = output.nodes.find(n => n.name === 'add');
    expect(addNode).toBeDefined();
    expect(addNode!.syntaxType).toBe(SyntaxType.FUNCTION);
    expect(addNode!.isExported).toBe(true);
    expect(addNode!.isAsync).toBe(false);
    expect(addNode!.params).toEqual([
      { name: 'a', typeText: 'number', isOptional: false },
      { name: 'b', typeText: 'number', isOptional: false },
    ]);
    expect(addNode!.returnTypeText).toBe('number');
    expect(addNode!.scipSymbol).toBe('scip-ts npm . . utils.ts/add().');
    expect(addNode!.isDefinition).toBe(true);
    expect(addNode!.filePath).toBe('src/utils.ts');
  });

  it('extracts an async function', () => {
    const source = 'export async function fetchData(url: string): Promise<string> {\n  return url;\n}';
    const tree = parseTs(source);

    // "fetchData" starts at row 0, col 22
    const scipDoc = mockScipDoc('src/utils.ts', [
      { range: [0, 22, 31], symbol: 'scip-ts npm . . utils.ts/fetchData().', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/utils.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find(n => n.name === 'fetchData');
    expect(node).toBeDefined();
    expect(node!.isAsync).toBe(true);
    expect(node!.returnTypeText).toBe('Promise<string>');
  });

  it('extracts a class declaration', () => {
    const source = 'export class User {\n  constructor(public name: string) {}\n}';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/models.ts', [
      { range: [0, 13, 17], symbol: 'scip-ts npm . . models.ts/User#', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/models.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find(n => n.name === 'User');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.CLASS);
    expect(node!.isExported).toBe(true);
  });

  it('extracts an interface declaration', () => {
    const source = 'export interface Serializable {\n  serialize(): string;\n}';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/models.ts', [
      { range: [0, 17, 29], symbol: 'scip-ts npm . . models.ts/Serializable#', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/models.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find(n => n.name === 'Serializable');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.INTERFACE);
  });

  it('extracts a type alias declaration', () => {
    const source = 'export type ID = string | number;';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/models.ts', [
      { range: [0, 12, 14], symbol: 'scip-ts npm . . models.ts/ID#', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/models.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find(n => n.name === 'ID');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.TYPE_ALIAS);
  });

  it('extracts a method declaration', () => {
    const source = 'class Foo {\n  bar(x: number): void {}\n}';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/foo.ts', [
      { range: [0, 6, 9], symbol: 'scip-ts npm . . foo.ts/Foo#', symbolRoles: 1 },
      { range: [1, 2, 5], symbol: 'scip-ts npm . . foo.ts/Foo#bar().', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/foo.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const barNode = output.nodes.find(n => n.name === 'bar');
    expect(barNode).toBeDefined();
    expect(barNode!.syntaxType).toBe(SyntaxType.METHOD);
  });

  it('builds nodeMap keyed by SCIP symbol', () => {
    const source = 'export function greet(): void {}';
    const tree = parseTs(source);

    const symbol = 'scip-ts npm . . test.ts/greet().';
    const scipDoc = mockScipDoc('src/test.ts', [
      { range: [0, 16, 21], symbol, symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/test.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodeMap.has(symbol)).toBe(true);
    expect(output.nodeMap.get(symbol)!.name).toBe('greet');
  });

  it('skips files not in parsedFiles (e.g., filtered test files)', () => {
    // SCIP doc references a file that was filtered out during parsing
    const scipDoc = mockScipDoc('src/utils.test.ts', [
      { range: [0, 9, 12], symbol: 'scip-ts npm . . utils.test.ts/foo().', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map(), // empty — file was filtered
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodes).toHaveLength(0);
  });
});
