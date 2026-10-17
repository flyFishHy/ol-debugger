import { LitElement, css, html } from 'lit';
import type { DebuggerTab } from '../ui-types.js';

export class DebuggerTabs extends LitElement {
  static properties = { activeTab: { type: String }, activeIssueCount: { type: Number } };
  declare activeTab: DebuggerTab;
  declare activeIssueCount: number;
  static styles = css`
    :host { display: block; }
    nav { display: flex; gap: 5px; padding: 12px 14px 0; border-bottom: 1px solid var(--ol-debugger-border); }
    button { padding: 9px 11px 10px; color: var(--ol-debugger-muted); background: none; border: 0; border-bottom: 2px solid transparent; font: 600 11px/1 var(--ol-debugger-font, system-ui, sans-serif); cursor: pointer; }
    button.ol-debugger-active { color: var(--ol-debugger-accent); border-bottom-color: var(--ol-debugger-accent); }
  `;
  private select(tab: DebuggerTab): void { this.dispatchEvent(new CustomEvent('tab-select', { detail: { tab }, bubbles: true, composed: true })); }
  render() { return html`<nav role="tablist" aria-label="Debugger sections">${(['overview', 'layers', 'issues'] as const).map((tab) => html`<button role="tab" aria-selected=${this.activeTab === tab} class=${this.activeTab === tab ? 'ol-debugger-active' : ''} @click=${() => this.select(tab)}>${tab[0]!.toUpperCase()}${tab.slice(1)}${tab === 'issues' && this.activeIssueCount ? html`<span style="margin-left:5px">${this.activeIssueCount}</span>` : ''}</button>`)}</nav>`; }
}
