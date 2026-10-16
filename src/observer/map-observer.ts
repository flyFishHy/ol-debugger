import OLMap from 'ol/Map.js';
import LayerGroup from 'ol/layer/Group.js';
import BaseLayer from 'ol/layer/Base.js';
import Layer from 'ol/layer/Layer.js';
import type Source from 'ol/source/Source.js';
import { unByKey } from 'ol/Observable.js';
import type { EventsKey } from 'ol/events.js';
import type Collection from 'ol/Collection.js';
import { ObjectIdStore } from '../snapshot/object-id-store.js';
import { SourceObserver } from './source-observer.js';
import type { SourceState } from '../snapshot/snapshot-types.js';

interface Watched { keys: EventsKey[]; dispose?: () => void }

export class MapObserver {
  private map: OLMap | undefined;
  private readonly mapKeys: EventsKey[] = [];
  private readonly watchedCollections = new Map<object, Watched>();
  private readonly watchedLayers = new Map<BaseLayer, Watched>();
  private viewKeys: EventsKey[] = [];
  private sourceObserver: SourceObserver;

  constructor(
    private readonly ids: ObjectIdStore,
    private readonly changed: () => void,
    private readonly onError: (error: unknown, context: string) => void,
  ) {
    this.sourceObserver = new SourceObserver(changed, onError);
  }

  start(map: OLMap): void {
    this.stop();
    this.map = map;
    this.mapKeys.push(map.on('change:view', () => { this.bindView(); this.changed(); }));
    this.mapKeys.push(map.on('change:layergroup', () => { this.reconcileTree(); this.changed(); }));
    this.mapKeys.push(map.on('change:size', this.changed));
    this.mapKeys.push(map.on('moveend', this.changed));
    this.bindView();
    this.reconcileTree();
  }

  stop(): void {
    unByKey(this.mapKeys.splice(0));
    unByKey(this.viewKeys);
    this.viewKeys = [];
    for (const watched of this.watchedCollections.values()) unByKey(watched.keys);
    for (const watched of this.watchedLayers.values()) unByKey(watched.keys);
    this.watchedCollections.clear();
    this.watchedLayers.clear();
    this.sourceObserver.dispose();
    this.map = undefined;
  }

  getSourceState(source: Source, id: string) {
    const observed = this.sourceObserver.get(id);
    return observed ?? { state: sourceState(source), activeLoadCount: 0, loadEventsMonitored: false };
  }

  dispose(): void { this.stop(); }

  private bindView(): void {
    unByKey(this.viewKeys);
    this.viewKeys = [];
    const view = this.map?.getView();
    if (!view) return;
    for (const key of ['change:center', 'change:resolution', 'change:rotation'] as const) this.viewKeys.push(view.on(key, this.changed));
  }

  private reconcileTree(): void {
    const map = this.map;
    if (!map) return;
    const collections = new Set<object>();
    const layers = new Set<BaseLayer>();
    const sources = new Map<string, { id: string; source: Source; owner: object }>();
    const visit = (layer: BaseLayer): void => {
      layers.add(layer);
      if (layer instanceof Layer && !(layer instanceof LayerGroup)) {
        try {
          const source = layer.getSource();
          if (source) {
            const id = this.ids.getSourceId(source);
            sources.set(id, { id, source, owner: layer });
          }
        } catch (error) { this.onError(error, 'layer:source'); }
      }
      if (layer instanceof LayerGroup) {
        const collection = layer.getLayers();
        collections.add(collection);
        for (const child of collection.getArray().slice()) visit(child);
      }
    };
    visit(map.getLayerGroup());

    for (const [collection, watched] of this.watchedCollections) if (!collections.has(collection)) {
      unByKey(watched.keys);
      this.watchedCollections.delete(collection);
    }
    for (const collection of collections) if (!this.watchedCollections.has(collection)) {
      const typed = collection as Collection<BaseLayer>;
      const refreshTree = (): void => { this.reconcileTree(); this.changed(); };
      const keys = [typed.on('add', refreshTree), typed.on('remove', refreshTree)];
      this.watchedCollections.set(collection, { keys });
    }
    for (const [layer, watched] of this.watchedLayers) if (!layers.has(layer)) {
      unByKey(watched.keys);
      this.watchedLayers.delete(layer);
    }
    for (const layer of layers) if (!this.watchedLayers.has(layer)) {
      const keys: EventsKey[] = [];
      for (const key of ['change:visible', 'change:opacity', 'change:zIndex', 'change:extent', 'change:minZoom', 'change:maxZoom', 'change:minResolution', 'change:maxResolution'] as const) {
        keys.push(layer.on(key, this.changed));
      }
      keys.push(layer.on('change', () => { this.reconcileTree(); this.changed(); }));
      this.watchedLayers.set(layer, { keys });
    }
    this.sourceObserver.sync([...sources.values()]);
  }
}

function sourceState(source: Source): SourceState {
  try {
    if ('getState' in source && typeof source.getState === 'function') {
      const state = source.getState();
      if (state === 'undefined' || state === 'loading' || state === 'ready' || state === 'error') return state;
    }
  } catch { /* A failed optional state read is unknown, not an error conclusion. */ }
  return 'unknown';
}
