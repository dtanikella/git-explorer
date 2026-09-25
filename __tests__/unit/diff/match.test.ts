/** @jest-environment node */

import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import { labelModifiedFile, labelAddedFile, labelDeletedFile } from '@/lib/diff/match';
import type { ParsedFilePair } from '@/lib/diff/file-trees';
import type { DifftasticFileResult } from '@/lib/diff/difftastic';
import { SyntaxType } from '@/lib/analysis/types';

describe('labelModifiedFile', () => {
  function parse(source: string, ext: '.ts' | '.tsx' = '.ts') {
    const langName = ext === '.tsx' ? 'tsx' : 'typescript';
    const lang = loadLanguage(langName);
    const parser = createParser(lang, langName);
    return parser.parse(source);
  }

  function buildPair(
    oldSource: string,
    newSource: string,
    difft: DifftasticFileResult,
  ): ParsedFilePair {
    const oldResult = parse(oldSource);
    const newResult = parse(newSource);
    return {
      path: 'test.ts',
      status: 'modified',
      oldTree: oldResult.tree,
      newTree: newResult.tree,
      oldSource,
      newSource,
      difft,
      parseErrors: [
        { side: 'old', hasError: oldResult.hasErrors },
        { side: 'new', hasError: newResult.hasErrors },
      ],
    };
  }

  it('reformat only -> a unchanged', () => {
    const oldSource = 'function a(){return 1}';
    const newSource = 'function a() {\n  return 1;\n}';
    const pair = buildPair(oldSource, newSource, {
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0], [null, 1], [null, 2]],
      chunks: [],
    });

    const { labels } = labelModifiedFile(pair);
    const aLabels = labels.filter(l => l.unit.name === 'a');
    expect(aLabels.length).toBeGreaterThan(0);
    aLabels.forEach(l => expect(l.status).toBe('unchanged'));
  });

  it('body edit -> a modified', () => {
    const oldSource = 'function a() { return 1; }';
    const newSource = 'function a() { return 2; }';
    const pair = buildPair(oldSource, newSource, {
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0]],
      chunks: [[{
        lhs: { line_number: 0, changes: [{ start: 24, end: 25, content: '1', highlight: 'normal' as const }] },
        rhs: { line_number: 0, changes: [{ start: 24, end: 25, content: '2', highlight: 'normal' as const }] },
      }]],
    });

    const { labels } = labelModifiedFile(pair);
    const aLabels = labels.filter(l => l.unit.name === 'a');
    aLabels.forEach(l => expect(l.status).toBe('modified'));
  });

  it('rename in place -> beta deleted, betaRenamed added', () => {
    const oldSource = 'function beta() { return 1; }';
    const newSource = 'function betaRenamed() { return 1; }';
    const pair = buildPair(oldSource, newSource, {
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0]],
      chunks: [],
    });

    const { labels } = labelModifiedFile(pair);
    const betaOld = labels.find(l => l.unit.name === 'beta' && l.unit.side === 'old');
    const betaNew = labels.find(l => l.unit.name === 'betaRenamed' && l.unit.side === 'new');

    expect(betaOld?.status).toBe('deleted');
    expect(betaNew?.status).toBe('added');
  });

  it('two on one line -> x unchanged, y modified', () => {
    const oldSource = 'const x = 1; const y = 2;';
    const newSource = 'const x = 1; const y = 3;';
    const pair = buildPair(oldSource, newSource, {
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0]],
      chunks: [[{
        lhs: { line_number: 0, changes: [{ start: 22, end: 23, content: '2', highlight: 'normal' as const }] },
        rhs: { line_number: 0, changes: [{ start: 22, end: 23, content: '3', highlight: 'normal' as const }] },
      }]],
    });

    const { labels } = labelModifiedFile(pair);
    const xLabels = labels.filter(l => l.unit.name === 'x');
    const yLabels = labels.filter(l => l.unit.name === 'y');

    xLabels.forEach(l => expect(l.status).toBe('unchanged'));
    yLabels.forEach(l => expect(l.status).toBe('modified'));
  });

  it('class field -> C modified, m unchanged', () => {
    const oldSource = 'class C { f = 1; m() { return 1; } }';
    const newSource = 'class C { f = 2; m() { return 1; } }';
    const pair = buildPair(oldSource, newSource, {
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0]],
      chunks: [[{
        lhs: { line_number: 0, changes: [{ start: 13, end: 14, content: '1', highlight: 'normal' as const }] },
        rhs: { line_number: 0, changes: [{ start: 13, end: 14, content: '2', highlight: 'normal' as const }] },
      }]],
    });

    const { labels } = labelModifiedFile(pair);
    const cLabels = labels.filter(l => l.unit.name === 'C' && l.unit.kind === SyntaxType.CLASS);
    const mLabels = labels.filter(l => l.unit.name === 'm');

    cLabels.forEach(l => expect(l.status).toBe('modified'));
    mLabels.forEach(l => expect(l.status).toBe('unchanged'));
  });

  it('method added -> C unchanged, m unchanged, n added', () => {
    const oldSource = 'class C { m() {} }';
    const newSource = 'class C { m() {} n() {} }';
    const pair = buildPair(oldSource, newSource, {
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0]],
      chunks: [],
    });

    const { labels } = labelModifiedFile(pair);
    const cLabels = labels.filter(l => l.unit.name === 'C');
    const mLabels = labels.filter(l => l.unit.name === 'm');
    const nLabels = labels.filter(l => l.unit.name === 'n');

    cLabels.forEach(l => expect(l.status).toBe('unchanged'));
    mLabels.forEach(l => expect(l.status).toBe('unchanged'));
    const nNew = nLabels.find(l => l.unit.side === 'new');
    expect(nNew?.status).toBe('added');
  });

  it('local inside function -> a modified, t modified (absorbed)', () => {
    const oldSource = 'function a() { const t = 1; return t; }';
    const newSource = 'function a() { const t = 2; return t; }';
    const pair = buildPair(oldSource, newSource, {
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0]],
      chunks: [[{
        lhs: { line_number: 0, changes: [{ start: 28, end: 29, content: '1', highlight: 'normal' as const }] },
        rhs: { line_number: 0, changes: [{ start: 28, end: 29, content: '2', highlight: 'normal' as const }] },
      }]],
    });

    const { labels } = labelModifiedFile(pair);
    const aLabels = labels.filter(l => l.unit.name === 'a');
    const tLabels = labels.filter(l => l.unit.name === 't');

    aLabels.forEach(l => expect(l.status).toBe('modified'));
    tLabels.forEach(l => expect(l.status).toBe('modified'));
  });

  it('export added -> a modified', () => {
    const oldSource = 'function a() {}';
    const newSource = 'export function a() {}';
    const pair = buildPair(oldSource, newSource, {
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0]],
      chunks: [[{
        lhs: { line_number: 0, changes: [{ start: 0, end: 0, content: '', highlight: 'normal' as const }] },
        rhs: { line_number: 0, changes: [{ start: 0, end: 7, content: 'export ', highlight: 'normal' as const }] },
      }]],
    });

    const { labels } = labelModifiedFile(pair);
    const aLabels = labels.filter(l => l.unit.name === 'a');
    aLabels.forEach(l => expect(l.status).toBe('modified'));
  });

  it('every non-absorbed and absorbed unit has exactly one label', () => {
    const oldSource = 'function a() { const t = 1; return t; }';
    const newSource = 'function a() { const t = 2; return t; }';
    const pair = buildPair(oldSource, newSource, {
      status: 'changed',
      language: 'TypeScript',
      path: 'test.ts',
      aligned_lines: [[0, 0]],
      chunks: [[{
        lhs: { line_number: 0, changes: [{ start: 28, end: 29, content: '1', highlight: 'normal' as const }] },
        rhs: { line_number: 0, changes: [{ start: 28, end: 29, content: '2', highlight: 'normal' as const }] },
      }]],
    });

    const { labels } = labelModifiedFile(pair);

    const labelCounts = new Map<string, number>();
    for (const l of labels) {
      const key = `${l.unit.side}:${l.unit.index}`;
      labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
    }

    for (const [, count] of labelCounts) {
      expect(count).toBe(1);
    }
  });
});

describe('labelAddedFile', () => {
  function parse(source: string) {
    const lang = loadLanguage('typescript');
    const parser = createParser(lang, 'typescript');
    return parser.parse(source);
  }

  it('labels every unit in an added file as added', () => {
    const source = 'function foo() {}\nconst bar = 1;\nclass MyClass { method() {} }';
    const result = parse(source);
    const pair: ParsedFilePair = {
      path: 'test.ts',
      status: 'added',
      newTree: result.tree,
      newSource: source,
      parseErrors: [{ side: 'new', hasError: result.hasErrors }],
    };

    const labels = labelAddedFile(pair);
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach(l => expect(l.status).toBe('added'));
  });

  it('labels absorbed units too', () => {
    const source = 'function outer() { const inner = 1; return inner; }';
    const result = parse(source);
    const pair: ParsedFilePair = {
      path: 'test.ts',
      status: 'added',
      newTree: result.tree,
      newSource: source,
      parseErrors: [{ side: 'new', hasError: result.hasErrors }],
    };

    const labels = labelAddedFile(pair);
    const innerLabel = labels.find(l => l.unit.name === 'inner');
    expect(innerLabel).toBeDefined();
    expect(innerLabel!.status).toBe('added');
  });
});

describe('labelDeletedFile', () => {
  function parse(source: string) {
    const lang = loadLanguage('typescript');
    const parser = createParser(lang, 'typescript');
    return parser.parse(source);
  }

  it('labels every unit in a deleted file as deleted', () => {
    const source = 'function foo() {}\nconst bar = 1;';
    const result = parse(source);
    const pair: ParsedFilePair = {
      path: 'test.ts',
      status: 'deleted',
      oldTree: result.tree,
      oldSource: source,
      parseErrors: [{ side: 'old', hasError: result.hasErrors }],
    };

    const labels = labelDeletedFile(pair);
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach(l => expect(l.status).toBe('deleted'));
  });

  it('labels absorbed units too', () => {
    const source = 'function outer() { const inner = 1; return inner; }';
    const result = parse(source);
    const pair: ParsedFilePair = {
      path: 'test.ts',
      status: 'deleted',
      oldTree: result.tree,
      oldSource: source,
      parseErrors: [{ side: 'old', hasError: result.hasErrors }],
    };

    const labels = labelDeletedFile(pair);
    const innerLabel = labels.find(l => l.unit.name === 'inner');
    expect(innerLabel).toBeDefined();
    expect(innerLabel!.status).toBe('deleted');
  });
});