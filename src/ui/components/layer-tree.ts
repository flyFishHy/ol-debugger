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
    .tree { display: grid; gap: 2px; }
    button { width: 100%; display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 5px 9px; border: 1px solid transparent; border-radius: 7px; color: var(--od-text); background: transparent; text-align: left; font: 12px/1.3 var(--od-font, system-ui, sans-serif); cursor: pointer; }
    button:hover { background: var(--od-hover); }
    button.selected { border-color: var(--od-accent-border); background: var(--od-accent-bg); }
    .arrow { width: 10px; color: var(--od-muted); font-size: 10px; }
    .kind { width: 16px; height: 16px; display: grid; place-items: center; border-radius: 4px; background: var(--od-subtle); color: var(--od-muted); font-size: 9px; }
    .title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; }
    .hidden { color: var(--od-muted); opacity: .68; }
    .rows { display: grid; gap: 2px; }
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
    if (this.query && !layer.title.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()) && !layer.className.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()) && !children.length) return nothing;
    return html`<div class="rows">
      <button class="${this.selectedId === layer.id ? 'selected' : ''} ${!visible ? 'hidden' : ''}" style="padding-left:${8 + depth * 14}px" role="treeitem" aria-level=${depth + 1} aria-selected=${this.selectedId === layer.id} @click=${() => this.select(layer.id)}>
        <span class="arrow" @click=${(event: Event) => { if (children.length) { event.stopPropagation(); this.toggle(layer.id); } }}>${children.length ? (expanded ? '▾' : '▸') : ''}</span>
        <span class="kind">${layer.kind === 'group' ? 'G' : 'L'}</span><span class="title">${layer.title}</span>
        ${!layer.effectivelyVisible ? html`<span title="Not visible">◌</span>` : nothing}
      </button>
      ${children.length && expanded ? children.map((child) => this.renderLayer(child, depth + 1, visible && layer.visible)) : nothing}
    </div>`;
  }
  render() {
    const roots = this.layers.filter((layer) => !layer.parentId);
    return html`<div class="tree" role="tree">${roots.map((layer) => this.renderLayer(layer, 0, true))}</div>`;
  }
}
