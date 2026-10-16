import type OLMap from 'ol/Map.js';
import type BaseLayer from 'ol/layer/Base.js';
import type Source from 'ol/source/Source.js';

export class ObjectIdStore {
  private readonly ids = new WeakMap<object, string>();
  private readonly active = new globalThis.Map<string, object>();
  private readonly counters = new globalThis.Map<string, number>();

  getMapId(map: OLMap): string { return this.getId(map, 'map'); }
  getLayerId(layer: BaseLayer): string { return this.getId(layer, 'layer'); }
  getSourceId(source: Source): string { return this.getId(source, 'source'); }

  getId(object: object, prefix: 'map' | 'layer' | 'source'): string {
    const existing = this.ids.get(object);
    if (existing) return existing;
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    const id = `${prefix}-${next}`;
    this.ids.set(object, id);
    this.active.set(id, object);
    return id;
  }

  getActiveObject(id: string): object | undefined { return this.active.get(id); }

  syncActiveObjects(objects: Iterable<readonly [string, object]>): void {
    const next = new globalThis.Map(objects);
    this.active.clear();
    for (const [id, object] of next) this.active.set(id, object);
  }

  clearActiveObjects(): void { this.active.clear(); }
}
