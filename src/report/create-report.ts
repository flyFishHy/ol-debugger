import type { DebugSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssue } from '../issue/issue-types.js';
import type { DebugReport } from './report-types.js';
import { DEBUGGER_VERSION } from '../version.js';

export function createReport(snapshot: DebugSnapshot | undefined, issues: DiagnosticIssue[], includeFullUrls: boolean): DebugReport {
  const safeSnapshot = snapshot ? sanitizeSnapshot(snapshot, includeFullUrls) : undefined;
  const report: DebugReport = {
    schemaVersion: '1.0',
    generatedAt: Date.now(),
    debuggerVersion: DEBUGGER_VERSION,
    ...(safeSnapshot ? { snapshot: safeSnapshot } : {}),
    issues: issues.map((issue) => ({ ...issue, evidence: { ...issue.evidence }, suggestions: [...issue.suggestions] })),
  };
  return JSON.parse(JSON.stringify(report)) as DebugReport;
}

function sanitizeSnapshot(snapshot: DebugSnapshot, includeFullUrls: boolean): DebugSnapshot {
  const sourceEvents = Object.fromEntries(Object.entries(snapshot.sourceEvents).map(([id, source]) => [id, sanitizeSource(source, includeFullUrls)]));
  return {
    revision: snapshot.revision,
    capturedAt: snapshot.capturedAt,
    map: { ...snapshot.map, center: snapshot.map.center ? [...snapshot.map.center] : undefined, size: snapshot.map.size ? [...snapshot.map.size] as [number, number] : undefined, viewExtent: snapshot.map.viewExtent ? [...snapshot.map.viewExtent] as [number, number, number, number] : undefined },
    layers: snapshot.layers.map((layer) => ({ ...layer, childIds: [...layer.childIds], extent: layer.extent ? [...layer.extent] as [number, number, number, number] : undefined, source: layer.source ? sanitizeSource(layer.source, includeFullUrls) : undefined })),
    sourceEvents,
  };
}

function sanitizeSource(source: DebugSnapshot['sourceEvents'][string], includeFullUrls: boolean): DebugSnapshot['sourceEvents'][string] {
  const url = source.url ? sanitizeUrl(source.url, includeFullUrls) : undefined;
  return { ...source, ...(url ? { url } : { url: undefined }), lastError: source.lastError ? { ...source.lastError } : undefined };
}

function sanitizeUrl(value: string, includeFullUrls: boolean): string | undefined {
  if (includeFullUrls) return value;
  try {
    const url = new URL(value, globalThis.location?.href ?? 'http://localhost');
    return `${url.origin}${url.pathname}`;
  } catch { return undefined; }
}
