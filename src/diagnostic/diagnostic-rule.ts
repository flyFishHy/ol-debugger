import type { DebugSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssueCandidate } from '../issue/issue-types.js';

export interface DiagnosticContext {
  now(): number;
  getLayer(id: string): DebugSnapshot['layers'][number] | undefined;
}

export interface DiagnosticRule {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly defaultSeverity: 'error' | 'warning' | 'info';
  run(snapshot: DebugSnapshot, context: DiagnosticContext): DiagnosticIssueCandidate[];
}
