import type { Extent } from './snapshot-types.js';

export function isValidExtent(value: readonly number[] | undefined): value is Extent {
  return value !== undefined
    && value.length === 4
    && value.every(Number.isFinite)
    && value[0]! <= value[2]!
    && value[1]! <= value[3]!;
}

export function intersectsExtent(a: Extent, b: Extent): boolean {
  if (!isValidExtent(a) || !isValidExtent(b)) return false;
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
