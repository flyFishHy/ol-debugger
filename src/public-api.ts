import type Map from 'ol/Map.js';
import { DebuggerRuntime } from './runtime/debugger-runtime.js';
import { DebuggerError } from './runtime/debugger-error.js';
import type { DebugSnapshot } from './snapshot/snapshot-types.js';
import type { DiagnosticIssue, IssueQueryOptions } from './issue/issue-types.js';
import type { DebugReport } from './report/report-types.js';
import { createReport } from './report/create-report.js';
import type { DiagnosticRule } from './diagnostic/diagnostic-rule.js';
import { defineOLDebuggerElements } from './ui/define-elements.js';
import { DebuggerPanel } from './ui/debugger-panel.js';
import type { DebuggerLayout, DebuggerTab, DebuggerTheme } from './ui/ui-types.js';
import { PanelController } from './ui/panel-controller.js';
import { registerToggleShortcut, validateToggleShortcut } from './ui/keyboard-shortcut.js';

export type DebuggerPosition = 'left' | 'right';
export type { DebuggerLayout, DebuggerTab, DebuggerTheme };

export interface DebuggerOptions {
  map?: Map;
  target?: HTMLElement;
  initiallyOpen?: boolean;
  position?: DebuggerPosition;
  layout?: DebuggerLayout;
  width?: number;
  zIndex?: number;
  theme?: DebuggerTheme;
  initialTab?: DebuggerTab;
  /** Keyboard chord that toggles the panel, for example `Ctrl+Shift+.`. Disabled by default. */
  toggleShortcut?: string | false;
  enableDiagnostics?: boolean;
  autoDiagnose?: boolean;
  includeResolvedIssues?: boolean;
  includeFullUrlsInReport?: boolean;
  rules?: DiagnosticRule[];
  disabledRuleIds?: string[];
  onError?: (error: DebuggerError) => void;
}

export interface DebuggerController {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  toggle(): void;
  connect(map: Map): void;
  disconnect(): void;
  inspect(): DebugSnapshot | undefined;
  diagnose(): DiagnosticIssue[];
  getIssues(options?: IssueQueryOptions): DiagnosticIssue[];
  exportReport(): DebugReport;
  subscribeSnapshot(listener: (snapshot: DebugSnapshot) => void): () => void;
  subscribeIssues(listener: (issues: DiagnosticIssue[]) => void): () => void;
  destroy(): void;
}

const defaults = {
  initiallyOpen: true,
  position: 'right' as DebuggerPosition,
  layout: 'overlay' as DebuggerLayout,
  width: 380,
  zIndex: 2_147_483_000,
  theme: 'dark' as DebuggerTheme,
  initialTab: 'overview' as DebuggerTab,
  enableDiagnostics: true,
  autoDiagnose: true,
  includeResolvedIssues: true,
  includeFullUrlsInReport: false,
};

export function createDebugger(options: DebuggerOptions = {}): DebuggerController {
  const resolved = { ...defaults, ...options };
  if (!Number.isFinite(resolved.width) || resolved.width <= 0) throw new DebuggerError('INVALID_OPTIONS', 'width must be a finite positive number.');
  if (!Number.isFinite(resolved.zIndex)) throw new DebuggerError('INVALID_OPTIONS', 'zIndex must be a finite number.');
  if (resolved.toggleShortcut !== undefined && resolved.toggleShortcut !== false) {
    try { validateToggleShortcut(resolved.toggleShortcut); }
    catch (error) { throw new DebuggerError('INVALID_OPTIONS', error instanceof Error ? error.message : String(error)); }
  }
  if (typeof document === 'undefined') throw new DebuggerError('UI_INITIALIZATION_FAILED', 'createDebugger() requires a browser document.');

  try { defineOLDebuggerElements(); }
  catch (error) { throw new DebuggerError('UI_INITIALIZATION_FAILED', error instanceof Error ? error.message : String(error)); }

  const runtime = new DebuggerRuntime(options);
  const panel = document.createElement('ol-debugger-panel') as DebuggerPanel;
  const panelController = new PanelController(panel, runtime);
  panel.open = resolved.initiallyOpen;
  panel.theme = resolved.theme;
  panel.position = resolved.position;
  panel.layout = resolved.layout;
  panel.width = resolved.width;
  panel.zIndex = resolved.zIndex;
  panel.includeFullUrlsInReport = resolved.includeFullUrlsInReport;
  panel.includeResolvedIssues = resolved.includeResolvedIssues;
  panel.initialTab = resolved.initialTab;
  panel.setAttribute('data-layout', resolved.layout);
  panel.dataset.theme = resolved.theme === 'light' ? 'light' : resolved.theme === 'dark' ? 'dark' : 'auto';
  if (resolved.initialTab !== 'overview') panel.setAttribute('data-initial-tab', resolved.initialTab);
  (options.target ?? document.body).append(panel);
  if (options.map) runtime.connect(options.map);
  panelController.refreshConnection();

  let destroyed = false;
  const togglePanel = (): void => { panel.open = !panel.open; };
  const unregisterShortcut = resolved.toggleShortcut
    ? registerToggleShortcut(panel.ownerDocument, resolved.toggleShortcut, () => { if (!destroyed) togglePanel(); })
    : undefined;
  const assertAlive = (): void => { if (destroyed) throw new DebuggerError('INSTANCE_DESTROYED', 'This debugger instance has been destroyed.'); };
  return {
    element: panel,
    open() { assertAlive(); panel.open = true; },
    close() { assertAlive(); panel.open = false; },
    toggle() { assertAlive(); togglePanel(); },
    connect(map) { assertAlive(); panelController.connect(map); },
    disconnect() { assertAlive(); panelController.disconnect(); },
    inspect() { return destroyed ? undefined : runtime.inspect(); },
    diagnose() { assertAlive(); return runtime.diagnose(); },
    getIssues(query) { return destroyed ? [] : runtime.getIssues(query); },
    exportReport() {
      try { return createReport(destroyed ? undefined : runtime.inspect(), destroyed ? [] : runtime.getIssues(), resolved.includeFullUrlsInReport, (error) => { runtime.notifyReportExportFailed(error); }); }
      catch (error) { throw runtime.notifyReportExportFailed(error); }
    },
    subscribeSnapshot(listener) { return destroyed ? () => undefined : runtime.subscribeSnapshot(listener); },
    subscribeIssues(listener) { return destroyed ? () => undefined : runtime.subscribeIssues(listener); },
    destroy() {
      if (destroyed) return;
      unregisterShortcut?.();
      panelController.dispose();
      runtime.destroy();
      panel.remove();
      destroyed = true;
    },
  };
}
