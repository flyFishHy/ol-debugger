import type { DebugSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssue } from '../issue/issue-types.js';

export interface DebugReport {
  schemaVersion: '1.0';
  generatedAt: number;
  debuggerVersion: string;
  openLayersVersion?: string;
  snapshot?: DebugSnapshot;
  issues: DiagnosticIssue[];
  metadata?: Record<string, string | number | boolean | null>;
}
