/**
 * Maps items through an async function with at most `limit` calls in flight.
 *
 * Results keep input order. If any call rejects, the returned promise rejects
 * with that error; calls already started still run to completion.
 *
 * @param items - The inputs to map.
 * @param limit - Maximum number of concurrent calls (values below 1 are treated as 1).
 * @param fn - Async mapper, called with each item and its index.
 * @returns The mapped results in input order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
