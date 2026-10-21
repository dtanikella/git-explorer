/** A d3-zoom transform as plain numbers: screen = point * k + (x, y). */
export interface CameraTransform {
  x: number;
  y: number;
  k: number;
}

export interface FitOptions {
  viewport: { width: number; height: number };
  /** the width the docked card takes, including its margin, kept clear on the right */
  cardWidth: number;
  /** the zoom that fits the whole diagram, which bounds how far the fit may zoom out or in */
  defaultFit: number;
  /** smallest box fitted, in layout units, so a lone target does not zoom in absurdly far */
  minBox?: number;
  padX?: number;
  padY?: number;
}

/**
 * The camera that puts one layout point at the centre of the area left of the docked card, keeping the zoom.
 *
 * @param point - Layout position to centre.
 * @param viewport - The svg's size.
 * @param cardWidth - The width the docked card takes, including its margin, kept clear on the right.
 * @param k - The zoom to keep.
 * @returns A transform to hand to d3-zoom.
 */
export function centreOn(point: { x: number; y: number }, viewport: { width: number; height: number }, cardWidth: number, k: number): CameraTransform {
  return { x: (viewport.width - cardWidth) / 2 - point.x * k, y: viewport.height / 2 - point.y * k, k };
}

/** Zoom limits relative to the default fit. */
const MIN_ZOOM_FACTOR = 1 / 4;
const MAX_ZOOM_FACTOR = 6;

/**
 * The camera that shows a set of layout points, clear of the docked card.
 *
 * @remarks
 * Fits the points' bounding box (at least `minBox` square) into the viewport minus the card and padding, centred in the
 * area left of the card. Zoom is clamped between a quarter and six times the default fit.
 *
 * @param points - Layout positions to show: the pinned symbol and a category's targets.
 * @returns A transform to hand to d3-zoom.
 */
export function fitTransform(points: readonly { x: number; y: number }[], opts: FitOptions): CameraTransform {
  const { viewport, cardWidth, defaultFit, minBox = 240, padX = 60, padY = 80 } = opts;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const w = Math.max(Math.max(...xs) - Math.min(...xs), minBox);
  const h = Math.max(Math.max(...ys) - Math.min(...ys), minBox);

  const areaW = Math.max(viewport.width - cardWidth - padX, 1);
  const areaH = Math.max(viewport.height - padY, 1);
  const k = Math.min(Math.max(Math.min(areaW / w, areaH / h), defaultFit * MIN_ZOOM_FACTOR), defaultFit * MAX_ZOOM_FACTOR);
  const centreX = (viewport.width - cardWidth) / 2;
  const centreY = viewport.height / 2;
  return { x: centreX - cx * k, y: centreY - cy * k, k };
}
