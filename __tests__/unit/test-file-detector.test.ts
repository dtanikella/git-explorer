import { isTestFile } from '@/app/services/analysis/test-file-detector';

describe('isTestFile', () => {
  it('detects .test.ts files', () => {
    expect(isTestFile('src/utils.test.ts')).toBe(true);
  });

  it('detects .spec.ts files', () => {
    expect(isTestFile('src/utils.spec.ts')).toBe(true);
  });

  it('detects .test.tsx files', () => {
    expect(isTestFile('components/App.test.tsx')).toBe(true);
  });

  it('detects .spec.tsx files', () => {
    expect(isTestFile('components/App.spec.tsx')).toBe(true);
  });

  it('detects files in __tests__/ directory', () => {
    expect(isTestFile('__tests__/unit/foo.ts')).toBe(true);
  });

  it('detects files in test/ directory', () => {
    expect(isTestFile('test/integration/bar.ts')).toBe(true);
  });

  it('detects files in tests/ directory', () => {
    expect(isTestFile('tests/helpers/baz.ts')).toBe(true);
  });

  it('returns false for regular source files', () => {
    expect(isTestFile('src/utils.ts')).toBe(false);
  });

  it('returns false for files with test in the name but not matching patterns', () => {
    expect(isTestFile('src/testUtils.ts')).toBe(false);
  });

  it('handles nested paths correctly', () => {
    expect(isTestFile('packages/core/__tests__/deep/nested.ts')).toBe(true);
  });
});
