import type { DiagnosticRule } from '../diagnostic-rule.js';
import type { LayerSnapshot } from '../../snapshot/snapshot-types.js';
import { advice, candidate, descendantCount } from './helpers.js';

export const layerHiddenRule: DiagnosticRule = {
  id: 'layer.visibility-disabled', title: 'Layer hidden', description: 'Finds layers hidden directly or by an ancestor group.', defaultSeverity: 'warning',
  run: (snapshot) => {
    const byId = new Map(snapshot.layers.map((layer) => [layer.id, layer]));
    const output = [];
    for (const layer of snapshot.layers) {
      if (layer.effectivelyVisible) continue;
      let hiddenAncestor: LayerSnapshot | undefined;
      let parentId = layer.parentId;
      while (parentId) { const parent = byId.get(parentId); if (parent && !parent.visible) { hiddenAncestor = parent; break; } parentId = parent?.parentId; }
      if (hiddenAncestor) continue;
      const affected = layer.kind === 'group' ? descendantCount(snapshot, layer) : 0;
      output.push(candidate('layer.visibility-disabled', 'not-visible', 'warning', 'Layer is not visible', 'This layer is explicitly set to invisible.', { visible: layer.visible, parentId: layer.parentId ?? null, effectivelyVisible: layer.effectivelyVisible, ...(layer.kind === 'group' ? { affectedDescendantCount: affected } : {}) }, layer.id, layer.title, advice.visibility));
    }
    return output;
  },
};
