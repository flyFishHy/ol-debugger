import type { DebugSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssueCandidate } from '../issue/issue-types.js';
import type { DiagnosticContext, DiagnosticRule } from './diagnostic-rule.js';

export interface DiagnosticRunResult {
  candidates: DiagnosticIssueCandidate[];
  successfulRuleIds: Set<string>;
}

export class DiagnosticEngine {
  constructor(
    private readonly rules: DiagnosticRule[],
    private readonly onRuleError: (ruleId: string, error: unknown) => void = () => undefined,
  ) {}

  run(snapshot: DebugSnapshot): DiagnosticRunResult {
    const successfulRuleIds = new Set<string>();
    const candidates: DiagnosticIssueCandidate[] = [];
    const byId = new Map(snapshot.layers.map((layer) => [layer.id, layer]));
    const context: DiagnosticContext = { now: Date.now, getLayer: (id) => byId.get(id) };
    for (const rule of this.rules) {
      try {
        const issues = rule.run(snapshot, context);
        candidates.push(...issues);
        successfulRuleIds.add(rule.id);
      } catch (error) { this.onRuleError(rule.id, error); }
    }
    return { candidates, successfulRuleIds };
  }
}
