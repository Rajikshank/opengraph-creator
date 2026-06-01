export interface PerspectivePoint {
  x: number;
  y: number;
}

export type PerspectiveQuad = [PerspectivePoint, PerspectivePoint, PerspectivePoint, PerspectivePoint];

const DEFAULT_QUAD: PerspectiveQuad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 }
];

export function clampPerspectivePoint(point: PerspectivePoint): PerspectivePoint {
  return {
    x: clamp01(point.x),
    y: clamp01(point.y)
  };
}

export function normalizePerspectiveQuad(points: Array<PerspectivePoint> | undefined): PerspectiveQuad {
  if (!points || points.length !== 4) return cloneDefaultQuad();
  return [
    clampPerspectivePoint(points[0] ?? DEFAULT_QUAD[0]),
    clampPerspectivePoint(points[1] ?? DEFAULT_QUAD[1]),
    clampPerspectivePoint(points[2] ?? DEFAULT_QUAD[2]),
    clampPerspectivePoint(points[3] ?? DEFAULT_QUAD[3])
  ];
}

export function isDefaultPerspectiveQuad(points: Array<PerspectivePoint> | undefined, tolerance = 0.001): boolean {
  const quad = normalizePerspectiveQuad(points);
  return quad.every((point, index) => Math.abs(point.x - DEFAULT_QUAD[index].x) <= tolerance && Math.abs(point.y - DEFAULT_QUAD[index].y) <= tolerance);
}

export function getPerspectiveBounds(
  frame: { x: number; y: number; width: number; height: number },
  points: Array<PerspectivePoint> | undefined
): { x: number; y: number; width: number; height: number } {
  const absolute = normalizePerspectiveQuad(points).map((point) => ({
    x: frame.x + point.x * frame.width,
    y: frame.y + point.y * frame.height
  }));
  const left = Math.min(...absolute.map((point) => point.x));
  const top = Math.min(...absolute.map((point) => point.y));
  const right = Math.max(...absolute.map((point) => point.x));
  const bottom = Math.max(...absolute.map((point) => point.y));
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top)
  };
}

function cloneDefaultQuad(): PerspectiveQuad {
  return DEFAULT_QUAD.map((point) => ({ ...point })) as PerspectiveQuad;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
