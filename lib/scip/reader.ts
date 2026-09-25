import * as fs from 'fs/promises';
import { deserializeSCIP } from '@c4312/scip';
import { ScipReadError } from './types';

/**
 * Reads and deserializes a SCIP index from disk.
 *
 * @remarks
 * Loads the raw protobuf bytes from the file path and uses
 * `@c4312/scip`'s `deserializeSCIP` to decode them into an in-memory
 * SCIP index object.
 *
 * @param indexPath - Path to the `.scip` file on disk.
 * @returns A deserialized SCIP index (the raw protobuf object).
 * @throws {@link ScipReadError} When the file cannot be read or the
 *   protobuf payload fails to decode.
 * @see commit 5a1e21a
 */
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
