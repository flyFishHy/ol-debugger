import type { DiagnosticRule } from '../diagnostic-rule.js';
import { advice, candidate } from './helpers.js';

const sourceBackedLayerClasses = new Set(['TileLayer', 'ImageLayer', 'VectorLayer', 'VectorTileLayer', 'VectorImageLayer']);

export const layerSourceUnavailableRule: DiagnosticRule = {
  id: 'layer.source-unavailable', title: 'Layer source unavailable', description: 'Finds standard source-backed layers without a source.', defaultSeverity: 'warning',
  run: (snapshot) => snapshot.layers.filter((layer) => layer.kind === 'layer' && !layer.source && sourceBackedLayerClasses.has(layer.className))
    .map((layer) => candidate('layer.source-unavailable', 'source-missing', 'warning', 'Layer has no source', 'This standard source-backed layer does not currently have a source.', { layerId: layer.id, layerClass: layer.className }, layer.id, layer.title, advice.source)),
};
