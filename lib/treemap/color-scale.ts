// Color scale utility for git treemap feature
// Maps frequencyScore [0,1] to color from #E5E5E5 (light gray) to #006400 (dark green)

function lerpColor(a: string, b: string, t: number): string {
  // a, b: hex colors, t: 0-1
  const ah = a.replace('#', '');
  const bh = b.replace('#', '');
  const ar = parseInt(ah.substring(0, 2), 16);
  const ag = parseInt(ah.substring(2, 4), 16);
  const ab = parseInt(ah.substring(4, 6), 16);
  const br = parseInt(bh.substring(0, 2), 16);
  const bg = parseInt(bh.substring(2, 4), 16);
  const bb = parseInt(bh.substring(4, 6), 16);
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `#${rr.toString(16).padStart(2, '0')}${rg.toString(16).padStart(2, '0')}${rb.toString(16).padStart(2, '0')}`;
}

export function frequencyToColor(score: number): string {
  // Clamp score to [0,1]
  const t = Math.max(0, Math.min(1, score));
  // 0 = light gray, 1 = dark green
  return lerpColor('#E5E5E5', '#006400', t);
}
