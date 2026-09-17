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

  it('skips nodes with no SCIP definition match (empty symbol)', () => {
    const source = 'function orphan(): void {}';
    const tree = parseTs(source);

    // No SCIP occurrences — the node has no matching definition
    const scipDoc = mockScipDoc('src/orphan.ts', []);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/orphan.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodes).toHaveLength(0);
    expect(output.nodeMap.size).toBe(0);
  });

  it('qualifies local SCIP symbols with file path', () => {
    const source = 'function inner(): void {}';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/helpers.ts', [
      { range: [0, 9, 14], symbol: 'local 3', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/helpers.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodes).toHaveLength(1);
    expect(output.nodes[0].scipSymbol).toBe('src/helpers.ts#local 3');
    expect(output.nodeMap.has('src/helpers.ts#local 3')).toBe(true);
  });

  it('extracts a plain variable/constant declaration', () => {
    const source = 'export const CONFIG = 42;';
    const tree = parseTs(source);

    // "CONFIG" starts at row 0, col 13
    const scipDoc = mockScipDoc('src/config.ts', [
      { range: [0, 13, 19], symbol: 'scip-ts npm . . config.ts/CONFIG.', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/config.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find((n) => n.name === 'CONFIG');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.VARIABLE);
    expect(node!.isExported).toBe(true);
  });

  it('does not double-extract an arrow-function-valued variable as VARIABLE', () => {
    const source = 'export const add = (a: number, b: number) => a + b;';
    const tree = parseTs(source);

    const scipDoc = mockScipDoc('src/utils.ts', [
      { range: [0, 13, 16], symbol: 'scip-ts npm . . utils.ts/add.', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/utils.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const matches = output.nodes.filter((n) => n.name === 'add');
    expect(matches).toHaveLength(1);
    expect(matches[0].syntaxType).toBe(SyntaxType.FUNCTION);
  });

  it('skips destructuring declarators (no single symbol name)', () => {
    const source = 'export const { a, b } = getPair();';
    const tree = parseTs(source);

    const output = extractNodes({
      parsedFiles: new Map([['src/utils.ts', { tree, source }]]),
      scipDocuments: [mockScipDoc('src/utils.ts', [])],
      repoPath: '/repo',
    });

    expect(output.nodes).toHaveLength(0);
  });

  it('extracts an enum declaration', () => {
    const source = 'export enum Color { Red, Green }';
    const tree = parseTs(source);

    // "Color" starts at row 0, col 12
    const scipDoc = mockScipDoc('src/models.ts', [
      { range: [0, 12, 17], symbol: 'scip-ts npm . . models.ts/Color#', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/models.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find((n) => n.name === 'Color');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.ENUM);
    expect(node!.isExported).toBe(true);
  });

  it('extracts a namespace declaration', () => {
    const source = 'namespace Foo {\n  export const x = 1;\n}';
    const tree = parseTs(source);

    // "Foo" starts at row 0, col 10
    const scipDoc = mockScipDoc('src/ns.ts', [
      { range: [0, 10, 13], symbol: 'scip-ts npm . . ns.ts/Foo.', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/ns.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find((n) => n.name === 'Foo');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.NAMESPACE);
  });

  it('classifies a getter method_definition as GETTER', () => {
    const source = 'class Foo {\n  get bar(): number { return 1; }\n}';
    const tree = parseTs(source);

    // "bar" starts at row 1, col 6
    const scipDoc = mockScipDoc('src/foo.ts', [
      { range: [1, 6, 9], symbol: 'scip-ts npm . . foo.ts/Foo#bar.', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/foo.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find((n) => n.name === 'bar');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.GETTER);
    expect(node!.returnTypeText).toBe('number');
  });

  it('classifies a setter method_definition as SETTER', () => {
    const source = 'class Foo {\n  set bar(value: number) { this._bar = value; }\n}';
    const tree = parseTs(source);

    // "bar" starts at row 1, col 6
    const scipDoc = mockScipDoc('src/foo.ts', [
      { range: [1, 6, 9], symbol: 'scip-ts npm . . foo.ts/Foo#bar.', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/foo.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find((n) => n.name === 'bar');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.SETTER);
    expect(node!.params).toEqual([{ name: 'value', typeText: 'number', isOptional: false }]);
  });

  it('classifies a constructor method_definition as CONSTRUCTOR', () => {
    const source = 'class Foo {\n  constructor(public name: string) {}\n}';
    const tree = parseTs(source);

    // "constructor" starts at row 1, col 2
    const scipDoc = mockScipDoc('src/foo.ts', [
      { range: [1, 2, 13], symbol: 'scip-ts npm . . foo.ts/Foo#`<constructor>`().', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([['src/foo.ts', { tree, source }]]),
      scipDocuments: [scipDoc],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    const node = output.nodes.find((n) => n.name === 'constructor');
    expect(node).toBeDefined();
    expect(node!.syntaxType).toBe(SyntaxType.CONSTRUCTOR);
  });

  it('extracts a decorator with a synthesized, position-qualified symbol', () => {
    const source = '@Component()\nclass Foo {}';
    const tree = parseTs(source);

    const output = extractNodes({
      parsedFiles: new Map([['src/foo.ts', { tree, source }]]),
      scipDocuments: [mockScipDoc('src/foo.ts', [])],
      repoPath: '/repo',
    });

    const node = output.nodes.find((n) => n.syntaxType === SyntaxType.DECORATOR);
    expect(node).toBeDefined();
    expect(node!.name).toBe('Component');
    expect(node!.isDefinition).toBe(false);
    expect(node!.scipSymbol).toBe('src/foo.ts#local decorator 0:0');
  });

  it('does not collide local symbols across files', () => {
    const sourceA = 'function foo(): void {}';
    const sourceB = 'function bar(): void {}';
    const treeA = parseTs(sourceA);
    const treeB = parseTs(sourceB);

    const scipDocA = mockScipDoc('src/a.ts', [
      { range: [0, 9, 12], symbol: 'local 3', symbolRoles: 1 },
    ]);
    const scipDocB = mockScipDoc('src/b.ts', [
      { range: [0, 9, 12], symbol: 'local 3', symbolRoles: 1 },
    ]);

    const input: NodeExtractionInput = {
      parsedFiles: new Map([
        ['src/a.ts', { tree: treeA, source: sourceA }],
        ['src/b.ts', { tree: treeB, source: sourceB }],
      ]),
      scipDocuments: [scipDocA, scipDocB],
      repoPath: '/repo',
    };

    const output = extractNodes(input);
    expect(output.nodes).toHaveLength(2);
    expect(output.nodeMap.has('src/a.ts#local 3')).toBe(true);
    expect(output.nodeMap.has('src/b.ts#local 3')).toBe(true);
    expect(output.nodeMap.get('src/a.ts#local 3')!.name).toBe('foo');
    expect(output.nodeMap.get('src/b.ts#local 3')!.name).toBe('bar');
  });
});
