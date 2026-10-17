import type { DebugSnapshot } from '../snapshot/snapshot-types.js';

export interface DiagnosticContext {
  now(): number;
  getLayer(id: string): DebugSnapshot['layers'][number] | undefined;
}
