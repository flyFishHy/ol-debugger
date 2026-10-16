import type { DiagnosticRule } from '../diagnostic/diagnostic-rule.js';
import type { DebuggerError } from './debugger-error.js';

export interface RuntimeOptions {
  autoDiagnose: boolean;
  enableDiagnostics: boolean;
  rules: DiagnosticRule[];
  onError?: (error: DebuggerError) => void;
}
