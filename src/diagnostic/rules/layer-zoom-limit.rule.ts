import type { DiagnosticRule } from '../diagnostic-rule.js';
import { advice, candidate } from './helpers.js';

export const layerZoomLimitRule: DiagnosticRule = {
  id: 'layer.zoom-limit', title: 'Layer outside zoom range', description: 'Checks current zoom against layer zoom limits.', defaultSeverity: 'info',
  run: (snapshot) => {
    const zoom = snapshot.map.zoom;
    if (zoom === undefined || zoom === null) return [];
    return snapshot.layers.filter((layer) => zoom <= (layer.minZoom ?? -Infinity) || zoom > (layer.maxZoom ?? Infinity))
      .map((layer) => candidate('layer.zoom-limit', 'zoom-out-of-range', 'info', 'Layer is outside its zoom range', `Current zoom ${zoom} does not satisfy this layer's zoom limits.`, { zoom, minZoom: layer.minZoom ?? null, maxZoom: layer.maxZoom ?? null }, layer.id, layer.title, advice.zoom));
  },
};
