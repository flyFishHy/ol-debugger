import Map from 'ol/Map.js';
import { ObjectIdStore } from '../snapshot/object-id-store.js';
import { SnapshotBuilder } from '../snapshot/snapshot-builder.js';
import type { DebugSnapshot, SourceSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssue, IssueQueryOptions } from '../issue/issue-types.js';
import { IssueStore } from '../issue/issue-store.js';
import { DiagnosticEngine } from '../diagnostic/diagnostic-engine.js';
import type { DiagnosticRule } from '../diagnostic/diagnostic-rule.js';
import { createDefaultRules } from '../diagnostic/default-rules.js';
import { MapObserver } from '../observer/map-observer.js';
import { RefreshScheduler } from '../observer/refresh-scheduler.js';
import { DebuggerError } from './debugger-error.js';

export interface DebuggerRuntimeOptions {
  autoDiagnose?: boolean;
  enableDiagnostics?: boolean;
  rules?: DiagnosticRule[];
  disabledRuleIds?: string[];
  onError?: (error: DebuggerError) => void;
}

export class DebuggerRuntime {
  private readonly ids = new ObjectIdStore();
  private readonly builder: SnapshotBuilder;
  private readonly issueStore = new IssueStore();
  private readonly observer: MapObserver;
  private readonly scheduler: RefreshScheduler;
  private readonly engine: DiagnosticEngine;
  private readonly snapshotListeners = new Set<(snapshot: DebugSnapshot) => void>();
  private map: Map | undefined;
  private latestSnapshot: DebugSnapshot | undefined;
  private destroyed = false;
  private readonly autoDiagnose: boolean;
  private readonly enableDiagnostics: boolean;

  constructor(options: DebuggerRuntimeOptions = {}) {
    this.autoDiagnose = options.autoDiagnose ?? true;
    this.enableDiagnostics = options.enableDiagnostics ?? true;
    this.scheduler = new RefreshScheduler(() => this.refresh());
    this.observer = new MapObserver(this.ids, () => this.scheduler.schedule(), (error, context) => this.reportError('SNAPSHOT_FAILED', error, { context }));
    this.builder = new SnapshotBuilder(this.ids, (error, context) => this.reportError('SNAPSHOT_FAILED', error, { context }));
    const disabled = new Set(options.disabledRuleIds ?? []);
    const rules = [...createDefaultRules(), ...(options.rules ?? [])].filter((rule) => !disabled.has(rule.id));
    this.engine = new DiagnosticEngine(rules, (ruleId, error) => this.reportError('RULE_EXECUTION_FAILED', error, { ruleId }));
    this.onError = options.onError;
  }

  private readonly onError: DebuggerRuntimeOptions['onError'];

  isConnected(): boolean { return this.map !== undefined; }
  getSnapshot(): DebugSnapshot | undefined { return this.latestSnapshot ? cloneSnapshot(this.latestSnapshot) : undefined; }
  getIssues(options?: IssueQueryOptions): DiagnosticIssue[] { return this.issueStore.list(options); }

  connect(map: Map): void {
    this.assertAlive();
    if (this.map === map) return;
    this.disconnectInternal();
    this.map = map;
    this.observer.start(map);
    this.refresh();
  }

  disconnect(): void { this.assertAlive(); this.disconnectInternal(); }

  inspect(): DebugSnapshot | undefined { return this.getSnapshot(); }

  diagnose(): DiagnosticIssue[] {
    this.assertAlive();
    if (!this.map) throw new DebuggerError('MAP_NOT_CONNECTED', 'Cannot diagnose without a connected map.');
    this.refresh(true);
    return this.issueStore.list();
  }

  subscribeSnapshot(listener: (snapshot: DebugSnapshot) => void): () => void {
    if (this.latestSnapshot) listener(cloneSnapshot(this.latestSnapshot));
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  subscribeIssues(listener: (issues: DiagnosticIssue[]) => void): () => void { return this.issueStore.subscribe(listener); }

  destroy(): void {
    if (this.destroyed) return;
    this.disconnectInternal();
    this.scheduler.dispose();
    this.snapshotListeners.clear();
    this.issueStore.destroy();
    this.destroyed = true;
  }

  private refresh(forceDiagnose = false): void {
    const map = this.map;
    if (!map || this.destroyed) return;
    try {
      const snapshot = this.builder.build(map, (source, id): Partial<SourceSnapshot> => this.observer.getSourceState(source, id));
      this.latestSnapshot = snapshot;
      for (const listener of [...this.snapshotListeners]) {
        try { listener(cloneSnapshot(snapshot)); }
        catch (error) { this.reportError('SNAPSHOT_FAILED', error, { context: 'snapshot-subscriber' }); }
      }
      if (this.enableDiagnostics && (forceDiagnose || this.autoDiagnose)) {
        const result = this.engine.run(snapshot);
        this.issueStore.reconcile(result.candidates, result.successfulRuleIds);
      }
    } catch (error) { this.reportError('SNAPSHOT_FAILED', error); }
  }

  private disconnectInternal(): void {
    this.scheduler.cancel();
    this.observer.stop();
    this.map = undefined;
    this.latestSnapshot = undefined;
    this.builder.clearActiveObjects();
    this.issueStore.resolveAllActive();
    for (const listener of [...this.snapshotListeners]) {
      // Disconnection is represented by the absence of a snapshot; UI reads isConnected().
      void listener;
    }
  }

  private assertAlive(): void {
    if (this.destroyed) throw new DebuggerError('INSTANCE_DESTROYED', 'This debugger instance has been destroyed.');
  }

  private reportError(code: ConstructorParameters<typeof DebuggerError>[0], error: unknown, context: Record<string, string | number | boolean | null> = {}): void {
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new DebuggerError(code, message, context);
    try { this.onError?.(wrapped); } catch { /* User error handlers must not interrupt debugger state. */ }
  }
}

function cloneSnapshot(snapshot: DebugSnapshot): DebugSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as DebugSnapshot;
}
