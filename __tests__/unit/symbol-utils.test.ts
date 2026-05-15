/**
 * @jest-environment node
 */
import { qualifySymbol } from '@/app/services/analysis/ts/symbol-utils';

describe('qualifySymbol', () => {
  it('returns null for empty string', () => {
    expect(qualifySymbol('src/foo.ts', '')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(qualifySymbol('src/foo.ts', '   ')).toBeNull();
  });

  it('qualifies local symbols with file path', () => {
    expect(qualifySymbol('src/foo.ts', 'local 3')).toBe('src/foo.ts#local 3');
  });

  it('qualifies local symbols with higher numbers', () => {
    expect(qualifySymbol('src/bar.ts', 'local 42')).toBe('src/bar.ts#local 42');
  });

  it('passes through global symbols unchanged', () => {
    expect(qualifySymbol('src/foo.ts', 'scip-ts npm . . foo.ts/add().')).toBe('scip-ts npm . . foo.ts/add().');
  });

  it('passes through non-local symbols unchanged', () => {
    expect(qualifySymbol('src/foo.ts', 'npm @types/node 18.0.0 fs/')).toBe('npm @types/node 18.0.0 fs/');
  });
});
