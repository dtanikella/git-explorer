/** @jest-environment node */

import { mapWithConcurrency } from '@/lib/diff/concurrency';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('mapWithConcurrency', () => {
  it('returns results in input order', async () => {
    const items = [30, 5, 20, 1, 10];
    const out = await mapWithConcurrency(items, 2, async (ms, i) => {
      await delay(ms);
      return `${i}:${ms}`;
    });
    expect(out).toEqual(['0:30', '1:5', '2:20', '3:1', '4:10']);
  });

  it('never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithConcurrency(items, 6, async (i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await delay(1 + (i % 3));
      inFlight--;
      return i;
    });
    expect(peak).toBe(6);
  });

  it('propagates rejection', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });

  it('handles empty input', async () => {
    const fn = jest.fn();
    await expect(mapWithConcurrency([], 6, fn)).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
