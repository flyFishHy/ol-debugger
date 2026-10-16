export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueStatus = 'active' | 'resolved';

export interface DiagnosticIssueCandidate {
  ruleId: string;
  fingerprint: string;
  severity: IssueSeverity;
  title: string;
  message: string;
  objectId?: string;
  objectLabel?: string;
  evidence: Record<string, string | number | boolean | null | undefined>;
  suggestions: string[];
}

export interface DiagnosticIssue extends DiagnosticIssueCandidate {
  id: string;
  status: IssueStatus;
  firstSeenAt: number;
  lastSeenAt: number;
  resolvedAt?: number;
}

export interface IssueQueryOptions {
  status?: IssueStatus | 'all';
  severity?: IssueSeverity | IssueSeverity[];
  objectId?: string;
}
