import type { DiagnosticRule } from '../diagnostic-rule.js';
import { advice, candidate } from './helpers.js';

export const mapViewInvalidRule: DiagnosticRule = {
  id: 'map.view-invalid', title: 'Invalid map view', description: 'Detects invalid center coordinates or resolution.', defaultSeverity: 'error',
  run: (snapshot) => {
    const { center, resolution, projectionCode } = snapshot.map;
    const invalidResolution = resolution !== undefined && (resolution === null || !Number.isFinite(resolution) || resolution <= 0);
    const invalidCenter = center?.some((value) => value === null || !Number.isFinite(value)) ?? false;
    if (!invalidResolution && !invalidCenter) return [];
    return [candidate('map.view-invalid', 'invalid-view', 'error', 'Map view contains invalid values', 'The map view has a non-finite center coordinate or a non-positive/non-finite resolution.', { resolution: resolution ?? null, center: center ? JSON.stringify(center) : null, projectionCode: projectionCode ?? null }, undefined, 'Map', advice.view)];
  },
};
