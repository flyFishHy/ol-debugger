import { LitElement, css, html } from 'lit';
import type { LayerSnapshot } from '../../snapshot/snapshot-types.js';

export class LayerDetailView extends LitElement {
  static properties = { layer: { attribute: false } };
  declare layer: LayerSnapshot | undefined;
  static styles = css`
    :host { display: block; min-width: 0; }
    .ol-debugger-details { margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--ol-debugger-border); }
    h3 { margin: 0 0 10px; font: 700 12px/1.3 var(--ol-debugger-font, system-ui, sans-serif); }
    dl { display: grid; grid-template-columns: 112px minmax(0,1fr); gap: 8px 10px; margin: 0; font: 11px/1.45 var(--ol-debugger-font, system-ui, sans-serif); }
    dt { color: var(--ol-debugger-muted); } dd { margin: 0; overflow-wrap: anywhere; color: var(--ol-debugger-text); }
    .ol-debugger-empty { padding: 24px 16px; color: var(--ol-debugger-muted); border: 1px dashed var(--ol-debugger-border); border-radius: 10px; text-align: center; font: 12px/1.6 var(--ol-debugger-font, system-ui, sans-serif); }
  `;
  render() {
    const layer = this.layer;
    if (!layer) return html`<div class="ol-debugger-empty">Select a layer to inspect its settings and source state.</div>`;
    const entries: Array<[string, unknown]> = [
      ['Stable ID', layer.id], ['Title / Name', layer.title], ['Class', layer.className], ['Parent ID', layer.parentId ?? '—'],
      ['Visible', String(layer.visible)], ['Effective visibility', String(layer.effectivelyVisible)], ['Opacity', layer.opacity], ['Effective opacity', layer.effectiveOpacity],
      ['zIndex', layer.zIndex ?? '—'], ['Extent', layer.extent?.join(', ') ?? '—'], ['minZoom / maxZoom', `${layer.minZoom ?? 'No limit'} / ${layer.maxZoom ?? 'No limit'}`],
      ['minResolution / maxResolution', `${layer.minResolution ?? 'No limit'} / ${layer.maxResolution ?? 'No limit'}`],
      ['Source', layer.source?.type ?? (layer.kind === 'group' ? '—' : 'Unavailable')], ['Source state', layer.source?.state ?? '—'],
      ['Source URL', layer.source?.url ?? '—'], ['Load events', layer.source?.loadEventsMonitored ? 'Monitored' : layer.source ? 'Not monitored for this source type' : '—'],
    ];
    return html`<div class="ol-debugger-details"><h3>${layer.title}</h3><dl>${entries.map(([key, value]) => html`<dt>${key}</dt><dd>${value}</dd>`)}</dl></div>`;
  }
}
