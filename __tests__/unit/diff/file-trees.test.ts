/** @jest-environment node */

import type { ChangedFile } from '@/lib/diff/git-diff';
import { buildFileTrees } from '@/lib/diff/file-trees';

describe('buildFileTrees', () => {
  it('builds a new tree for an added file', () => {
    const file: ChangedFile = {
      status: 'added',
      path: 'test.ts',
      ext: '.ts',
      newSource: 'export function foo() { return 1; }',
    };

    const result = buildFileTrees(file);

    expect(result.status).toBe('added');
    expect(result.path).toBe('test.ts');
    expect(result.oldTree).toBeUndefined();
    expect(result.newTree).toBeDefined();
    expect(result.newSource).toBe('export function foo() { return 1; }');
    expect(result.parseErrors).toEqual([{ side: 'new', hasError: false }]);
  });

  it('builds an old tree for a deleted file', () => {
    const file: ChangedFile = {
      status: 'deleted',
      path: 'test.ts',
      ext: '.ts',
      oldSource: 'export function bar() { return 2; }',
    };

    const result = buildFileTrees(file);

    expect(result.status).toBe('deleted');
    expect(result.oldTree).toBeDefined();
    expect(result.newTree).toBeUndefined();
    expect(result.oldSource).toBe('export function bar() { return 2; }');
    expect(result.parseErrors).toEqual([{ side: 'old', hasError: false }]);
  });

  it('builds both trees for a modified file', () => {
    const file: ChangedFile = {
      status: 'modified',
      path: 'test.ts',
      ext: '.ts',
      oldSource: 'export function foo() { return 1; }',
      newSource: 'export function foo() { return 2; }',
    };

    const result = buildFileTrees(file);

    expect(result.status).toBe('modified');
    expect(result.oldTree).toBeDefined();
    expect(result.newTree).toBeDefined();
    expect(result.oldSource).toBe('export function foo() { return 1; }');
    expect(result.newSource).toBe('export function foo() { return 2; }');
    expect(result.parseErrors).toHaveLength(2);
    expect(result.parseErrors).toHaveLength(2);
    expect(result.parseErrors.map(p => p.hasError)).toEqual([false, false]);
  });

  it('reports hasError: true for deliberately broken source', () => {
    const file: ChangedFile = {
      status: 'modified',
      path: 'broken.ts',
      ext: '.ts',
      oldSource: 'function valid() { return 1; }',
      newSource: 'function broken( { return ; }', // deliberately broken
    };

    const result = buildFileTrees(file);

    expect(result.parseErrors).toHaveLength(2);
    const oldSide = result.parseErrors.find(p => p.side === 'old');
    const newSide = result.parseErrors.find(p => p.side === 'new');
    expect(oldSide?.hasError).toBe(false);
    expect(newSide?.hasError).toBe(true);
  });

  it('handles .tsx extension', () => {
    const file: ChangedFile = {
      status: 'modified',
      path: 'component.tsx',
      ext: '.tsx',
      oldSource: 'const Comp = () => <div>Hello</div>;',
      newSource: 'const Comp = () => <div>World</div>;',
    };

    const result = buildFileTrees(file);

    expect(result.oldTree).toBeDefined();
    expect(result.newTree).toBeDefined();
    expect(result.parseErrors.every(p => !p.hasError)).toBe(true);
  });
});