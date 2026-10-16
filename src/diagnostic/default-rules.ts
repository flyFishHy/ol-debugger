import { intersectsExtent } from '../snapshot/extent-utils.js';
import type { DiagnosticIssueCandidate } from '../issue/issue-types.js';
import type { LayerSnapshot, DebugSnapshot, Extent } from '../snapshot/snapshot-types.js';
import type { DiagnosticRule } from './diagnostic-rule.js';

const suggestions = {
  visibility: ['Check the layer visibility setting and any parent layer groups.'],
  opacity: ['Check opacity settings on this layer and its parent groups.'],
  view: ['Check that the View has a finite center and a positive finite resolution.'],
  zoom: ['Compare the current zoom with the layer minZoom and maxZoom settings.'],
  resolution: ['Compare the current resolution with the layer resolution limits.'],
  extent: ['Confirm the layer extent and map view use the same projection and coordinate space.'],
  source: ['Check the request URL, browser network panel, server response, authentication, and CORS configuration.'],
};

function candidate(
  ruleId: string,
  fingerprint: string,
  severity: DiagnosticIssueCandidate['severity'],
  title: string,
  message: string,
  evidence: DiagnosticIssueCandidate['evidence'],
  objectId?: string,
  objectLabel?: string,
  advice: string[] = [],
): DiagnosticIssueCandidate {
  return { ruleId, fingerprint, severity, title, message, evidence, suggestions: [...advice], ...(objectId ? { objectId } : {}), ...(objectLabel ? { objectLabel } : {}) };
}

function descendants(snapshot: DebugSnapshot, layer: LayerSnapshot): number {
  const map = new Map(snapshot.layers.map((item) => [item.id, item]));
  let total = 0;
  const visit = (id: string): void => { const current = map.get(id); if (current) { total += 1; current.childIds.forEach(visit); } };
  layer.childIds.forEach(visit);
  return total;
}


export function createDefaultRules(): DiagnosticRule[] {
  return [
    {
      id: 'map.view-invalid', title: 'Invalid map view', description: 'Detects invalid center coordinates or resolution.', defaultSeverity: 'error',
      run: (snapshot) => {
        const { center, resolution, projectionCode } = snapshot.map;
        const invalidResolution = resolution !== undefined && (resolution === null || !Number.isFinite(resolution) || resolution <= 0);
        const invalidCenter = center?.some((value) => value === null || !Number.isFinite(value)) ?? false;
        if (!invalidResolution && !invalidCenter) return [];
        return [candidate('map.view-invalid', 'invalid-view', 'error', 'Map view contains invalid values', 'The map view has a non-finite center coordinate or a non-positive/non-finite resolution.', { resolution: resolution ?? null, center: center ? JSON.stringify(center) : null, projectionCode: projectionCode ?? null }, undefined, 'Map', suggestions.view)];
      },
    },
    {
      id: 'layer.visibility-disabled', title: 'Layer hidden', description: 'Finds layers hidden directly or by an ancestor group.', defaultSeverity: 'warning',
      run: (snapshot) => {
        const byId = new Map(snapshot.layers.map((layer) => [layer.id, layer]));
        const output: DiagnosticIssueCandidate[] = [];
        for (const layer of snapshot.layers) {
          if (layer.effectivelyVisible) continue;
          let hiddenAncestor: LayerSnapshot | undefined;
          let parentId = layer.parentId;
          while (parentId) {
            const parent = byId.get(parentId);
            if (parent && !parent.visible) { hiddenAncestor = parent; break; }
            parentId = parent?.parentId;
          }
          if (hiddenAncestor) continue;
          const affectedDescendantCount = layer.kind === 'group' ? descendants(snapshot, layer) : 0;
          output.push(candidate('layer.visibility-disabled', 'not-visible', 'warning', 'Layer is not visible', 'Layer is set to invisible.', {
            visible: layer.visible, parentId: layer.parentId ?? null, effectivelyVisible: layer.effectivelyVisible,
            ...(layer.kind === 'group' ? { affectedDescendantCount } : {}),
          }, layer.id, layer.title, suggestions.visibility));
        }
        return output;
      },
    },
    {
      id: 'layer.opacity-zero', title: 'Layer fully transparent', description: 'Finds top-most nodes whose effective opacity is zero.', defaultSeverity: 'warning',
      run: (snapshot) => {
        const byId = new Map(snapshot.layers.map((layer) => [layer.id, layer]));
        return snapshot.layers.filter((layer) => layer.effectiveOpacity === 0 && (!layer.parentId || byId.get(layer.parentId)?.effectiveOpacity !== 0))
          .map((layer) => candidate('layer.opacity-zero', 'effective-opacity-zero', 'warning', 'Layer has zero effective opacity', 'This layer or one of its parent groups has opacity set to zero.', { opacity: layer.opacity, effectiveOpacity: layer.effectiveOpacity, parentId: layer.parentId ?? null }, layer.id, layer.title, suggestions.opacity));
      },
    },
    {
      id: 'layer.zoom-limit', title: 'Layer outside zoom range', description: 'Checks current zoom against the layer zoom limits.', defaultSeverity: 'info',
      run: (snapshot) => {
        const zoom = snapshot.map.zoom;
        if (zoom === undefined || zoom === null) return [];
        return snapshot.layers.filter((layer) => layer.kind !== 'group' && (zoom <= (layer.minZoom ?? -Infinity) || zoom > (layer.maxZoom ?? Infinity)))
          .map((layer) => candidate('layer.zoom-limit', 'zoom-out-of-range', 'info', 'Layer is outside its zoom range', `Current zoom ${zoom} does not satisfy this layer's zoom limits.`, { zoom, minZoom: layer.minZoom ?? null, maxZoom: layer.maxZoom ?? null }, layer.id, layer.title, suggestions.zoom));
      },
    },
    {
      id: 'layer.resolution-limit', title: 'Layer outside resolution range', description: 'Checks current resolution against layer resolution limits.', defaultSeverity: 'info',
      run: (snapshot) => {
        const resolution = snapshot.map.resolution;
        if (resolution === undefined || resolution === null || !Number.isFinite(resolution)) return [];
        return snapshot.layers.filter((layer) => layer.kind !== 'group' && (resolution < (layer.minResolution ?? 0) || resolution >= (layer.maxResolution ?? Infinity)))
          .map((layer) => candidate('layer.resolution-limit', 'resolution-out-of-range', 'info', 'Layer is outside its resolution range', `Current resolution ${resolution} does not satisfy this layer's resolution limits.`, { resolution, minResolution: layer.minResolution ?? null, maxResolution: layer.maxResolution ?? null }, layer.id, layer.title, suggestions.resolution));
      },
    },
    {
      id: 'layer.outside-extent', title: 'Layer outside map extent', description: 'Finds layer extents that do not intersect the current map view.', defaultSeverity: 'warning',
      run: (snapshot) => {
        const output: DiagnosticIssueCandidate[] = [];
        const byId = new Map(snapshot.layers.map((layer) => [layer.id, layer]));
        const outOfViewGroups = new Set<string>();
        for (const layer of snapshot.layers) {
          let parentId = layer.parentId;
          let coveredByGroup = false;
          while (parentId) {
            if (outOfViewGroups.has(parentId)) { coveredByGroup = true; break; }
            parentId = byId.get(parentId)?.parentId;
          }
          if (coveredByGroup || !layer.extent || !snapshot.map.viewExtent) continue;
          if (!intersectsExtent(layer.extent, snapshot.map.viewExtent)) {
            output.push(candidate('layer.outside-extent', 'extent-not-intersecting', 'warning', 'Layer is outside the current map view', 'The layer extent does not intersect the current view extent.', { mapExtent: snapshot.map.viewExtent.join(','), layerExtent: layer.extent.join(','), projectionCode: snapshot.map.projectionCode ?? null }, layer.id, layer.title, suggestions.extent));
            if (layer.kind === 'group') outOfViewGroups.add(layer.id);
          }
        }
        return output;
      },
    },
    {
      id: 'source.load-error', title: 'Source load error', description: 'Reports explicit source errors observed through supported public events.', defaultSeverity: 'error',
      run: (snapshot) => Object.values(snapshot.sourceEvents).filter((source) => source.state === 'error' || source.lastError !== undefined)
        .map((source) => candidate('source.load-error', source.lastError?.eventName ?? 'source-error', 'error', 'Source reported a load error', 'A source reported a load error. The event does not identify its root cause.', { sourceId: source.id, sourceType: source.type, state: source.state, eventName: source.lastError?.eventName ?? null, occurredAt: source.lastError?.occurredAt ?? null }, source.id, source.type, suggestions.source)),
    },
    {
      id: 'layer.source-unavailable', title: 'Layer source unavailable', description: 'Finds standard source-backed layers without a source.', defaultSeverity: 'warning',
      run: (snapshot) => snapshot.layers.filter((layer) => layer.kind === 'layer' && !layer.source && /TileLayer|ImageLayer|VectorLayer|VectorTileLayer/.test(layer.className))
        .map((layer) => candidate('layer.source-unavailable', 'source-missing', 'warning', 'Layer has no source', 'This standard source-backed layer does not currently have a source.', { layerId: layer.id, layerClass: layer.className }, layer.id, layer.title, suggestions.source)),
    },
  ];
}

export function isExtent(value: readonly number[] | undefined): value is Extent {
  return value !== undefined && value.length === 4 && value.every(Number.isFinite);
}
