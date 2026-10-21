import { centreOn, fitTransform } from '@/lib/default/camera';

const base = { viewport: { width: 1000, height: 800 }, defaultFit: 1 };

describe('fitTransform', () => {
  it('fits the box into the viewport minus the card and padding, centred left of the card', () => {
    // box 400 x 200 → area 1000-300-60 = 640 wide, 800-80 = 720 tall → k = min(1.6, 3.6) = 1.6
    const t = fitTransform([{ x: 0, y: 0 }, { x: 400, y: 200 }], { ...base, cardWidth: 300 });
    expect(t.k).toBeCloseTo(1.6);
    expect(t.x + 200 * t.k).toBeCloseTo((1000 - 300) / 2);
    expect(t.y + 100 * t.k).toBeCloseTo(400);
  });

  it('zooms out further with a card than without', () => {
    const pts = [{ x: 0, y: 0 }, { x: 400, y: 200 }];
    const withCard = fitTransform(pts, { ...base, cardWidth: 300 });
    const without = fitTransform(pts, { ...base, cardWidth: 0 });
    expect(withCard.k).toBeLessThan(without.k);
    expect(without.x + 200 * without.k).toBeCloseTo(500);
  });

  it('uses the minimum box for a single target', () => {
    const t = fitTransform([{ x: 50, y: -30 }], { ...base, cardWidth: 300 });
    // box 240 x 240 → min(640/240, 720/240) = 2.667, within the 6x clamp
    expect(t.k).toBeCloseTo(640 / 240);
    expect(t.x + 50 * t.k).toBeCloseTo(350);
    expect(t.y - 30 * t.k).toBeCloseTo(400);
  });

  it('clamps zoom between a quarter and six times the default fit', () => {
    expect(fitTransform([{ x: 0, y: 0 }, { x: 100000, y: 0 }], { ...base, cardWidth: 300 }).k).toBeCloseTo(0.25);
    expect(fitTransform([{ x: 0, y: 0 }], { ...base, defaultFit: 0.1, cardWidth: 300, minBox: 1 }).k).toBeCloseTo(0.6);
  });
});

describe('centreOn', () => {
  it('puts the point at the middle of the area left of the card and keeps the zoom', () => {
    const t = centreOn({ x: 120, y: -40 }, { width: 1000, height: 800 }, 300, 2);
    expect(t.k).toBe(2);
    expect(t.x + 120 * 2).toBeCloseTo(350);
    expect(t.y - 40 * 2).toBeCloseTo(400);
  });

  it('centres on the whole viewport when there is no card', () => {
    const t = centreOn({ x: 0, y: 0 }, { width: 1000, height: 800 }, 0, 1);
    expect(t).toEqual({ x: 500, y: 400, k: 1 });
  });
});
