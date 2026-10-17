import type { DebugSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssue, IssueQueryOptions } from '../issue/issue-types.js';

export type DebuggerTheme = 'light' | 'dark' | 'auto';
export type DebuggerLayout = 'overlay' | 'embedded';
export type DebuggerTab = 'overview' | 'layers' | 'issues';

export interface DebuggerViewModel {
  isConnected(): boolean;
  getSnapshot(): DebugSnapshot | undefined;
  getLastDiagnosedAt(): number | undefined;
  getIssues(options?: IssueQueryOptions): DiagnosticIssue[];
  diagnose(): DiagnosticIssue[];
  subscribeSnapshot(listener: (snapshot: DebugSnapshot) => void): () => void;
  subscribeIssues(listener: (issues: DiagnosticIssue[]) => void): () => void;
}
