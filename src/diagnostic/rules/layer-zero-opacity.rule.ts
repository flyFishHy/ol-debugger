import type { DiagnosticRule } from '../diagnostic-rule.js';
import { advice, candidate } from './helpers.js';

export const layerZeroOpacityRule: DiagnosticRule = {
  id: 'layer.opacity-zero', title: 'Layer fully transparent', description: 'Finds top-most nodes whose effective opacity is zero.', defaultSeverity: 'warning',
  run: (snapshot) => {
    const byId = new Map(snapshot.layers.map((layer) => [layer.id, layer]));
    return snapshot.layers.filter((layer) => layer.effectiveOpacity === 0 && (!layer.parentId || byId.get(layer.parentId)?.effectiveOpacity !== 0))
      .map((layer) => candidate('layer.opacity-zero', 'effective-opacity-zero', 'warning', 'Layer has zero effective opacity', 'This layer or one of its parent groups has opacity set to zero.', { opacity: layer.opacity, effectiveOpacity: layer.effectiveOpacity, parentId: layer.parentId ?? null }, layer.id, layer.title, advice.opacity));
  },
};
