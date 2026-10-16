import { LitElement, css, html, nothing } from 'lit';
import type { DebugSnapshot, LayerSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssue, IssueSeverity, IssueStatus } from '../issue/issue-types.js';
import type { DebuggerLayout, DebuggerTab, DebuggerTheme } from './ui-types.js';
import type { DebuggerViewModel } from './ui-types.js';
import { createReport } from '../report/create-report.js';

export class DebuggerPanel extends LitElement {
  static properties = {
    viewModel: { attribute: false }, open: { type: Boolean }, theme: {}, position: {}, layout: {}, width: { type: Number }, zIndex: { type: Number },
    includeFullUrlsInReport: { type: Boolean }, includeResolvedIssues: { type: Boolean }, initialTab: {},
  };
  declare viewModel: DebuggerViewModel | undefined;
  declare open: boolean;
  declare theme: DebuggerTheme;
  declare position: 'left' | 'right';
  declare layout: DebuggerLayout;
  declare width: number;
  declare zIndex: number;
  declare includeFullUrlsInReport: boolean;
  declare includeResolvedIssues: boolean;
  declare initialTab: DebuggerTab;

  private snapshot: DebugSnapshot | undefined;
  private issues: DiagnosticIssue[] = [];
  private connected = false;
  private activeTab: DebuggerTab = 'overview';
  private selectedLayerId: string | undefined;
  private selectedIssueId: string | undefined;
  private layerQuery = '';
  private issueSeverity: IssueSeverity | 'all' = 'all';
  private issueStatus: IssueStatus | 'all' = 'all';
  private actualTheme: 'light' | 'dark' = 'dark';
  private toast = '';
  private toastTimeout: number | undefined;
  private unsubscribers: Array<() => void> = [];
  private mediaQuery: MediaQueryList | undefined;
  private readonly mediaChange = (): void => { this.updateTheme(); };
  private readonly closeListener = (): void => { this.open = false; };

  static styles = css`
    :host { --od-bg:#111722; --od-surface:#171f2c; --od-subtle:#202b3a; --od-hover:#202d3e; --od-border:#2b3748; --od-text:#e7edf5; --od-muted:#8f9caf; --od-accent:#72b8ff; --od-accent-bg:#142c43; --od-accent-border:#315a7c; --od-danger:#ff8b83; --od-danger-bg:#402522; --od-warning:#f5c575; --od-warning-bg:#3c3020; --od-success:#6dd5ad; --od-success-bg:#17382f; --od-font:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: block; color:var(--od-text); font-family:var(--od-font); }
    :host([hidden]) { display:none; }
    :host([data-theme="light"]) { --od-bg:#f5f7fa; --od-surface:#fff; --od-subtle:#eef1f5; --od-hover:#eef4fa; --od-border:#d8dee8; --od-text:#182233; --od-muted:#657286; --od-accent:#1765a5; --od-accent-bg:#e7f2fc; --od-accent-border:#aac8e2; --od-danger:#a93630; --od-danger-bg:#fff0ef; --od-warning:#875a0a; --od-warning-bg:#fff6e3; --od-success:#167352; --od-success-bg:#e7f8f1; }
    .shell { position:fixed; top:0; bottom:0; width:min(var(--od-width,380px),100vw); z-index:var(--od-z,2147483000); display:flex; flex-direction:column; background:var(--od-bg); border:1px solid var(--od-border); box-shadow:0 16px 48px #0004; color:var(--od-text); transition:transform .18s ease, opacity .18s ease; }
    .shell.right { right:0; border-radius:14px 0 0 14px; }
    .shell.left { left:0; border-radius:0 14px 14px 0; }
    :host([data-layout="embedded"]) .shell { position:relative; top:auto; bottom:auto; left:auto; right:auto; height:100%; max-height:100%; width:100%; min-height:560px; border-radius:12px; }
    .body { min-height:0; flex:1; display:grid; grid-template-rows:auto minmax(0,1fr); }
    nav { display:flex; gap:5px; padding:12px 14px 0; border-bottom:1px solid var(--od-border); }
    nav button { padding:9px 11px 10px; color:var(--od-muted); background:none; border:0; border-bottom:2px solid transparent; font:600 11px/1 var(--od-font); cursor:pointer; }
    nav button.active { color:var(--od-accent); border-bottom-color:var(--od-accent); }
    .content { overflow:auto; min-height:0; padding:14px; }
    .section-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 0 12px; }
    h2 { margin:0; font:700 14px/1.2 var(--od-font); letter-spacing:-.02em; }
    h3 { margin:18px 0 8px; font:700 11px/1.2 var(--od-font); text-transform:uppercase; letter-spacing:.09em; color:var(--od-muted); }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .card { min-width:0; padding:11px; border:1px solid var(--od-border); border-radius:9px; background:var(--od-surface); }
    .label { display:block; margin-bottom:6px; color:var(--od-muted); font:600 9px/1 var(--od-font); text-transform:uppercase; letter-spacing:.08em; }
    .value { display:block; overflow-wrap:anywhere; color:var(--od-text); font:500 12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace; }
    .toolbar { display:flex; gap:7px; align-items:center; margin:0 0 12px; }
    input, select { width:100%; min-width:0; padding:8px 9px; color:var(--od-text); background:var(--od-surface); border:1px solid var(--od-border); border-radius:7px; font:12px/1.2 var(--od-font); outline:none; }
    input:focus, select:focus { border-color:var(--od-accent); box-shadow:0 0 0 2px color-mix(in srgb,var(--od-accent) 20%,transparent); }
    .button { display:inline-flex; align-items:center; justify-content:center; gap:6px; flex:none; min-height:31px; padding:0 10px; color:var(--od-text); background:var(--od-surface); border:1px solid var(--od-border); border-radius:7px; font:600 11px/1 var(--od-font); cursor:pointer; }
    .button:hover { border-color:var(--od-accent-border); background:var(--od-hover); }
    .button.primary { color:#061321; background:var(--od-accent); border-color:var(--od-accent); }
    .button.primary:hover { filter:brightness(1.06); }
    .columns { display:grid; grid-template-columns:minmax(0,1fr); gap:13px; }
    .details { margin-top:14px; padding-top:13px; border-top:1px solid var(--od-border); }
    dl { display:grid; grid-template-columns:112px minmax(0,1fr); gap:8px 10px; margin:0; font:11px/1.45 var(--od-font); }
    dt { color:var(--od-muted); } dd { margin:0; overflow-wrap:anywhere; color:var(--od-text); }
    .empty { padding:24px 16px; color:var(--od-muted); background:var(--od-surface); border:1px dashed var(--od-border); border-radius:10px; text-align:center; font:12px/1.6 var(--od-font); }
    .suggestions { margin:8px 0 0; padding-left:17px; color:var(--od-muted); font:11px/1.55 var(--od-font); }
    pre { max-height:180px; overflow:auto; margin:8px 0 0; padding:10px; color:var(--od-text); background:var(--od-surface); border:1px solid var(--od-border); border-radius:8px; font:10px/1.5 ui-monospace,monospace; white-space:pre-wrap; overflow-wrap:anywhere; }
    footer { height:36px; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:0 14px; color:var(--od-muted); border-top:1px solid var(--od-border); font:10px/1 var(--od-font); }
    .status { max-width:72%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .toast { position:absolute; left:14px; bottom:48px; padding:9px 11px; color:var(--od-text); background:var(--od-subtle); border:1px solid var(--od-border); border-radius:8px; box-shadow:0 8px 24px #0003; font:11px/1.3 var(--od-font); }
    @media (max-width:520px) { .shell { width:100vw; border-radius:0!important; } }
  `;

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
    this.style.setProperty('--od-width', `${this.width || 380}px`);
    this.style.setProperty('--od-z', String(this.zIndex ?? 2147483000));
  }

  private subscribe(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    if (!this.viewModel) return;
    this.unsubscribers.push(this.viewModel.subscribeSnapshot((snapshot) => { this.snapshot = snapshot; this.connected = true; this.requestUpdate(); }));
    this.unsubscribers.push(this.viewModel.subscribeIssues((issues) => { this.issues = issues; this.requestUpdate(); }));
    this.refreshConnection();
  }

  private updateTheme(): void {
    this.actualTheme = this.theme === 'light' ? 'light' : this.theme === 'dark' ? 'dark' : this.mediaQuery?.matches ? 'dark' : typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    this.requestUpdate();
  }

  private setTab(tab: DebuggerTab): void { this.activeTab = tab; this.requestUpdate(); }
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
    try {
      const report = createReport(this.snapshot, this.issues, this.includeFullUrlsInReport);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const date = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      anchor.href = url;
      anchor.download = `ol-debugger-report-${date}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      this.toastMessage('JSON report exported');
    } catch (error) { this.toastMessage(error instanceof Error ? error.message : 'Report export failed'); }
  }

  private toastMessage(message: string): void {
    this.toast = message;
    this.requestUpdate();
    if (this.toastTimeout !== undefined) window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => { this.toast = ''; this.toastTimeout = undefined; this.requestUpdate(); }, 2600);
  }

  private card(label: string, value: string | number | undefined): unknown {
    return html`<div class="card"><span class="label">${label}</span><span class="value">${value ?? '—'}</span></div>`;
  }

  private renderOverview(): unknown {
    const map = this.snapshot?.map;
    if (!this.connected || !map) return html`<div class="empty">Connect an OpenLayers map to inspect its live state.</div>`;
    return html`<div class="section-title"><h2>Map overview</h2><button class="button" @click=${this.runDiagnostics}>↻ Run diagnostics</button></div>
      <div class="grid">${this.card('Projection', map.projectionCode)}${this.card('Zoom', map.zoom === null ? 'invalid' : map.zoom)}${this.card('Center', map.center?.map((n) => n === null ? 'invalid' : n.toFixed(3)).join(', '))}${this.card('Resolution', typeof map.resolution === 'number' ? map.resolution.toPrecision(5) : map.resolution === null ? 'invalid' : undefined)}${this.card('Rotation', map.rotation?.toFixed(3))}${this.card('Map size', map.size?.map((n) => `${Math.round(n)} px`).join(' × '))}${this.card('View extent', map.viewExtent?.map((n) => n.toFixed(1)).join(', '))}${this.card('Layers', this.snapshot?.layers.length)}${this.card('Active issues', this.activeCount)}</div>
      <h3>Inspection</h3><p style="color:var(--od-muted);font-size:11px;line-height:1.5">Snapshots contain normalized map and layer metadata. The debugger does not modify the connected map or send data over the network.</p>`;
  }

  private renderLayerDetails(layer: LayerSnapshot | undefined): unknown {
    if (!layer) return html`<div class="empty">Select a layer to inspect its settings and source state.</div>`;
    const pairs: Array<[string, unknown]> = [
      ['Stable ID', layer.id], ['Title', layer.title], ['Class', layer.className], ['Parent ID', layer.parentId ?? '—'],
      ['Visible', String(layer.visible)], ['Effective visibility', String(layer.effectivelyVisible)], ['Opacity', layer.opacity], ['Effective opacity', layer.effectiveOpacity],
      ['zIndex', layer.zIndex ?? '—'], ['Extent', layer.extent?.join(', ') ?? '—'], ['minZoom / maxZoom', `${layer.minZoom ?? 'No limit'} / ${layer.maxZoom ?? 'No limit'}`],
      ['minResolution / maxResolution', `${layer.minResolution ?? 'No limit'} / ${layer.maxResolution ?? 'No limit'}`],
      ['Source', layer.source?.type ?? (layer.kind === 'group' ? '—' : 'Unavailable')], ['Source state', layer.source?.state ?? '—'],
      ['Source URL', layer.source?.url ?? '—'], ['Load events', layer.source?.loadEventsMonitored ? 'Monitored' : layer.source ? 'Not monitored for this source type' : '—'],
    ];
    return html`<div class="details"><h3>${layer.title}</h3><dl>${pairs.map(([key, value]) => html`<dt>${key}</dt><dd>${value}</dd>`)}</dl></div>`;
  }

  private renderLayers(): unknown {
    if (!this.connected || !this.snapshot) return html`<div class="empty">Connect a map to browse its layer tree.</div>`;
    return html`<div class="section-title"><h2>Layers <span style="color:var(--od-muted);font-weight:400">${this.snapshot.layers.length}</span></h2><button class="button" @click=${this.runDiagnostics}>↻ Diagnose</button></div>
      <div class="toolbar"><input aria-label="Filter layers" placeholder="Filter by name or type" .value=${this.layerQuery} @input=${this.setLayerQuery}></div>
      <div class="columns"><ol-debugger-layer-tree .layers=${this.snapshot.layers} .selectedId=${this.selectedLayerId} .query=${this.layerQuery} @layer-select=${this.selectLayer}></ol-debugger-layer-tree>${this.renderLayerDetails(this.selectedLayer)}</div>`;
  }

  private renderIssueDetails(issue: DiagnosticIssue | undefined): unknown {
    if (!issue) return html`<div class="empty">Select an issue to read its evidence and suggestions.</div>`;
    const evidence = Object.fromEntries(Object.entries(issue.evidence).filter(([, value]) => value !== undefined));
    return html`<div class="details"><div class="section-title"><h3>${issue.title}</h3><ol-debugger-badge .tone=${issue.severity} .label=${issue.severity}></ol-debugger-badge></div>
      <p style="font-size:12px;line-height:1.55">${issue.message}</p><dl><dt>Rule</dt><dd>${issue.ruleId}</dd><dt>Status</dt><dd>${issue.status}</dd><dt>Object</dt><dd>${issue.objectLabel ?? 'Map'} · ${issue.objectId ?? '—'}</dd><dt>First seen</dt><dd>${new Date(issue.firstSeenAt).toLocaleString()}</dd><dt>Last seen</dt><dd>${new Date(issue.lastSeenAt).toLocaleString()}</dd><dt>Resolved at</dt><dd>${issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleString() : '—'}</dd></dl>
      <h3>Evidence</h3><pre>${JSON.stringify(evidence, null, 2)}</pre><h3>Suggestions</h3><ul class="suggestions">${issue.suggestions.map((suggestion) => html`<li>${suggestion}</li>`)}</ul></div>`;
  }

  private renderIssues(): unknown {
    return html`<div class="section-title"><h2>Issues <span style="color:var(--od-muted);font-weight:400">${this.activeCount} active</span></h2><div style="display:flex;gap:6px"><button class="button" @click=${this.runDiagnostics}>↻ Run</button><button class="button" @click=${this.exportJson}>↓ Export JSON</button></div></div>
      <div class="toolbar"><select aria-label="Severity filter" .value=${this.issueSeverity} @change=${this.setSeverity}><option value="all">All severity</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option></select><select aria-label="Status filter" .value=${this.issueStatus} @change=${this.setStatus}><option value="all">All status</option><option value="active">Active</option><option value="resolved">Resolved</option></select></div>
      <div class="columns"><ol-debugger-issue-list .issues=${this.issues} .selectedId=${this.selectedIssueId} .severity=${this.issueSeverity} .status=${this.issueStatus} @issue-select=${this.selectIssue}></ol-debugger-issue-list>${this.renderIssueDetails(this.selectedIssue)}</div>`;
  }

  render() {
    if (!this.open) return nothing;
    return html`<section class="shell ${this.position ?? 'right'}" role="region" aria-label="OpenLayers debugger">
      <ol-debugger-header .connected=${this.connected}></ol-debugger-header>
      <div class="body"><nav role="tablist" aria-label="Debugger sections">
        ${(['overview', 'layers', 'issues'] as const).map((tab) => html`<button role="tab" aria-selected=${this.activeTab === tab} class=${this.activeTab === tab ? 'active' : ''} @click=${() => this.setTab(tab)}>${tab[0]!.toUpperCase()}${tab.slice(1)}${tab === 'issues' && this.activeCount ? html`<span style="margin-left:5px">${this.activeCount}</span>` : nothing}</button>`)}
      </nav><main class="content">${this.activeTab === 'overview' ? this.renderOverview() : this.activeTab === 'layers' ? this.renderLayers() : this.renderIssues()}</main></div>
      <footer><span class="status">${this.connected ? `${this.snapshot?.layers.length ?? 0} layers · ${this.activeCount} active issues` : 'No map connected'}</span><span>${this.snapshot ? new Date(this.snapshot.capturedAt).toLocaleTimeString() : '—'}</span></footer>
      ${this.toast ? html`<div class="toast" role="status">${this.toast}</div>` : nothing}
    </section>`;
  }
}
