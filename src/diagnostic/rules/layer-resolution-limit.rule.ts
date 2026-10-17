import type { DiagnosticRule } from '../diagnostic-rule.js';
import { advice, candidate } from './helpers.js';

export const layerResolutionLimitRule: DiagnosticRule = {
  id: 'layer.resolution-limit', title: 'Layer outside resolution range', description: 'Checks current resolution against layer resolution limits.', defaultSeverity: 'info',
  run: (snapshot) => {
    const resolution = snapshot.map.resolution;
    if (resolution === undefined || resolution === null || !Number.isFinite(resolution)) return [];
    return snapshot.layers.filter((layer) => resolution < (layer.minResolution ?? 0) || resolution >= (layer.maxResolution ?? Infinity))
      .map((layer) => candidate('layer.resolution-limit', 'resolution-out-of-range', 'info', 'Layer is outside its resolution range', `Current resolution ${resolution} does not satisfy this layer's resolution limits.`, { resolution, minResolution: layer.minResolution ?? null, maxResolution: layer.maxResolution ?? null }, layer.id, layer.title, advice.resolution));
  },
};
