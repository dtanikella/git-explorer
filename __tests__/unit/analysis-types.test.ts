import {
  SyntaxType,
  EdgeKind,
  AnalysisError,
  UnsupportedLanguageError,
  NodeExtractionError,
  EdgeExtractionError,
} from '@/lib/analysis/types';

describe('SyntaxType enum', () => {
  it('has all expected members', () => {
    expect(SyntaxType.FUNCTION).toBe('FUNCTION');
    expect(SyntaxType.METHOD).toBe('METHOD');
    expect(SyntaxType.CLASS).toBe('CLASS');
    expect(SyntaxType.INTERFACE).toBe('INTERFACE');
    expect(SyntaxType.TYPE_ALIAS).toBe('TYPE_ALIAS');
    expect(SyntaxType.MODULE).toBe('MODULE');
  });
});

describe('EdgeKind enum', () => {
  it('has all expected members', () => {
    expect(EdgeKind.CALLS).toBe('CALLS');
    expect(EdgeKind.INSTANTIATES).toBe('INSTANTIATES');
    expect(EdgeKind.USES_TYPE).toBe('USES_TYPE');
    expect(EdgeKind.IMPORTS).toBe('IMPORTS');
    expect(EdgeKind.EXTENDS).toBe('EXTENDS');
    expect(EdgeKind.IMPLEMENTS).toBe('IMPLEMENTS');
  });
});

describe('AnalysisError', () => {
  it('captures repoPath', () => {
    const err = new AnalysisError('boom', '/some/repo');
    expect(err.message).toBe('boom');
    expect(err.repoPath).toBe('/some/repo');
    expect(err.name).toBe('AnalysisError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('UnsupportedLanguageError', () => {
  it('extends AnalysisError', () => {
    const err = new UnsupportedLanguageError('/repo');
    expect(err.repoPath).toBe('/repo');
    expect(err.name).toBe('UnsupportedLanguageError');
    expect(err).toBeInstanceOf(AnalysisError);
  });
});

describe('NodeExtractionError', () => {
  it('captures filePath and phase', () => {
    const err = new NodeExtractionError('fail', '/repo', 'src/foo.ts', 'tree-walk');
    expect(err.filePath).toBe('src/foo.ts');
    expect(err.phase).toBe('tree-walk');
    expect(err).toBeInstanceOf(AnalysisError);
  });
});

describe('EdgeExtractionError', () => {
  it('captures filePath and phase', () => {
    const err = new EdgeExtractionError('fail', '/repo', 'src/foo.ts', 'scip-walk');
    expect(err.filePath).toBe('src/foo.ts');
    expect(err.phase).toBe('scip-walk');
    expect(err).toBeInstanceOf(AnalysisError);
  });
});
