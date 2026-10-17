import OLMap from 'ol/Map.js';
import type Source from 'ol/source/Source.js';
import { unByKey } from 'ol/Observable.js';
import type { EventsKey } from 'ol/events.js';
import { ObjectIdStore } from '../snapshot/object-id-store.js';
import type { SourceSnapshot } from '../snapshot/snapshot-types.js';
import { LayerTreeObserver } from './layer-tree-observer.js';

export class MapObserver {
  private map: OLMap | undefined;
  private readonly keys: EventsKey[] = [];
  private readonly layerTree: LayerTreeObserver;

  constructor(ids: ObjectIdStore, private readonly changed: () => void, onError: (error: unknown, context: string) => void) {
    this.layerTree = new LayerTreeObserver(ids, changed, onError);
  }

  start(map: OLMap): void {
    this.stop();
    this.map = map;
    this.layerTree.start(map.getLayerGroup());
    this.keys.push(map.on('change:view', this.changed));
    this.keys.push(map.on('change:layergroup', () => { this.layerTree.setRoot(map.getLayerGroup()); this.changed(); }));
    this.keys.push(map.on('change:size', this.changed));
    this.keys.push(map.on('moveend', this.changed));
  }

  stop(): void {
    unByKey(this.keys.splice(0));
    this.layerTree.stop();
    this.map = undefined;
  }

  syncTree(): void { this.layerTree.sync(); }
  getSourceState(source: Source, id: string): Partial<SourceSnapshot> | undefined { return this.layerTree.getSourceState(source, id); }
  dispose(): void { this.stop(); }
}
