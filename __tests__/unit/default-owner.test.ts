import { ownerOf } from '@/lib/default/owner';

const PKG = 'scip-typescript npm git-explorer 0.1.0 ';

describe('ownerOf', () => {
  it('maps a constructor to its class', () => {
    expect(ownerOf(`${PKG}lib/analysis/\`types.ts\`/AnalysisError#<constructor>().`)).toBe(`${PKG}lib/analysis/\`types.ts\`/AnalysisError#`);
  });

  it('maps a method and a property to their class', () => {
    expect(ownerOf(`${PKG}src/\`a.ts\`/Foo#bar().`)).toBe(`${PKG}src/\`a.ts\`/Foo#`);
    expect(ownerOf(`${PKG}src/\`a.ts\`/Foo#size.`)).toBe(`${PKG}src/\`a.ts\`/Foo#`);
  });

  it('maps a nested member to its nearest owner', () => {
    expect(ownerOf(`${PKG}src/\`a.ts\`/Outer#Inner#go().`)).toBe(`${PKG}src/\`a.ts\`/Outer#Inner#`);
    expect(ownerOf(`${PKG}src/\`a.ts\`/Outer#Inner#`)).toBe(`${PKG}src/\`a.ts\`/Outer#`);
  });

  it('is not fooled by a backtick-quoted file name holding dots, hashes and spaces', () => {
    expect(ownerOf(`${PKG}src/\`my file#1.test.ts\`/Foo#bar().`)).toBe(`${PKG}src/\`my file#1.test.ts\`/Foo#`);
    expect(ownerOf(`${PKG}src/\`my file#1.test.ts\`/Foo#`)).toBeNull();
  });

  it('has no owner for a top-level symbol', () => {
    expect(ownerOf(`${PKG}src/\`a.ts\`/Foo#`)).toBeNull();
    expect(ownerOf(`${PKG}src/\`a.ts\`/helper().`)).toBeNull();
  });

  it('has no owner for a symbol that does not parse', () => {
    expect(ownerOf('local 12')).toBeNull();
    expect(ownerOf('')).toBeNull();
  });
});
