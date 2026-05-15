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

  it('returns null when tsconfig.json does not exist', async () => {
    fs.access.mockRejectedValue(new Error('ENOENT'));

    const result = await detectLanguage('/my/repo');
    expect(result).toBeNull();
  });
});
