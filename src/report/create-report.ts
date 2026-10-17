import type { DebugSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssue } from '../issue/issue-types.js';
import type { DebugReport } from './report-types.js';
import { DEBUGGER_VERSION } from '../version.js';
import { sanitizeReport } from './sanitize-report.js';

export function createReport(snapshot: DebugSnapshot | undefined, issues: DiagnosticIssue[], includeFullUrls: boolean, onOmitted?: (error: Error) => void): DebugReport {
  const report: DebugReport = {
    schemaVersion: '1.0',
    generatedAt: Date.now(),
    debuggerVersion: DEBUGGER_VERSION,
    ...(snapshot ? { snapshot } : {}),
    issues: issues.map((issue) => ({ ...issue, evidence: { ...issue.evidence }, suggestions: [...issue.suggestions] })),
  };
  return sanitizeReport(report, includeFullUrls, onOmitted);
}
