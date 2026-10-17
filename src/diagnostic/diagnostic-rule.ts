import type { DiagnosticContext } from './diagnostic-context.js';
export type { DiagnosticContext } from './diagnostic-context.js';
import type { DebugSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssueCandidate } from '../issue/issue-types.js';

export interface DiagnosticRule {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly defaultSeverity: 'error' | 'warning' | 'info';
  run(snapshot: DebugSnapshot, context: DiagnosticContext): DiagnosticIssueCandidate[];
}
