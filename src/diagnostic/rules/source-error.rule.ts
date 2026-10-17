import type { DiagnosticRule } from '../diagnostic-rule.js';
import { advice, candidate } from './helpers.js';

export const sourceErrorRule: DiagnosticRule = {
  id: 'source.load-error', title: 'Source load error', description: 'Reports explicit source errors observed through supported public events.', defaultSeverity: 'error',
  run: (snapshot) => Object.values(snapshot.sourceEvents).filter((source) => source.state === 'error' || source.lastError !== undefined)
    .map((source) => candidate('source.load-error', source.lastError?.eventName ?? 'source-error', 'error', 'Source reported a load error', 'A source reported a load error. The event does not identify its root cause.', { sourceId: source.id, sourceType: source.type, state: source.state, eventName: source.lastError?.eventName ?? null, occurredAt: source.lastError?.occurredAt ?? null }, source.id, source.type, advice.source)),
};
