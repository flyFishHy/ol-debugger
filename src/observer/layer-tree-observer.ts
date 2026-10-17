import BaseLayer from 'ol/layer/Base.js';
import Layer from 'ol/layer/Layer.js';
import LayerGroup from 'ol/layer/Group.js';
import type Collection from 'ol/Collection.js';
import { unByKey } from 'ol/Observable.js';
import type { EventsKey } from 'ol/events.js';
import type Source from 'ol/source/Source.js';
import { ObjectIdStore } from '../snapshot/object-id-store.js';
import type { SourceSnapshot, SourceState } from '../snapshot/snapshot-types.js';
import { SourceObserver } from './source-observer.js';

interface WatchedLayer { keys: EventsKey[] }
interface WatchedCollection { keys: EventsKey[] }

export class LayerTreeObserver {
  private root: BaseLayer | undefined;
  private treeDirty = false;
  private readonly collections = new Map<object, WatchedCollection>();
  private readonly layers = new Map<BaseLayer, WatchedLayer>();
  private readonly layerSources = new Map<BaseLayer, Source | null>();
  private readonly sources: SourceObserver;

  constructor(private readonly ids: ObjectIdStore, private readonly changed: () => void, private readonly onError: (error: unknown, context: string) => void) {
    this.sources = new SourceObserver(changed, onError);
  }

  start(root: BaseLayer): void { this.stop(); this.root = root; this.treeDirty = true; }
  setRoot(root: BaseLayer): void { this.root = root; this.treeDirty = true; }
  markDirty(): void { this.treeDirty = true; }
  sync(): void { if (this.treeDirty && this.root) { this.treeDirty = false; this.reconcileTree(); } }
  stop(): void {
    for (const watched of this.collections.values()) unByKey(watched.keys);
    for (const watched of this.layers.values()) unByKey(watched.keys);
    this.collections.clear(); this.layers.clear(); this.layerSources.clear(); this.sources.dispose();
    this.root = undefined; this.treeDirty = false;
  }
  dispose(): void { this.stop(); }
  getSourceState(source: Source, id: string): Partial<SourceSnapshot> | undefined {
    return this.sources.get(id) ?? { state: sourceState(source), activeLoadCount: 0, loadEventsMonitored: false };
  }

  private reconcileTree(): void {
    if (!this.root) return;
    const collections = new Set<object>();
    const activeLayers = new Set<BaseLayer>();
    const sourceEntries = new Map<string, { id: string; source: Source; owner: object }>();
    const visit = (layer: BaseLayer): void => {
      activeLayers.add(layer);
      if (layer instanceof Layer && !(layer instanceof LayerGroup)) {
        try {
          const source = layer.getSource();
          if (source) { const id = this.ids.getSourceId(source); sourceEntries.set(id, { id, source, owner: layer }); }
        } catch (error) { this.onError(error, 'layer:source'); }
      }
      if (layer instanceof LayerGroup) {
        const collection = layer.getLayers();
        collections.add(collection);
        for (const child of collection.getArray().slice()) visit(child);
      }
    };
    visit(this.root);

    for (const [collection, watched] of this.collections) if (!collections.has(collection)) { unByKey(watched.keys); this.collections.delete(collection); }
    for (const collection of collections) if (!this.collections.has(collection)) {
      const typed = collection as Collection<BaseLayer>;
      const dirty = (): void => { this.treeDirty = true; this.changed(); };
      this.collections.set(collection, { keys: [typed.on('add', dirty), typed.on('remove', dirty)] });
    }
    for (const [layer, watched] of this.layers) if (!activeLayers.has(layer)) {
      unByKey(watched.keys); this.layers.delete(layer); this.layerSources.delete(layer);
    }
    for (const layer of activeLayers) if (!this.layers.has(layer)) {
      const keys: EventsKey[] = [];
      for (const key of ['change:visible', 'change:opacity', 'change:zIndex', 'change:extent', 'change:minZoom', 'change:maxZoom', 'change:minResolution', 'change:maxResolution'] as const) keys.push(layer.on(key, this.changed));
      let source: Source | null = null;
      try { source = layer instanceof Layer && !(layer instanceof LayerGroup) ? layer.getSource() : null; }
      catch (error) { this.onError(error, 'layer:source'); }
      this.layerSources.set(layer, source);
      keys.push(layer.on('change', () => {
        let current: Source | null = null;
        try { current = layer instanceof Layer && !(layer instanceof LayerGroup) ? layer.getSource() : null; }
        catch (error) { this.onError(error, 'layer:source'); }
        if (this.layerSources.get(layer) !== current) { this.layerSources.set(layer, current); this.treeDirty = true; }
        this.changed();
      }));
      this.layers.set(layer, { keys });
    }
    this.sources.sync([...sourceEntries.values()]);
  }
}

function sourceState(source: Source): SourceState {
  try {
    if ('getState' in source && typeof source.getState === 'function') {
      const state = source.getState();
      if (state === 'undefined' || state === 'loading' || state === 'ready' || state === 'error') return state;
    }
  } catch { /* An unreadable optional state is unknown, not an error conclusion. */ }
  return 'unknown';
}
