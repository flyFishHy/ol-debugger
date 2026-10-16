import Map from 'ol/Map.js';
import BaseLayer from 'ol/layer/Base.js';
import Layer from 'ol/layer/Layer.js';
import LayerGroup from 'ol/layer/Group.js';
import type Source from 'ol/source/Source.js';
import type { DebugSnapshot, Extent, LayerSnapshot, MapSnapshot, SourceSnapshot, SourceState } from './snapshot-types.js';
import { isValidExtent } from './extent-utils.js';
import { ObjectIdStore } from './object-id-store.js';

export type SourceStateLookup = (source: Source, id: string) => Partial<SourceSnapshot> | undefined;

function finite(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function finiteExtent(value: number[] | undefined): Extent | undefined {
  return isValidExtent(value) ? [value[0], value[1], value[2], value[3]] : undefined;
}

function normalizeLimit(value: number | undefined, sentinel: 'minimum' | 'maximum'): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (sentinel === 'minimum' && value <= 0) return undefined;
  return value;
}

export class SnapshotBuilder {
  private revision = 0;

  constructor(
    private readonly ids: ObjectIdStore,
    private readonly onError: (error: unknown, context: string) => void = () => undefined,
  ) {}

  build(map: Map, sourceState: SourceStateLookup = () => undefined): DebugSnapshot {
    const capturedAt = Date.now();
    const mapSnapshot = this.buildMapSnapshot(map, capturedAt);
    const layers: LayerSnapshot[] = [];
    const activeObjects: Array<readonly [string, object]> = [[this.ids.getMapId(map), map]];
    const sourceEvents: Record<string, SourceSnapshot> = {};
    const root = map.getLayerGroup();
    this.buildLayer(root, undefined, 0, true, 1, layers, activeObjects, sourceEvents, sourceState);
    this.ids.syncActiveObjects(activeObjects);
    return { revision: ++this.revision, capturedAt, map: mapSnapshot, layers, sourceEvents };
  }

  clearActiveObjects(): void { this.ids.clearActiveObjects(); }

  private buildMapSnapshot(map: Map, capturedAt: number): MapSnapshot {
    try {
      const view = map.getView();
      const size = map.getSize();
      const center = view.getCenter();
      const zoom = view.getZoom();
      const resolution = view.getResolution();
      const projectionCode = view.getProjection()?.getCode();
      const extent = size && size.length === 2 && size.every((item) => Number.isFinite(item) && item >= 0)
        ? finiteExtent(view.calculateExtent(size))
        : undefined;
      return {
        ...(projectionCode ? { projectionCode } : {}),
        ...(center ? { center: center.map((value) => Number.isFinite(value) ? value : null) } : {}),
        ...(zoom !== undefined ? { zoom: finite(zoom) ?? null } : {}),
        ...(resolution !== undefined ? { resolution: finite(resolution) ?? null } : {}),
        ...(finite(view.getRotation()) !== undefined ? { rotation: finite(view.getRotation()) } : {}),
        ...(size && size.every(Number.isFinite) ? { size: [size[0], size[1]] as [number, number] } : {}),
        ...(extent ? { viewExtent: extent } : {}),
        capturedAt,
      };
    } catch (error) {
      this.onError(error, 'map');
      throw error;
    }
  }

  private buildLayer(
    layer: BaseLayer,
    parentId: string | undefined,
    index: number,
    parentVisible: boolean,
    parentOpacity: number,
    output: LayerSnapshot[],
    activeObjects: Array<readonly [string, object]>,
    sourceEvents: Record<string, SourceSnapshot>,
    sourceState: SourceStateLookup,
  ): LayerSnapshot {
    const id = this.ids.getLayerId(layer);
    activeObjects.push([id, layer]);
    const className = layer.constructor.name || 'BaseLayer';
    const kind = layer instanceof LayerGroup ? 'group' : layer instanceof Layer ? 'layer' : 'unknown';
    let title = `${className} (${id})`;
    try {
      const candidate = layer.get('title') ?? layer.get('name');
      if (typeof candidate === 'string' && candidate.trim()) title = candidate.trim();
    } catch (error) { this.onError(error, `layer:${id}:title`); }

    const visible = safeRead(() => layer.getVisible(), true, this.onError, `layer:${id}:visible`);
    const opacityValue = safeRead(() => layer.getOpacity(), 1, this.onError, `layer:${id}:opacity`);
    const opacity = Number.isFinite(opacityValue) ? opacityValue : 1;
    const children = layer instanceof LayerGroup ? safeRead(() => layer.getLayers().getArray().slice(), [], this.onError, `layer:${id}:children`) : [];
    const zIndex = finite(safeRead(() => layer.getZIndex(), undefined, this.onError, `layer:${id}:zIndex`));
    const minZoom = finite(safeRead(() => layer.getMinZoom(), undefined, this.onError, `layer:${id}:minZoom`));
    const maxZoom = normalizeLimit(safeRead(() => layer.getMaxZoom(), undefined, this.onError, `layer:${id}:maxZoom`), 'maximum');
    const minResolution = normalizeLimit(safeRead(() => layer.getMinResolution(), undefined, this.onError, `layer:${id}:minResolution`), 'minimum');
    const maxResolution = normalizeLimit(safeRead(() => layer.getMaxResolution(), undefined, this.onError, `layer:${id}:maxResolution`), 'maximum');
    const extent = finiteExtent(safeRead(() => layer.getExtent() ?? undefined, undefined, this.onError, `layer:${id}:extent`));
    const childIds: string[] = [];
    let sourceSnapshot: SourceSnapshot | undefined;
    if (layer instanceof Layer && !(layer instanceof LayerGroup)) {
      const source = safeRead(() => layer.getSource(), null, this.onError, `layer:${id}:source`);
      if (source) {
        const sourceId = this.ids.getSourceId(source);
        activeObjects.push([sourceId, source]);
        sourceSnapshot = this.buildSource(source, sourceId, sourceState(source, sourceId));
        sourceEvents[sourceId] = sourceSnapshot;
      }
    }

    const snapshot: LayerSnapshot = {
      id,
      ...(parentId ? { parentId } : {}),
      index,
      title,
      kind,
      className,
      visible,
      effectivelyVisible: parentVisible && visible,
      opacity,
      effectiveOpacity: parentOpacity * opacity,
      ...(zIndex !== undefined ? { zIndex } : {}),
      ...(minZoom !== undefined ? { minZoom } : {}),
      ...(maxZoom !== undefined ? { maxZoom } : {}),
      ...(minResolution !== undefined ? { minResolution } : {}),
      ...(maxResolution !== undefined ? { maxResolution } : {}),
      ...(extent ? { extent } : {}),
      ...(sourceSnapshot ? { source: sourceSnapshot } : {}),
      childIds,
    };
    output.push(snapshot);

    children.forEach((child, childIndex) => {
      const childSnapshot = this.buildLayer(child, id, childIndex, snapshot.effectivelyVisible, snapshot.effectiveOpacity, output, activeObjects, sourceEvents, sourceState);
      childIds.push(childSnapshot.id);
    });
    return snapshot;
  }

  private buildSource(source: Source, id: string, observed: Partial<SourceSnapshot> | undefined): SourceSnapshot {
    const getState = 'getState' in source && typeof source.getState === 'function'
      ? safeRead(() => source.getState(), undefined, this.onError, `source:${id}:state`)
      : undefined;
    const normalizedState = normalizeSourceState(getState);
    const url = readUrl(source);
    return {
      id,
      type: source.constructor.name || 'Source',
      state: observed?.state ?? normalizedState,
      ...(url ? { url } : {}),
      ...(observed?.lastError ? { lastError: { ...observed.lastError } } : {}),
      ...(observed?.lastSuccessAt !== undefined ? { lastSuccessAt: observed.lastSuccessAt } : {}),
      activeLoadCount: Math.max(0, observed?.activeLoadCount ?? 0),
      ...(observed?.loadEventsMonitored !== undefined ? { loadEventsMonitored: observed.loadEventsMonitored } : { loadEventsMonitored: false }),
    };
  }
}

function safeRead<T>(read: () => T, fallback: T, onError: (error: unknown, context: string) => void, context: string): T {
  try { return read(); } catch (error) { onError(error, context); return fallback; }
}

function normalizeSourceState(value: unknown): SourceState {
  if (value === 'undefined' || value === 'loading' || value === 'ready' || value === 'error') return value;
  return value === undefined ? 'unknown' : 'unknown';
}

function readUrl(source: Source): string | undefined {
  const candidate = source as Source & { getUrl?: () => unknown; getUrls?: () => unknown };
  try {
    const url = candidate.getUrl?.();
    if (typeof url === 'string') return url;
    const urls = candidate.getUrls?.();
    if (Array.isArray(urls) && typeof urls[0] === 'string') return urls[0];
  } catch { return undefined; }
  return undefined;
}
