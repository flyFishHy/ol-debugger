export type Extent = [number, number, number, number];
export type LayerKind = 'group' | 'layer' | 'unknown';
export type SourceState = 'undefined' | 'loading' | 'ready' | 'error' | 'unknown';

export interface MapSnapshot {
  projectionCode?: string;
  center?: Array<number | null>;
  zoom?: number | null;
  resolution?: number | null;
  rotation?: number;
  size?: [number, number];
  viewExtent?: Extent;
  capturedAt: number;
}

export interface SourceErrorSnapshot {
  eventName: string;
  message?: string;
  occurredAt: number;
}

export interface SourceSnapshot {
  id: string;
  type: string;
  state: SourceState;
  url?: string;
  lastError?: SourceErrorSnapshot;
  lastSuccessAt?: number;
  activeLoadCount: number;
  loadEventsMonitored?: boolean;
}

export interface LayerSnapshot {
  id: string;
  parentId?: string;
  index: number;
  title: string;
  kind: LayerKind;
  className: string;
  visible: boolean;
  effectivelyVisible: boolean;
  opacity: number;
  effectiveOpacity: number;
  zIndex?: number;
  minZoom?: number;
  maxZoom?: number;
  minResolution?: number;
  maxResolution?: number;
  extent?: Extent;
  source?: SourceSnapshot;
  childIds: string[];
}

export interface DebugSnapshot {
  revision: number;
  capturedAt: number;
  map: MapSnapshot;
  layers: LayerSnapshot[];
  sourceEvents: Record<string, SourceSnapshot>;
}
