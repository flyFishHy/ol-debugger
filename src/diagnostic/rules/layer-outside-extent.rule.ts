import { intersectsExtent } from '../../snapshot/extent-utils.js';
import type { DiagnosticRule } from '../diagnostic-rule.js';
import { advice, candidate } from './helpers.js';

export const layerOutsideExtentRule: DiagnosticRule = {
  id: 'layer.outside-extent', title: 'Layer outside map extent', description: 'Finds layer extents that do not intersect the current map view.', defaultSeverity: 'warning',
  run: (snapshot) => {
    const output = [];
    const byId = new Map(snapshot.layers.map((layer) => [layer.id, layer]));
    const excludedDescendants = new Set<string>();
    for (const layer of snapshot.layers) {
      let parentId = layer.parentId;
      let covered = false;
      while (parentId) { if (excludedDescendants.has(parentId)) { covered = true; break; } parentId = byId.get(parentId)?.parentId; }
      if (covered || !layer.extent || !snapshot.map.viewExtent || intersectsExtent(layer.extent, snapshot.map.viewExtent)) continue;
      output.push(candidate('layer.outside-extent', 'extent-not-intersecting', 'warning', 'Layer is outside the current map view', 'The layer extent does not intersect the current view extent.', { mapExtent: snapshot.map.viewExtent.join(','), layerExtent: layer.extent.join(','), projectionCode: snapshot.map.projectionCode ?? null }, layer.id, layer.title, advice.extent));
      if (layer.kind === 'group') excludedDescendants.add(layer.id);
    }
    return output;
  },
};
