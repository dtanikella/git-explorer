import { isGeneratedFile } from '@/app/services/analysis/generated-file-detector';

describe('isGeneratedFile', () => {
  it('detects .next/types files', () => {
    expect(isGeneratedFile('.next/types/app/page.ts')).toBe(true);
  });

  it('detects .next/dev/types files', () => {
    expect(isGeneratedFile('.next/dev/types/routes.d.ts')).toBe(true);
  });

  it('detects nested .next paths', () => {
    expect(isGeneratedFile('apps/web/.next/types/app/layout.ts')).toBe(true);
  });

  it('returns false for regular source files', () => {
    expect(isGeneratedFile('app/page.tsx')).toBe(false);
  });

  it('returns false for a file that merely contains "next" in its name', () => {
    expect(isGeneratedFile('src/nextSteps.ts')).toBe(false);
  });
});
