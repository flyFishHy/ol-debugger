import { LitElement, html, nothing, unsafeCSS } from 'lit';
import themeTokens from './styles/tokens.scss?inline';
import panelStyles from './styles/panel-styles.scss?inline';
import type { DebugSnapshot, LayerSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssue, IssueSeverity, IssueStatus } from '../issue/issue-types.js';
import type { DebuggerLayout, DebuggerTab, DebuggerTheme } from './ui-types.js';
import type { DebuggerViewModel } from './ui-types.js';
import { createReport } from '../report/create-report.js';

export class DebuggerPanel extends LitElement {
  static properties = {
    viewModel: { attribute: false }, reportError: { attribute: false }, open: { type: Boolean }, theme: {}, position: {}, layout: {}, width: { type: Number }, zIndex: { type: Number },
    includeFullUrlsInReport: { type: Boolean }, includeResolvedIssues: { type: Boolean }, initialTab: {},
    snapshot: { state: true }, issues: { state: true }, connected: { state: true }, activeTab: { state: true },
    selectedLayerId: { state: true }, selectedIssueId: { state: true }, layerQuery: { state: true },
    issueSeverity: { state: true }, issueStatus: { state: true }, actualTheme: { state: true }, toast: { state: true },
    lastDiagnosedAt: { state: true },
  };
  declare viewModel: DebuggerViewModel | undefined;
  declare reportError: ((error: unknown) => Error) | undefined;
  declare open: boolean;
  declare theme: DebuggerTheme;
  declare position: 'left' | 'right';
  declare layout: DebuggerLayout;
  declare width: number;
  declare zIndex: number;
  declare includeFullUrlsInReport: boolean;
  declare includeResolvedIssues: boolean;
  declare initialTab: DebuggerTab;

  private declare snapshot: DebugSnapshot | undefined;
  private declare issues: DiagnosticIssue[];
  private declare connected: boolean;
  private declare activeTab: DebuggerTab;
  private declare selectedLayerId: string | undefined;
  private declare selectedIssueId: string | undefined;
  private declare layerQuery: string;
  private declare issueSeverity: IssueSeverity | 'all';
  private declare issueStatus: IssueStatus | 'all';
  private declare actualTheme: 'light' | 'dark';
  private declare toast: string;
  private declare lastDiagnosedAt: number | undefined;
  private toastTimeout: number | undefined;
  private unsubscribers: Array<() => void> = [];
  private mediaQuery: MediaQueryList | undefined;
  private readonly mediaChange = (): void => { this.updateTheme(); };
  private readonly closeListener = (): void => { this.open = false; };

  constructor() {
    super();
    this.issues = [];
    this.connected = false;
    this.activeTab = 'overview';
    this.layerQuery = '';
    this.issueSeverity = 'all';
    this.issueStatus = 'all';
    this.actualTheme = 'dark';
    this.toast = '';
  }

  static styles = [unsafeCSS(themeTokens), unsafeCSS(panelStyles)];

  connectedCallback(): void {
    super.connectedCallback();
    if (this.initialTab) this.activeTab = this.initialTab;
    if (this.includeResolvedIssues === false) this.issueStatus = 'active';
    this.addEventListener('panel-close', this.closeListener);
    this.subscribe();
    this.updateTheme();
    if (this.theme === 'auto' && typeof matchMedia === 'function') {
      this.mediaQuery = matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', this.mediaChange);
    }
    this.syncHostAttributes();
  }

  disconnectedCallback(): void {
    this.removeEventListener('panel-close', this.closeListener);
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    this.mediaQuery?.removeEventListener('change', this.mediaChange);
    this.mediaQuery = undefined;
    if (this.toastTimeout !== undefined) window.clearTimeout(this.toastTimeout);
    this.toastTimeout = undefined;
    super.disconnectedCallback();
  }

  updated(): void { this.syncHostAttributes(); }

  refreshConnection(): void {
    this.connected = this.viewModel?.isConnected() ?? false;
    this.snapshot = this.viewModel?.getSnapshot();
    this.issues = this.viewModel?.getIssues() ?? [];
    this.lastDiagnosedAt = this.viewModel?.getLastDiagnosedAt();
    this.requestUpdate();
  }

  disposeViewModel(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    this.viewModel = undefined;
  }

  private syncHostAttributes(): void {
    this.toggleAttribute('hidden', !this.open);
    this.setAttribute('data-theme', this.actualTheme);
    this.setAttribute('data-layout', this.layout ?? 'overlay');
    this.style.setProperty('--ol-debugger-width', `${this.width || 380}px`);
    this.style.setProperty('--ol-debugger-z', String(this.zIndex ?? 2147483000));
  }

  private subscribe(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    if (!this.viewModel) return;
    this.unsubscribers.push(this.viewModel.subscribeSnapshot((snapshot) => { this.snapshot = snapshot; this.connected = true; this.lastDiagnosedAt = this.viewModel?.getLastDiagnosedAt(); this.requestUpdate(); }));
    this.unsubscribers.push(this.viewModel.subscribeIssues((issues) => { this.issues = issues; this.lastDiagnosedAt = this.viewModel?.getLastDiagnosedAt(); this.requestUpdate(); }));
    this.refreshConnection();
  }

  private updateTheme(): void {
    this.actualTheme = this.theme === 'light' ? 'light' : this.theme === 'dark' ? 'dark' : this.mediaQuery?.matches ? 'dark' : typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    this.requestUpdate();
  }

  private setTab(tab: DebuggerTab): void { this.activeTab = tab; this.requestUpdate(); }
  private selectTab(event: CustomEvent<{ tab: DebuggerTab }>): void { this.setTab(event.detail.tab); }
  private setLayerQuery(event: Event): void { this.layerQuery = (event.currentTarget as HTMLInputElement).value; }
  private setSeverity(event: Event): void { this.issueSeverity = (event.currentTarget as HTMLSelectElement).value as IssueSeverity | 'all'; }
  private setStatus(event: Event): void { this.issueStatus = (event.currentTarget as HTMLSelectElement).value as IssueStatus | 'all'; }
  private selectLayer(event: CustomEvent<{ layerId: string }>): void { this.selectedLayerId = event.detail.layerId; }
  private selectIssue(event: CustomEvent<{ issueId: string }>): void { this.selectedIssueId = event.detail.issueId; }

  private get selectedLayer(): LayerSnapshot | undefined { return this.snapshot?.layers.find((layer) => layer.id === this.selectedLayerId); }
  private get selectedIssue(): DiagnosticIssue | undefined { return this.issues.find((issue) => issue.id === this.selectedIssueId); }
  private get activeCount(): number { return this.issues.filter((issue) => issue.status === 'active').length; }

  private runDiagnostics(): void {
    try { this.issues = this.viewModel?.diagnose() ?? []; this.toastMessage('Diagnostics updated'); }
    catch (error) { this.toastMessage(error instanceof Error ? error.message : 'Unable to diagnose this map'); }
  }

  private exportJson(): void {
    let objectUrl: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      const report = createReport(this.snapshot, this.issues, this.includeFullUrlsInReport, (error) => { this.reportError?.(error); });
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      objectUrl = URL.createObjectURL(blob);
      anchor = document.createElement('a');
      const date = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-').replace(/Z$/, '');
      anchor.href = objectUrl;
      anchor.download = `ol-debugger-report-${date}.json`;
      document.body.append(anchor);
      anchor.click();
      this.toastMessage('JSON report exported');
    } catch (error) {
      const wrapped = this.reportError?.(error);
      this.toastMessage(wrapped?.message ?? (error instanceof Error ? error.message : 'Report export failed'));
    } finally {
      anchor?.remove();
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl!), 0);
    }
  }

  private toastMessage(message: string): void {
    this.toast = message;
    this.requestUpdate();
    if (this.toastTimeout !== undefined) window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => { this.toast = ''; this.toastTimeout = undefined; this.requestUpdate(); }, 2600);
  }

  private card(label: string, value: string | number | undefined): unknown {
    return html`<div class="ol-debugger-card"><span class="ol-debugger-label">${label}</span><span class="ol-debugger-value">${value ?? '—'}</span></div>`;
  }

  private renderOverview(): unknown {
    const map = this.snapshot?.map;
    if (!this.connected || !map) return html`<div class="ol-debugger-empty">Connect an OpenLayers map to inspect its live state.</div>`;
    return html`<div class="ol-debugger-section-title"><h2>Map overview</h2><button class="ol-debugger-button" @click=${this.runDiagnostics}>↻ Run diagnostics</button></div>
      <ol-debugger-overview .mapSnapshot=${map} .layerCount=${this.snapshot?.layers.length ?? 0} .activeIssueCount=${this.activeCount}></ol-debugger-overview>`;
  }

  private renderLayerDetails(layer: LayerSnapshot | undefined): unknown {
    return html`<ol-debugger-layer-detail .layer=${layer}></ol-debugger-layer-detail>`;
  }

  private renderLayers(): unknown {
    if (!this.connected || !this.snapshot) return html`<div class="ol-debugger-empty">Connect a map to browse its layer tree.</div>`;
    return html`<div class="ol-debugger-section-title"><h2>Layers <span style="color:var(--ol-debugger-muted);font-weight:400">${this.snapshot.layers.length}</span></h2><button class="ol-debugger-button" @click=${this.runDiagnostics}>↻ Diagnose</button></div>
      <div class="ol-debugger-toolbar"><input aria-label="Filter layers" placeholder="Filter by name or type" .value=${this.layerQuery} @input=${this.setLayerQuery}></div>
      <div class="ol-debugger-columns"><ol-debugger-layer-tree .layers=${this.snapshot.layers} .selectedId=${this.selectedLayerId} .query=${this.layerQuery} @layer-select=${this.selectLayer}></ol-debugger-layer-tree>${this.renderLayerDetails(this.selectedLayer)}</div>`;
  }

  private renderIssueDetails(issue: DiagnosticIssue | undefined): unknown {
    return html`<ol-debugger-issue-detail .issue=${issue}></ol-debugger-issue-detail>`;
  }

  private renderIssues(): unknown {
    return html`<div class="ol-debugger-section-title"><h2>Issues <span style="color:var(--ol-debugger-muted);font-weight:400">${this.activeCount} active</span></h2><div style="display:flex;gap:6px"><button class="ol-debugger-button" @click=${this.runDiagnostics}>↻ Run</button><button class="ol-debugger-button" @click=${this.exportJson}>↓ Export JSON</button></div></div>
      <div class="ol-debugger-toolbar"><select aria-label="Severity filter" .value=${this.issueSeverity} @change=${this.setSeverity}><option value="all">All severity</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option></select><select aria-label="Status filter" .value=${this.issueStatus} @change=${this.setStatus}><option value="all">All status</option><option value="active">Active</option><option value="resolved">Resolved</option></select></div>
      <div class="ol-debugger-columns"><ol-debugger-issue-list .issues=${this.issues} .selectedId=${this.selectedIssueId} .severity=${this.issueSeverity} .status=${this.issueStatus} @issue-select=${this.selectIssue}></ol-debugger-issue-list>${this.renderIssueDetails(this.selectedIssue)}</div>`;
  }

  render() {
    if (!this.open) return nothing;
    return html`<section class="ol-debugger-shell ol-debugger-${this.position ?? 'right'}" role="region" aria-label="OpenLayers debugger">
      <ol-debugger-header .connected=${this.connected}></ol-debugger-header>
      <div class="ol-debugger-body"><ol-debugger-tabs .activeTab=${this.activeTab} .activeIssueCount=${this.activeCount} @tab-select=${this.selectTab}></ol-debugger-tabs>
        <main class="ol-debugger-content">${this.activeTab === 'overview' ? this.renderOverview() : this.activeTab === 'layers' ? this.renderLayers() : this.renderIssues()}</main></div>
      <footer><span class="ol-debugger-status">${this.connected ? `${this.snapshot?.layers.length ?? 0} layers · ${this.activeCount} active issues` : 'No map connected'}</span><span>${this.lastDiagnosedAt ? new Date(this.lastDiagnosedAt).toLocaleTimeString() : '—'}</span></footer>
      ${this.toast ? html`<div class="ol-debugger-toast" role="status">${this.toast}</div>` : nothing}
    </section>`;
  }
}
