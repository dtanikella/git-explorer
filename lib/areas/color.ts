import type { Area } from './types';

/**
 * Deterministic color from a string id.
 * Generates HSL with good saturation and lightness for overlay visibility.
 */
export function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue = Math.abs(hash % 360);
  const sat = 60 + Math.abs((hash >> 8) % 20); // 60-80%
  const lit = 40 + Math.abs((hash >> 16) % 15); // 40-55%
  const h = hue, s = sat / 100, l = lit / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Returns the effective color for an area:
 * - If the area has a manually-set color, use that.
 * - Otherwise fall back to the hash-derived default.
 */
export function getAreaColor(area: Area): string {
  return area.color ?? hashToColor(area.id);
}

/**
 * Derives a darker border color from a fill hex by reducing lightness
 * in HSL space by ~35% (multiplying lightness by 0.65).
 * Hue and saturation are preserved unchanged.
 */
export function deriveBorderColor(fillHex: string): string {
  // Parse hex to RGB
  const hex = fillHex.replace(/^#/, '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  // RGB → HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r: h = ((g - b) / delta + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / delta + 2) / 6; break;
      case b: h = ((r - g) / delta + 4) / 6; break;
    }
  }

  // Reduce lightness by ~35% (multiply by 0.65)
  l = Math.max(0, Math.min(1, l * 0.65));

  // HSL → RGB
  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r2: number, g2: number, b2: number;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hueToRgb(p, q, h + 1 / 3);
    g2 = hueToRgb(p, q, h);
    b2 = hueToRgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => Math.round(Math.max(0, Math.min(255, x * 255)))
    .toString(16)
    .padStart(2, '0');

  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}