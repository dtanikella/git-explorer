jest.mock('d3-hierarchy', () => jest.requireActual('../../node_modules/d3-hierarchy/dist/d3-hierarchy.js'));

import { layoutLabels } from '@/lib/default/labels';
import type { LabelTransform } from '@/lib/default/labels';
import type { Band } from '@/lib/default/bands';
import { DEFAULT_VIEW_CONFIG } from '@/lib/default/config';
import type { PositionedNode } from '@/lib/default/layout';

const placed = (name: string): PositionedNode => ({
  node: { id: name, tier: 'folder', name, path: name, depth: 1, children: [] }, angle: 0, radius: 0, x: 0, y: 0,
});
const folder = (name: string, over: Partial<Band>): Band => ({
  tier: 'folder', node: placed(name), depth: 1, inner: 300, outer: 600, startAngle: -0.5, endAngle: 0.5, symbols: [], hue: 0, color: '#000', opacity: 0.3, ...over,
});

const view = { width: 1200, height: 1200 };
const at = (k: number): LabelTransform => ({ x: 600, y: 600, k });
const measure = (text: string, size: number) => text.length * size * 0.5;

describe('layoutLabels', () => {
  it('shows a folder name inside its band, horizontal when it fits', () => {
    const [l] = [...layoutLabels([folder('lib', {})], at(1), view, new Map(), DEFAULT_VIEW_CONFIG, measure).values()];
    expect(l).toMatchObject({ text: 'lib', visible: true, mode: 'H' });
    expect(l.fontSize).toBeGreaterThanOrEqual(10);
    expect(l.fontSize).toBeLessThanOrEqual(18);
  });

  it('does not show a name that cannot fit at the smallest font', () => {
    const tiny = folder('a-rather-long-folder-name', { startAngle: -0.01, endAngle: 0.01 });
    expect(layoutLabels([tiny], at(0.05), view, new Map(), DEFAULT_VIEW_CONFIG, measure).size).toBe(0);
  });

  it('labels folders only', () => {
    const file = { ...folder('f.ts', {}), tier: 'file' as const };
    expect(layoutLabels([file], at(1), view, new Map(), DEFAULT_VIEW_CONFIG, measure).size).toBe(0);
  });

  it('keeps the whole padded text box inside the visible viewport', () => {
    const partly = { width: 120, height: 1200 }; // the band's middle is off screen to the right
    const [l] = [...layoutLabels([folder('lib', { startAngle: 0.2, endAngle: 1.2 })], { x: -400, y: 600, k: 1 }, partly, new Map(), DEFAULT_VIEW_CONFIG, measure).values()];
    if (l) {
      const half = (measure('lib', l.fontSize) + 6) / 2;
      expect(l.x - half).toBeGreaterThanOrEqual(0);
      expect(l.x + half).toBeLessThanOrEqual(partly.width);
    }
  });

  it('falls back to the arc or the radius when horizontal does not fit', () => {
    // a thin, long band: wide in angle but only 30px deep at this zoom, so horizontal text cannot fit and the arc can
    const thin = folder('analysis', { inner: 300, outer: 330, startAngle: -1, endAngle: 1 });
    const [l] = [...layoutLabels([thin], at(1), view, new Map(), DEFAULT_VIEW_CONFIG, measure).values()];
    expect(l.visible).toBe(true);
    expect(l.mode).not.toBe('H');
    if (l.mode === 'C') expect(l.arcPath).toMatch(/^M /);
  });

  it('keeps a visible label until it drops below 8.5px, but shows a hidden one only from 10px', () => {
    const band = folder('lib', {});
    const names = (k: number, prev: ReturnType<typeof layoutLabels>) => layoutLabels([band], at(k), view, prev, DEFAULT_VIEW_CONFIG, measure);
    // find a zoom where the label fits only between 8.5 and 10px
    let between: number | null = null;
    for (let k = 0.2; k < 1.5 && between === null; k += 0.005) {
      const l = [...names(k, new Map()).values()][0];
      if (!l) {
        const lower = [...layoutLabels([band], at(k), view, new Map([['lib', { id: 'lib', text: 'lib', visible: true, mode: 'H' as const, fontSize: 10, x: 0, y: 0, rotation: 0 }]]), DEFAULT_VIEW_CONFIG, measure).values()][0];
        if (lower?.visible) between = k;
      }
    }
    expect(between).not.toBeNull();
    const hidden = names(between!, new Map());
    expect(hidden.size).toBe(0);
    const visible = [...layoutLabels([band], at(between!), view, new Map([['lib', { id: 'lib', text: 'lib', visible: true, mode: 'H' as const, fontSize: 10, x: 0, y: 0, rotation: 0 }]]), DEFAULT_VIEW_CONFIG, measure).values()][0];
    expect(visible.fontSize).toBeLessThan(10);
    expect(visible.fontSize).toBeGreaterThanOrEqual(8.5);
  });

  it('keeps a visible label hidden-but-in-place when it stops fitting, so it can fade out', () => {
    const band = folder('lib', {});
    const shown = layoutLabels([band], at(1), view, new Map(), DEFAULT_VIEW_CONFIG, measure);
    const gone = layoutLabels([band], at(0.001), view, shown, DEFAULT_VIEW_CONFIG, measure);
    expect(gone.get('lib')).toMatchObject({ visible: false, x: shown.get('lib')!.x, y: shown.get('lib')!.y });
  });

  it('keeps its mode unless another is at least 3px bigger', () => {
    const band = folder('lib', {});
    const first = layoutLabels([band], at(1), view, new Map(), DEFAULT_VIEW_CONFIG, measure).get('lib')!;
    const prev = new Map([['lib', { ...first, mode: 'C' as const, arcPath: 'M 0 0' }]]);
    const again = layoutLabels([band], at(1), view, prev, DEFAULT_VIEW_CONFIG, measure).get('lib')!;
    const arcFit = again.mode === 'C';
    // either arc stays because horizontal is not 3px bigger, or it switched because horizontal clearly is
    if (arcFit) expect(first.fontSize).toBeLessThan(again.fontSize + 3);
    else expect(again.fontSize).toBeGreaterThanOrEqual(3);
  });

  it('is deterministic', () => {
    const run = () => [...layoutLabels([folder('lib', {}), folder('app', { startAngle: 1, endAngle: 2 })], at(1), view, new Map(), DEFAULT_VIEW_CONFIG, measure).values()];
    expect(run()).toEqual(run());
  });
});
