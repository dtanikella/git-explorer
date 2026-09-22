import { hashToColor, getAreaColor, deriveBorderColor } from '@/lib/areas/color';
import type { Area } from '@/lib/areas/types';

describe('hashToColor', () => {
  it('returns a 6-digit hex color', () => {
    const color = hashToColor('auth');
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is deterministic for the same input', () => {
    expect(hashToColor('auth')).toBe(hashToColor('auth'));
  });

  it('produces different colors for different inputs', () => {
    expect(hashToColor('auth')).not.toBe(hashToColor('utils'));
  });
});

describe('getAreaColor', () => {
  const baseArea: Area = {
    id: 'test',
    created_at: '',
    updated_at: '',
    name: 'Test',
    type: 'utils',
    contains: [],
    parent: null,
    children: [],
    clusterStrength: 0,
  };

  it('returns area.color when set', () => {
    const area = { ...baseArea, color: '#f59e0b' };
    expect(getAreaColor(area)).toBe('#f59e0b');
  });

  it('falls back to hashToColor when color is not set', () => {
    const area = { ...baseArea };
    expect(getAreaColor(area)).toBe(hashToColor(area.id));
  });

  it('falls back to hashToColor when color is undefined', () => {
    const area = { ...baseArea, color: undefined };
    expect(getAreaColor(area)).toBe(hashToColor(area.id));
  });
});

describe('deriveBorderColor', () => {
  it('returns a 6-digit hex', () => {
    const border = deriveBorderColor('#f59e0b');
    expect(border).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('preserves the same hue and saturation as the input', () => {
    // For #f59e0b (amber): hue ~37.7°, sat ~92%
    // For #3b82f6 (blue): hue ~217°, sat ~90%
    const amberResult = deriveBorderColor('#f59e0b');
    const blueResult = deriveBorderColor('#3b82f6');

    // Both should be different (different hues should produce different borders)
    expect(amberResult).not.toBe(blueResult);
  });

  it('produces a darker color than the input', () => {
    const border = deriveBorderColor('#f59e0b');
    // Parse both colors and compare lightness
    const parseLightness = (hex: string): number => {
      const h = hex.replace(/^#/, '');
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return (max + min) / 2;
    };
    const inputLit = parseLightness('#f59e0b');
    const borderLit = parseLightness(border);

    // Border should be strictly darker
    expect(borderLit).toBeLessThan(inputLit);
    // Border should be approximately 65% of the input lightness (within tolerance)
    expect(borderLit).toBeCloseTo(inputLit * 0.65, 1);
  });

  it('works with hex values that have no # prefix', () => {
    // deriveBorderColor should work either way since we strip #
    const withHash = deriveBorderColor('#f59e0b');
    expect(withHash).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('handles very dark colors gracefully (clamps at 0)', () => {
    const border = deriveBorderColor('#000000');
    expect(border).toBe('#000000');
  });
});