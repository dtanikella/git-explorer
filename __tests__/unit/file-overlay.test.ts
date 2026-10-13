// the repo's global d3 mock has no `line`; the overlay outline only needs one that walks the points
jest.mock('d3', () => ({
  curveCatmullRomClosed: { alpha: () => null },
  line: () => {
    let ctx: CanvasRenderingContext2D;
    const gen = (points: [number, number][]) => points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    gen.curve = () => gen;
    gen.context = (c: CanvasRenderingContext2D) => ((ctx = c), gen);
    return gen;
  },
}));

import {
  DEFAULT_FILE_OVERLAY,
  OVERLAY_ANGLES,
  computeFileOverlays,
  drawFileOverlays,
  overlayAt,
  overlayContains,
  overlayRadiusAt,
  type FileOverlayConfig,
  type OverlayInput,
  type OverlayMember,
} from '@/lib/analysis/file-overlay';
import { ancestorFolders, buildDirectoryHubs, folderHubId } from '@/lib/analysis/directory-hubs';

const cfg = (over: Partial<FileOverlayConfig> = {}): FileOverlayConfig => ({
  ...DEFAULT_FILE_OVERLAY,
  minMembers: 1,
  padding: 0,
  ...over,
});

/** `n` members evenly spaced on a circle of radius `r` around (cx, cy) */
function ring(n: number, r: number, cx = 0, cy = 0): OverlayMember[] {
  return Array.from({ length: n }, (_, i) => ({
    x: cx + r * Math.cos((2 * Math.PI * i) / n),
    y: cy + r * Math.sin((2 * Math.PI * i) / n),
    r: 0,
  }));
}

/** deterministic scatter, so the containment test is repeatable */
function scatter(n: number, spread: number): OverlayMember[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296) - 0.5;
  return Array.from({ length: n }, () => ({ x: rnd() * spread, y: rnd() * spread * 0.6, r: 3 }));
}

const file = (path: string, members: OverlayMember[], extra: Partial<OverlayInput> = {}): OverlayInput => ({
  id: path,
  path,
  center: { x: 0, y: 0 },
  members,
  ...extra,
});

describe('directory helpers', () => {
  it('lists the folders above a file, nearest first, ending at the root', () => {
    expect(ancestorFolders('src/ui/a.ts')).toEqual(['src/ui', 'src', '']);
    expect(ancestorFolders('top.ts')).toEqual(['']);
  });

  it('matches the folder hubs buildDirectoryHubs creates', () => {
    const { hubs } = buildDirectoryHubs([{ id: 'a', filePath: 'src/ui/a.ts' }]);
    const ids = new Set(hubs.map((h) => h.id));
    for (const f of ancestorFolders('src/ui/a.ts')) expect(ids.has(folderHubId(f))).toBe(true);
  });
});

describe('computeFileOverlays', () => {
  it('draws a circle around evenly spread members', () => {
    const o = computeFileOverlays([file('src/a.ts', ring(40, 100))], cfg({ percentile: 1 })).get('src/a.ts')!;
    expect(o.radii).toHaveLength(OVERLAY_ANGLES);
    expect(o.name).toBe('a.ts');
    expect(o.baseRadius).toBeCloseTo(100, 0);
    expect(Math.max(...o.radii)).toBeCloseTo(Math.min(...o.radii), 0);
  });

  it('contains every member by default, however scattered', () => {
    const members = scatter(60, 400);
    const o = computeFileOverlays([file('src/a.ts', members)], { ...cfg(), padding: 6 }).get('src/a.ts')!;
    for (const m of members) expect(overlayContains(o, m.x, m.y)).toBe(true);
  });

  it('hugs the members: a lower percentile and a narrower mold give a smaller area', () => {
    const members = scatter(60, 400);
    const area = (o: { radii: Float64Array }) => Array.from(o.radii).reduce((a, r) => a + r * r, 0);
    const loose = computeFileOverlays([file('a', members)], cfg({ percentile: 1, smooth: 90 })).get('a')!;
    const tight = computeFileOverlays([file('a', members)], cfg({ percentile: 0.5, smooth: 15 })).get('a')!;
    expect(area(tight)).toBeLessThan(area(loose));
    for (const m of members) expect(overlayContains(tight, m.x, m.y)).toBe(true);
  });

  it('molds toward an outlier beyond the circle', () => {
    const members = [...ring(40, 100), { x: 220, y: 0, r: 0 }];
    const o = computeFileOverlays([file('a', members)], cfg({ percentile: 0.9 })).get('a')!;
    expect(o.baseRadius).toBeLessThan(220);
    expect(overlayContains(o, 220, 0)).toBe(true);
    expect(overlayRadiusAt(o, 0)).toBeGreaterThan(overlayRadiusAt(o, Math.PI));
  });

  it('leaves a member beyond a finite reach cap uncovered', () => {
    const members = [...ring(40, 100), { x: 800, y: 0, r: 0 }];
    const capped = computeFileOverlays([file('a', members)], cfg({ percentile: 0.9, reach: 3 })).get('a')!;
    expect(overlayContains(capped, 800, 0)).toBe(false);
  });

  it('skips small files and files whose hub has no position yet', () => {
    const out = computeFileOverlays(
      [file('big', ring(5, 50)), file('small', ring(2, 50)), file('unplaced', ring(5, 50), { center: null })],
      cfg({ minMembers: 3 }),
    );
    expect([...out.keys()]).toEqual(['big']);
  });

  it('keeps a small file listed in keepIds, but not an empty or unplaced one', () => {
    const out = computeFileOverlays(
      [file('big', ring(5, 50)), file('small', ring(2, 50)), file('tiny', ring(1, 50)), file('empty', []), file('unplaced', ring(5, 50), { center: null }), file('other', ring(2, 50))],
      cfg({ minMembers: 3 }),
      new Set(['small', 'tiny', 'empty', 'unplaced']),
    );
    expect([...out.keys()].sort()).toEqual(['big', 'small', 'tiny']);
  });

  it('picks the tightest overlay under a point', () => {
    const out = computeFileOverlays([file('wide', ring(30, 200)), file('narrow', ring(30, 50))], cfg({ percentile: 1 }));
    expect(overlayAt(out.values(), 0, 0)!.id).toBe('narrow');
    expect(overlayAt(out.values(), 150, 0)!.id).toBe('wide');
    expect(overlayAt(out.values(), 5000, 0)).toBeNull();
  });
});

describe('drawFileOverlays emphasis', () => {
  /** a recording stand-in for a canvas context: every stroke and fill is logged with the style it was drawn in */
  function recorder() {
    const log: { op: 'fill' | 'stroke'; style: string; blur: number; dash: number[] }[] = [];
    let dash: number[] = [];
    const ctx = {
      fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, shadowColor: '', shadowBlur: 0, font: '', textAlign: '', textBaseline: '',
      save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, quadraticCurveTo() {}, rect() {}, fillText() {},
      setLineDash(d: number[]) { dash = d; },
      measureText: () => ({ width: 40 }),
      fill() { log.push({ op: 'fill', style: String(ctx.fillStyle), blur: ctx.shadowBlur, dash }); },
      stroke() { log.push({ op: 'stroke', style: String(ctx.strokeStyle), blur: ctx.shadowBlur, dash }); },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
  }

  const overlays = () => [...computeFileOverlays([file('a', ring(5, 50)), file('b', ring(5, 50))], cfg()).values()];

  it('outlines an emphasized overlay in its accent, solid when locked and dashed when selected', () => {
    for (const [level, dashed] of [['locked', false], ['selected', true]] as const) {
      const { ctx, log } = recorder();
      drawFileOverlays(ctx, overlays(), cfg(), null, { theme: 'dark', emphasis: new Map([['a', { level, accent: '#4ade80' }]]) });
      const outline = log.find((e) => e.op === 'stroke' && e.style === '#4ade80')!;
      expect(outline).toBeDefined();
      expect(outline.dash.length > 0).toBe(dashed);
      expect(outline.blur).toBe(0);
      expect(log.some((e) => e.op === 'fill' && e.style === '#4ade80' && e.blur > 0)).toBe(true);
    }
  });

  it('draws overlays without emphasis in their own color, never the accent', () => {
    const { ctx, log } = recorder();
    drawFileOverlays(ctx, overlays(), cfg(), null, { theme: 'dark', emphasis: new Map([['a', { level: 'locked', accent: '#4ade80' }]]) });
    expect(log.filter((e) => e.style === '#4ade80').length).toBeLessThan(log.length);
    expect(log.some((e) => e.style !== '#4ade80')).toBe(true);
  });

  it('drops the glow once more than 150 overlays are emphasized', () => {
    const many = Array.from({ length: 151 }, (_, i) => file('f' + i, ring(5, 50)));
    const emphasis = new Map(many.map((f) => [f.id, { level: 'locked' as const, accent: '#4ade80' }]));
    const { ctx, log } = recorder();
    drawFileOverlays(ctx, [...computeFileOverlays(many, cfg()).values()], cfg(), null, { theme: 'dark', emphasis });
    expect(log.every((e) => e.blur === 0)).toBe(true);
  });
});
