import { detectLanguage, SupportedLanguage } from '@/app/services/analysis/language-detector';

jest.mock('fs/promises');
const fs = require('fs/promises');

describe('detectLanguage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "typescript" when tsconfig.json exists', async () => {
    fs.access.mockResolvedValue(undefined);

    const result = await detectLanguage('/my/repo');
    expect(result).toBe('typescript');
    expect(fs.access).toHaveBeenCalledWith(expect.stringContaining('tsconfig.json'));
  });

  it('returns "ruby" when Gemfile exists and no tsconfig.json', async () => {
    // First call (tsconfig.json) rejects, second (Gemfile) resolves
    fs.access.mockRejectedValueOnce(new Error('ENOENT'));
    fs.access.mockResolvedValueOnce(undefined);

    const result = await detectLanguage('/my/repo');
    expect(result).toBe('ruby');
    expect(fs.access).toHaveBeenCalledWith(expect.stringContaining('Gemfile'));
  });

  it('returns null when neither tsconfig.json nor Gemfile exist', async () => {
    fs.access.mockRejectedValue(new Error('ENOENT'));

    const result = await detectLanguage('/my/repo');
    expect(result).toBeNull();
  });

  it('prefers typescript over ruby when both exist', async () => {
    fs.access.mockResolvedValueOnce(undefined); // tsconfig.json exists

    const result = await detectLanguage('/my/repo');
    expect(result).toBe('typescript');
  });
});
