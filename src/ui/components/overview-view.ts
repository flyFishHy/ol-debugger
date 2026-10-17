import { LitElement, css, html } from 'lit';
import type { MapSnapshot } from '../../snapshot/snapshot-types.js';

export class OverviewView extends LitElement {
  static properties = { mapSnapshot: { attribute: false }, layerCount: { type: Number }, activeIssueCount: { type: Number } };
  declare mapSnapshot: MapSnapshot | undefined;
  declare layerCount: number;
  declare activeIssueCount: number;
  static styles = css`
    :host { display: block; }
    .ol-debugger-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ol-debugger-card { min-width: 0; padding: 11px; border: 1px solid var(--ol-debugger-border); border-radius: 9px; background: var(--ol-debugger-surface); }
    .ol-debugger-label { display: block; margin-bottom: 6px; color: var(--ol-debugger-muted); font: 600 9px/1 var(--ol-debugger-font, system-ui, sans-serif); text-transform: uppercase; }
    .ol-debugger-value { display: block; overflow-wrap: anywhere; color: var(--ol-debugger-text); font: 500 12px/1.35 ui-monospace, monospace; }
    h2 { margin: 0 0 12px; font: 700 14px/1.2 var(--ol-debugger-font, system-ui, sans-serif); }
    h3 { color: var(--ol-debugger-muted); font: 700 11px/1.2 var(--ol-debugger-font, system-ui, sans-serif); text-transform: uppercase; }
    p { color: var(--ol-debugger-muted); font: 11px/1.5 var(--ol-debugger-font, system-ui, sans-serif); }
  `;
  private card(label: string, value: string | number | undefined) { return html`<div class="ol-debugger-card"><span class="ol-debugger-label">${label}</span><span class="ol-debugger-value">${value ?? '—'}</span></div>`; }
  render() {
    const map = this.mapSnapshot;
    if (!map) return html`<div class="ol-debugger-empty">Connect an OpenLayers map to inspect its live state.</div>`;
    return html`<h2>Map overview</h2><div class="ol-debugger-grid">
      ${this.card('Projection', map.projectionCode)}${this.card('Center', map.center?.map((v) => v === null ? 'invalid' : v.toFixed(3)).join(', '))}
      ${this.card('Zoom', map.zoom === null ? 'invalid' : map.zoom)}${this.card('Resolution', typeof map.resolution === 'number' ? map.resolution.toPrecision(5) : map.resolution === null ? 'invalid' : undefined)}
      ${this.card('Rotation', map.rotation?.toFixed(3))}${this.card('View extent', map.viewExtent?.map((v) => v.toFixed(1)).join(', '))}
      ${this.card('Map size', map.size?.map((v) => `${Math.round(v)} px`).join(' × '))}${this.card('Layers', this.layerCount)}${this.card('Active issues', this.activeIssueCount)}
    </div><h3>Inspection</h3><p>Snapshot metadata is read-only and remains local to this browser.</p>`;
  }
}
