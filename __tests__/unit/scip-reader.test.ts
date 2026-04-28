import { readScipIndex } from '@/lib/scip/reader';
import { ScipReadError } from '@/lib/scip/types';

jest.mock('fs/promises');
const fs = require('fs/promises');

jest.mock('@c4312/scip', () => ({
  deserializeSCIP: jest.fn(),
}));
const { deserializeSCIP } = require('@c4312/scip');

describe('readScipIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads file and decodes protobuf', async () => {
    const mockBuffer = Buffer.from([0x08, 0x01]);
    fs.readFile.mockResolvedValue(mockBuffer);

    const mockIndex = {
      metadata: { toolInfo: { name: 'scip-typescript' } },
      documents: [],
    };
    deserializeSCIP.mockReturnValue(mockIndex);

    const result = await readScipIndex('/repo/.git-explorer/index.scip');

    expect(fs.readFile).toHaveBeenCalledWith('/repo/.git-explorer/index.scip');
    expect(deserializeSCIP).toHaveBeenCalledWith(new Uint8Array(mockBuffer));
    expect(result).toEqual(mockIndex);
  });

  it('throws ScipReadError when file does not exist', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'));

    await expect(readScipIndex('/missing/index.scip'))
      .rejects
      .toThrow(ScipReadError);
  });

  it('throws ScipReadError when protobuf decode fails', async () => {
    fs.readFile.mockResolvedValue(Buffer.from([0xFF, 0xFF]));
    deserializeSCIP.mockImplementation(() => {
      throw new Error('invalid wire type');
    });

    await expect(readScipIndex('/repo/.git-explorer/index.scip'))
      .rejects
      .toThrow(ScipReadError);
  });
});
