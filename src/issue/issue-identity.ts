import type { DiagnosticIssueCandidate } from './issue-types.js';

export function createIssueId(candidate: Pick<DiagnosticIssueCandidate, 'ruleId' | 'objectId' | 'fingerprint'>): string {
  return `${candidate.ruleId}:${candidate.objectId ?? 'map'}:${candidate.fingerprint}`;
}
