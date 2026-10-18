import { DEFAULT_VIEW_CONFIG, bandHue, bandStyle, edgeLength, edgeStyle, nodeStyle } from '@/lib/default/config';
import type { DisplayConfig } from '@/lib/default/config';
import { SyntaxType } from '@/lib/analysis/types';

describe('default view config', () => {
  it('starts with equal 300 radial gaps', () => {
    const ctx = { depth: 1, childColor: '#000' };
    expect(edgeLength({ ...ctx, kind: 'symbol-file' })).toBe(300);
    expect(edgeLength({ ...ctx, kind: 'file-folder' })).toBe(300);
    expect(edgeLength({ ...ctx, kind: 'folder-folder' })).toBe(300);
  });

  it('picks up a changed plain value', () => {
    const config: DisplayConfig = { ...DEFAULT_VIEW_CONFIG, edge: { ...DEFAULT_VIEW_CONFIG.edge, width: 7 } };
    expect(edgeStyle({ kind: 'file-folder', depth: 2, childColor: '#000' }, config).width).toBe(7);
  });

  it('picks up a depth- and kind-dependent rule', () => {
    const config: DisplayConfig = {
      ...DEFAULT_VIEW_CONFIG,
      edge: { ...DEFAULT_VIEW_CONFIG.edge, length: (c) => (c.kind === 'folder-folder' ? 10 * c.depth : 5) },
    };
    expect(edgeLength({ kind: 'folder-folder', depth: 3, childColor: '#000' }, config)).toBe(30);
    expect(edgeLength({ kind: 'file-folder', depth: 3, childColor: '#000' }, config)).toBe(5);
  });

  it('uses a constant node radius and gray for every tier except symbols', () => {
    const radii = new Set((['root', 'folder', 'file', 'symbol'] as const).map((tier) => nodeStyle({ tier, depth: 1, syntaxType: SyntaxType.FUNCTION }).radius));
    expect([...radii]).toEqual([5]);
    const gray = nodeStyle({ tier: 'file', depth: 1 }).color;
    expect(nodeStyle({ tier: 'folder', depth: 1 }).color).toBe(gray);
    expect(nodeStyle({ tier: 'root', depth: 0 }).color).toBe(gray);
    expect(nodeStyle({ tier: 'symbol', depth: 4, syntaxType: SyntaxType.FUNCTION }).color).not.toBe(gray);
  });

  it('keeps edge width constant and colors only symbol -> file edges', () => {
    const base = { depth: 2, childColor: '#f59e0b' };
    expect(edgeStyle({ ...base, kind: 'symbol-file' }).width).toBe(edgeStyle({ ...base, kind: 'folder-folder' }).width);
    expect(edgeStyle({ ...base, kind: 'symbol-file' }).color).toBe('#f59e0b');
    expect(edgeStyle({ ...base, kind: 'file-folder' }).color).toBe(nodeStyle({ tier: 'file', depth: 1 }).color);
    expect(edgeStyle({ ...base, kind: 'folder-folder' }).color).toBe(nodeStyle({ tier: 'folder', depth: 1 }).color);
  });

  it('lets an edge color follow its child node color', () => {
    const config: DisplayConfig = {
      ...DEFAULT_VIEW_CONFIG,
      edge: { ...DEFAULT_VIEW_CONFIG.edge, color: (c) => c.childColor },
    };
    expect(edgeStyle({ kind: 'symbol-file', depth: 3, childColor: '#abcdef' }, config).color).toBe('#abcdef');
  });

  it('resolves symbol color from syntax type', () => {
    const fn = nodeStyle({ tier: 'symbol', depth: 3, syntaxType: SyntaxType.FUNCTION });
    const cls = nodeStyle({ tier: 'symbol', depth: 3, syntaxType: SyntaxType.CLASS });
    expect(fn.color).not.toBe(cls.color);
    const config: DisplayConfig = { ...DEFAULT_VIEW_CONFIG, node: { radius: 9, color: '#123456', spacing: 5 } };
    expect(nodeStyle({ tier: 'file', depth: 1 }, config)).toEqual({ radius: 9, color: '#123456', spacing: 5 });
  });

  it('starts a top-level folder at a hue of its own and spreads sibling folders evenly around the parent hue', () => {
    const top = (topIndex: number) => bandHue({ tier: 'folder', parentHue: null, topIndex, siblingIndex: 0, siblingCount: 1 });
    expect(top(0)).not.toBe(top(1));
    const child = (siblingIndex: number, siblingCount = 3) => bandHue({ tier: 'folder', parentHue: 100, topIndex: 0, siblingIndex, siblingCount });
    expect(child(1)).toBe(100);
    expect(child(0)).toBeCloseTo(100 - 60);
    expect(child(2)).toBeCloseTo(100 + 60);
    // the spread caps at +-70deg however many siblings there are
    expect(child(0, 9)).toBeCloseTo(30);
    expect(child(8, 9)).toBeCloseTo(170);
    expect(child(0, 1)).toBe(100);
    expect(bandHue({ tier: 'folder', parentHue: 5, topIndex: 0, siblingIndex: 0, siblingCount: 3 })).toBeGreaterThanOrEqual(0);
  });

  it('gives a file the hue of its folder', () => {
    for (const i of [0, 1, 4]) expect(bandHue({ tier: 'file', parentHue: 210, topIndex: 0, siblingIndex: i, siblingCount: 5 })).toBe(210);
  });

  const lightness = (c: string) => Number(/(\d+(?:\.\d+)?)%\)$/.exec(c)![1]);

  it('steps file lightness evenly from 76% to 38% and puts a lone file at 58%', () => {
    const file = (siblingIndex: number, siblingCount: number) => lightness(bandStyle({ tier: 'file', depth: 3, path: 'a.ts', hue: 10, siblingIndex, siblingCount }).color);
    expect([file(0, 3), file(1, 3), file(2, 3)]).toEqual([76, 57, 38]);
    expect(file(0, 1)).toBe(58);
  });

  it('makes sibling bands differ in color and the first file lighter than its folder band', () => {
    const ctx = { depth: 2, path: 'lib/a', hue: 120, siblingCount: 2 };
    expect(bandStyle({ ...ctx, tier: 'folder', siblingIndex: 0 }).color).not.toBe(bandStyle({ ...ctx, tier: 'folder', siblingIndex: 1 }).color);
    expect(bandStyle({ ...ctx, tier: 'file', siblingIndex: 0 }).color).not.toBe(bandStyle({ ...ctx, tier: 'file', siblingIndex: 1 }).color);
    expect(lightness(bandStyle({ ...ctx, tier: 'file', siblingIndex: 0 }).color)).toBeGreaterThan(lightness(bandStyle({ ...ctx, tier: 'folder', siblingIndex: 1 }).color));
  });

  it('picks up a changed band color rule', () => {
    const config: DisplayConfig = { ...DEFAULT_VIEW_CONFIG, band: { ...DEFAULT_VIEW_CONFIG.band, color: (c) => (c.path.endsWith('.tsx') ? '#111111' : '#222222'), opacity: 0.5 } };
    expect(bandStyle({ tier: 'file', depth: 3, path: 'a.tsx', hue: 0, siblingIndex: 0, siblingCount: 1 }, config)).toEqual({ color: '#111111', opacity: 0.5 });
    expect(bandStyle({ tier: 'file', depth: 3, path: 'a.ts', hue: 0, siblingIndex: 0, siblingCount: 1 }, config).color).toBe('#222222');
  });
});
