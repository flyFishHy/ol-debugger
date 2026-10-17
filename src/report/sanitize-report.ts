import type { DebugSnapshot } from '../snapshot/snapshot-types.js';
import type { DebugReport } from './report-types.js';

export function sanitizeReport(report: DebugReport, includeFullUrls: boolean, onOmitted?: (error: Error) => void): DebugReport {
  const snapshot = report.snapshot ? sanitizeSnapshot(report.snapshot, includeFullUrls) : undefined;
  const normalized = {
    ...report,
    ...(snapshot ? { snapshot } : {}),
    issues: report.issues.map((issue) => ({ ...issue, evidence: { ...issue.evidence }, suggestions: [...issue.suggestions] })),
  };
  const safe = sanitizeJson(normalized, includeFullUrls);
  if (safe.omitted) onOmitted?.(new Error('The report contained non-JSON values that were omitted.'));
  return safe.value as DebugReport;
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
  return { ...source, ...(url ? { url } : { url: undefined }), lastError: source.lastError ? { ...source.lastError, ...(source.lastError.message ? { message: sanitizeText(source.lastError.message, includeFullUrls) } : {}) } : undefined };
}

function sanitizeText(value: string, includeFullUrls: boolean): string {
  if (includeFullUrls) return value;
  return value.replace(/https?:\/\/[^\s"'<>]+/gi, (candidate) => sanitizeUrl(candidate.replace(/[),.;]+$/, ''), false) ?? '[URL omitted]');
}

function sanitizeJson(value: unknown, includeFullUrls: boolean): { value: unknown; omitted: boolean } {
  const visited = new WeakSet<object>();
  let omitted = false;
  const normalize = (current: unknown): unknown => {
    if (typeof current === 'string') return sanitizeText(current, includeFullUrls);
    if (current === undefined) return undefined;
    if (current === null || typeof current === 'number' || typeof current === 'boolean') return current;
    if (typeof current !== 'object') { omitted = true; return undefined; }
    if (visited.has(current)) { omitted = true; return undefined; }
    visited.add(current);
    if (current instanceof Error) return { name: current.name, message: sanitizeText(current.message, includeFullUrls) };
    if (Array.isArray(current)) return current.map(normalize).filter((item) => item !== undefined);
    try {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) { omitted = true; return undefined; }
      const output: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(current)) {
        const clean = normalize(item);
        if (clean !== undefined) output[key] = clean;
      }
      return output;
    } catch { omitted = true; return undefined; }
  };
  try { return { value: normalize(value), omitted }; }
  catch { return { value: undefined, omitted: true }; }
}

function sanitizeUrl(value: string, includeFullUrls: boolean): string | undefined {
  if (includeFullUrls) return value;
  try {
    const url = new URL(value, globalThis.location?.href ?? 'http://localhost');
    return `${url.origin}${url.pathname}`;
  } catch { return undefined; }
}
