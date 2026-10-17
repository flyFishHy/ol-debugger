import { LitElement, css, html, nothing } from 'lit';
import type { LayerSnapshot } from '../../snapshot/snapshot-types.js';

export class LayerTree extends LitElement {
  static properties = { layers: { attribute: false }, selectedId: { type: String }, query: { type: String } };
  declare layers: LayerSnapshot[];
  declare selectedId: string | undefined;
  declare query: string;
  private expanded = new Set<string>();
  static styles = css`
    :host { display: block; min-width: 0; }
    .ol-debugger-tree { display: grid; gap: 2px; }
    button { width: 100%; display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 5px 9px; border: 1px solid transparent; border-radius: 7px; color: var(--ol-debugger-text); background: transparent; text-align: left; font: 12px/1.3 var(--ol-debugger-font, system-ui, sans-serif); cursor: pointer; }
    button:hover { background: var(--ol-debugger-hover); }
    button.ol-debugger-selected { border-color: var(--ol-debugger-accent-border); background: var(--ol-debugger-accent-bg); }
    .ol-debugger-arrow { width: 10px; color: var(--ol-debugger-muted); font-size: 10px; }
    .ol-debugger-kind { width: 16px; height: 16px; display: grid; place-items: center; border-radius: 4px; background: var(--ol-debugger-subtle); color: var(--ol-debugger-muted); font-size: 9px; }
    .ol-debugger-title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; }
    .ol-debugger-hidden { color: var(--ol-debugger-muted); opacity: .68; }
    .ol-debugger-rows { display: grid; gap: 2px; }
  `;
  private toggle(id: string): void {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
    this.requestUpdate();
  }
  private select(id: string): void { this.dispatchEvent(new CustomEvent('layer-select', { detail: { layerId: id }, bubbles: true, composed: true })); }
  private renderLayer(layer: LayerSnapshot, depth: number, visible: boolean): unknown {
    const children = this.layers.filter((item) => item.parentId === layer.id);
    const expanded = this.expanded.has(layer.id) || Boolean(this.query);
    if (this.query && !this.matchesQuery(layer)) return nothing;
    return html`<div class="ol-debugger-rows">
      <button class="${this.selectedId === layer.id ? 'ol-debugger-selected' : ''} ${!visible ? 'ol-debugger-hidden' : ''}" style="padding-left:${8 + depth * 14}px" role="treeitem" aria-level=${depth + 1} aria-selected=${this.selectedId === layer.id} @click=${() => this.select(layer.id)}>
        <span class="ol-debugger-arrow" @click=${(event: Event) => { if (children.length) { event.stopPropagation(); this.toggle(layer.id); } }}>${children.length ? (expanded ? '▾' : '▸') : ''}</span>
        <span class="ol-debugger-kind">${layer.kind === 'group' ? 'G' : 'L'}</span><span class="ol-debugger-title">${layer.title}</span>
        ${!layer.effectivelyVisible ? html`<span title="Not visible">◌</span>` : nothing}
      </button>
      ${children.length && expanded ? children.map((child) => this.renderLayer(child, depth + 1, visible && layer.visible)) : nothing}
    </div>`;
  }
  private matchesQuery(layer: LayerSnapshot): boolean {
    const query = this.query.toLocaleLowerCase();
    if (layer.title.toLocaleLowerCase().includes(query) || layer.className.toLocaleLowerCase().includes(query)) return true;
    return this.layers.some((item) => item.parentId === layer.id && this.matchesQuery(item));
  }
  render() {
    const roots = this.layers.filter((layer) => !layer.parentId);
    return html`<div class="ol-debugger-tree" role="tree">${roots.map((layer) => this.renderLayer(layer, 0, true))}</div>`;
  }
}
