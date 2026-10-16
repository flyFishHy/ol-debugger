export type DebuggerErrorCode =
  | 'MAP_NOT_CONNECTED'
  | 'INSTANCE_DESTROYED'
  | 'INVALID_OPTIONS'
  | 'SNAPSHOT_FAILED'
  | 'RULE_EXECUTION_FAILED'
  | 'UI_INITIALIZATION_FAILED'
  | 'REPORT_EXPORT_FAILED';

export class DebuggerError extends Error {
  readonly code: DebuggerErrorCode;
  readonly context?: Record<string, string | number | boolean | null>;

  constructor(code: DebuggerErrorCode, message: string, context?: Record<string, string | number | boolean | null>) {
    super(message);
    this.name = 'DebuggerError';
    this.code = code;
    this.context = context;
  }
}
