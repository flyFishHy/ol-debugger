import type { DiagnosticIssue, DiagnosticIssueCandidate, IssueQueryOptions } from './issue-types.js';

export class IssueStore {
  private readonly issues = new Map<string, DiagnosticIssue>();
  private readonly listeners = new Set<(issues: DiagnosticIssue[]) => void>();
  private destroyed = false;

  constructor(private readonly now: () => number = Date.now) {}

  reconcile(candidates: DiagnosticIssueCandidate[], successfulRuleIds: Set<string>): void {
    if (this.destroyed) return;
    const seen = new Set<string>();
    const now = this.now();
    for (const candidate of candidates) {
      const id = issueId(candidate);
      seen.add(id);
      const previous = this.issues.get(id);
      this.issues.set(id, {
        ...cloneCandidate(candidate),
        id,
        status: 'active',
        firstSeenAt: previous?.firstSeenAt ?? now,
        lastSeenAt: now,
      });
    }
    let changed = candidates.length > 0;
    for (const [id, issue] of this.issues) {
      if (issue.status === 'active' && successfulRuleIds.has(issue.ruleId) && !seen.has(id)) {
        this.issues.set(id, { ...issue, status: 'resolved', lastSeenAt: now, resolvedAt: now });
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  resolveAllActive(): void {
    if (this.destroyed) return;
    const now = this.now();
    let changed = false;
    for (const [id, issue] of this.issues) {
      if (issue.status === 'active') {
        this.issues.set(id, { ...issue, status: 'resolved', lastSeenAt: now, resolvedAt: now });
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  list(options: IssueQueryOptions = {}): DiagnosticIssue[] {
    const severities = options.severity === undefined
      ? undefined
      : new Set(Array.isArray(options.severity) ? options.severity : [options.severity]);
    return [...this.issues.values()]
      .filter((issue) => !options.status || options.status === 'all' || issue.status === options.status)
      .filter((issue) => !severities || severities.has(issue.severity))
      .filter((issue) => !options.objectId || issue.objectId === options.objectId)
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.lastSeenAt - a.lastSeenAt)
      .map(cloneIssue);
  }

  get(id: string): DiagnosticIssue | undefined {
    const issue = this.issues.get(id);
    return issue ? cloneIssue(issue) : undefined;
  }

  subscribe(listener: (issues: DiagnosticIssue[]) => void): () => void {
    if (this.destroyed) return () => undefined;
    this.listeners.add(listener);
    try { listener(this.list()); } catch { /* A consumer callback must not interrupt the issue store. */ }
    return () => this.listeners.delete(listener);
  }

  clearResolved(): void {
    for (const [id, issue] of this.issues) if (issue.status === 'resolved') this.issues.delete(id);
    this.emit();
  }

  clear(): void { this.issues.clear(); this.emit(); }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.issues.clear();
    this.listeners.clear();
  }

  private emit(): void {
    const issues = this.list();
    for (const listener of [...this.listeners]) {
      try { listener(issues.map(cloneIssue)); } catch { /* Notify remaining consumers even if one callback fails. */ }
    }
  }
}

export function issueId(candidate: Pick<DiagnosticIssueCandidate, 'ruleId' | 'objectId' | 'fingerprint'>): string {
  return `${candidate.ruleId}:${candidate.objectId ?? 'map'}:${candidate.fingerprint}`;
}

function cloneCandidate(candidate: DiagnosticIssueCandidate): DiagnosticIssueCandidate {
  return { ...candidate, evidence: { ...candidate.evidence }, suggestions: [...candidate.suggestions] };
}
function cloneIssue(issue: DiagnosticIssue): DiagnosticIssue {
  return { ...issue, evidence: { ...issue.evidence }, suggestions: [...issue.suggestions] };
}
function severityRank(value: DiagnosticIssue['severity']): number {
  return value === 'error' ? 0 : value === 'warning' ? 1 : 2;
}
