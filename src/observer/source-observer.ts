import ImageSource from 'ol/source/Image.js';
import TileSource from 'ol/source/Tile.js';
import VectorSource from 'ol/source/Vector.js';
import type Source from 'ol/source/Source.js';
import { unByKey } from 'ol/Observable.js';
import type { EventsKey } from 'ol/events.js';
import type { SourceSnapshot } from '../snapshot/snapshot-types.js';

interface SourceRecord {
  source: Source;
  keys: EventsKey[];
  snapshot: Partial<SourceSnapshot>;
  monitored: boolean;
}

export class SourceObserver {
  private readonly records = new Map<string, SourceRecord>();
  private readonly references = new Map<string, Set<object>>();

  constructor(private readonly onChange: () => void, private readonly onError: (error: unknown, context: string) => void) {}

  sync(active: Array<{ id: string; source: Source; owner: object }>): void {
    const nextReferences = new Map<string, Set<object>>();
    const uniqueSources = new Map<string, Source>();
    for (const item of active) {
      uniqueSources.set(item.id, item.source);
      const owners = nextReferences.get(item.id) ?? new Set<object>();
      owners.add(item.owner);
      nextReferences.set(item.id, owners);
    }
    for (const [id, record] of this.records) {
      if (!uniqueSources.has(id) || uniqueSources.get(id) !== record.source) this.remove(id);
    }
    for (const [id, source] of uniqueSources) if (!this.records.has(id)) this.add(id, source);
    this.references.clear();
    for (const [id, owners] of nextReferences) this.references.set(id, owners);
  }

  get(id: string): Partial<SourceSnapshot> | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    let state: SourceSnapshot['state'] = 'unknown';
    try {
      const value = 'getState' in record.source && typeof record.source.getState === 'function' ? record.source.getState() : undefined;
      if (value === 'loading' || value === 'ready' || value === 'error' || value === 'undefined') state = value;
    } catch (error) { this.onError(error, `source:${id}:state`); }
    if (record.snapshot.lastError) state = 'error';
    return { ...record.snapshot, state, loadEventsMonitored: record.monitored };
  }

  dispose(): void { for (const id of [...this.records.keys()]) this.remove(id); this.references.clear(); }

  private add(id: string, source: Source): void {
    const record: SourceRecord = { source, keys: [], snapshot: { activeLoadCount: 0 }, monitored: false };
    const types = source instanceof TileSource
      ? { start: 'tileloadstart', end: 'tileloadend', error: 'tileloaderror' }
      : source instanceof ImageSource
        ? { start: 'imageloadstart', end: 'imageloadend', error: 'imageloaderror' }
        : source instanceof VectorSource
          ? { start: 'featuresloadstart', end: 'featuresloadend', error: 'featuresloaderror' }
          : undefined;
    record.monitored = types !== undefined;
    try {
      record.keys.push(source.on('change', () => this.onChange()));
      if (types) {
        // These event names are public on the matching OpenLayers source subclasses;
        // Source.on()'s base declaration does not include subclass-specific events.
        record.keys.push(listenPublicSourceEvent(source, types.start, () => {
          record.snapshot.activeLoadCount = Math.max(0, (record.snapshot.activeLoadCount ?? 0) + 1);
          this.onChange();
        }));
        const complete = (): void => {
          record.snapshot.activeLoadCount = Math.max(0, (record.snapshot.activeLoadCount ?? 0) - 1);
          record.snapshot.lastError = undefined;
          record.snapshot.lastSuccessAt = Date.now();
          this.onChange();
        };
        record.keys.push(listenPublicSourceEvent(source, types.end, complete));
        record.keys.push(listenPublicSourceEvent(source, types.error, (event: unknown) => {
          record.snapshot.activeLoadCount = Math.max(0, (record.snapshot.activeLoadCount ?? 0) - 1);
          record.snapshot.lastError = { eventName: types.error, ...(eventMessage(event) ? { message: eventMessage(event) } : {}), occurredAt: Date.now() };
          record.snapshot.state = 'error';
          this.onChange();
        }));
      }
    } catch (error) { this.onError(error, `source:${id}:observe`); }
    this.records.set(id, record);
  }

  private remove(id: string): void {
    const record = this.records.get(id);
    if (!record) return;
    unByKey(record.keys);
    this.records.delete(id);
    this.references.delete(id);
  }
}

function eventMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const error = Reflect.get(value, 'error');
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : undefined;
}

function listenPublicSourceEvent(source: Source, type: string, listener: (event: unknown) => void): EventsKey {
  const observable = source as unknown as { on(eventType: string, callback: (event: unknown) => void): EventsKey };
  return observable.on(type, listener);
}
