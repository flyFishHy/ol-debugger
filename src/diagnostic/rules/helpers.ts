import type { DiagnosticIssueCandidate } from '../../issue/issue-types.js';
import type { DebugSnapshot, LayerSnapshot } from '../../snapshot/snapshot-types.js';

export const advice = {
  visibility: ['Check the layer visibility setting and any parent layer groups.'],
  opacity: ['Check opacity settings on this layer and its parent groups.'],
  view: ['Check that the View has a finite center and a positive finite resolution.'],
  zoom: ['Compare the current zoom with the layer minZoom and maxZoom settings.'],
  resolution: ['Compare the current resolution with the layer resolution limits.'],
  extent: ['Confirm the layer extent and map view use the same projection and coordinate space.'],
  source: ['Check the request URL, browser network panel, server response, authentication, and CORS configuration.'],
};

export function candidate(ruleId: string, fingerprint: string, severity: DiagnosticIssueCandidate['severity'], title: string, message: string, evidence: DiagnosticIssueCandidate['evidence'], objectId?: string, objectLabel?: string, suggestions: string[] = []): DiagnosticIssueCandidate {
  return { ruleId, fingerprint, severity, title, message, evidence, suggestions: [...suggestions], ...(objectId ? { objectId } : {}), ...(objectLabel ? { objectLabel } : {}) };
}

export function descendantCount(snapshot: DebugSnapshot, layer: LayerSnapshot): number {
  const byId = new Map(snapshot.layers.map((item) => [item.id, item]));
  let count = 0;
  const visit = (id: string): void => { const child = byId.get(id); if (child) { count += 1; child.childIds.forEach(visit); } };
  layer.childIds.forEach(visit);
  return count;
}
