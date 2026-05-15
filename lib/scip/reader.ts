import * as fs from 'fs/promises';
import { deserializeSCIP } from '@c4312/scip';
import { ScipReadError } from './types';

export async function readScipIndex(indexPath: string) {
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(indexPath);
  } catch (err) {
    throw new ScipReadError(
      `Failed to read SCIP index: ${(err as Error).message}`,
      indexPath,
    );
  }

  try {
    return deserializeSCIP(new Uint8Array(buffer));
  } catch (err) {
    throw new ScipReadError(
      `Failed to decode SCIP index: ${(err as Error).message}`,
      indexPath,
    );
  }
}
