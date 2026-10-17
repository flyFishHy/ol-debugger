import type Map from 'ol/Map.js';
import type { DebuggerRuntime } from '../runtime/debugger-runtime.js';
import type { DebuggerPanel } from './debugger-panel.js';
import type { DebuggerViewModel } from './ui-types.js';

export class PanelController {
  constructor(private readonly panel: DebuggerPanel, private readonly runtime: DebuggerRuntime) {
    panel.viewModel = this.createViewModel();
    panel.reportError = (error) => this.runtime.notifyReportExportFailed(error);
  }

  connect(map: Map): void { this.runtime.connect(map); this.refreshConnection(); }
  disconnect(): void { this.runtime.disconnect(); this.refreshConnection(); }
  refreshConnection(): void { this.panel.refreshConnection(); }
  dispose(): void { this.panel.disposeViewModel(); this.panel.reportError = undefined; }

  private createViewModel(): DebuggerViewModel {
    return {
      isConnected: () => this.runtime.isConnected(),
      getSnapshot: () => this.runtime.getSnapshot(),
      getLastDiagnosedAt: () => this.runtime.getLastDiagnosedAt(),
      getIssues: (options) => this.runtime.getIssues(options),
      diagnose: () => this.runtime.diagnose(),
      subscribeSnapshot: (listener) => this.runtime.subscribeSnapshot(listener),
      subscribeIssues: (listener) => this.runtime.subscribeIssues(listener),
    };
  }
}
