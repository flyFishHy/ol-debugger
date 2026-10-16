import { LitElement, css, html } from 'lit';

export class DebuggerHeader extends LitElement {
  static properties = { connected: { type: Boolean } };
  declare connected: boolean;
  static styles = css`
    :host { display: block; }
    header { height: 58px; display: flex; align-items: center; gap: 10px; padding: 0 18px; border-bottom: 1px solid var(--od-border); }
    .mark { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 9px; color: var(--od-accent); background: var(--od-accent-bg); font-weight: 800; }
    strong { font: 700 14px/1 var(--od-font, system-ui, sans-serif); letter-spacing: -.02em; }
    .connection { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--od-muted); font: 11px/1 var(--od-font, system-ui, sans-serif); }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--od-muted); }
    .dot.on { background: var(--od-success); box-shadow: 0 0 0 3px var(--od-success-bg); }
    button { border: 0; color: var(--od-muted); background: transparent; width: 30px; height: 30px; border-radius: 8px; font-size: 20px; cursor: pointer; }
    button:hover { color: var(--od-text); background: var(--od-hover); }
  `;
  private close(): void { this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true })); }
  render() { return html`<header><span class="mark">O</span><strong>ol-debugger</strong><span class="connection"><i class="dot ${this.connected ? 'on' : ''}"></i>${this.connected ? 'Connected' : 'Disconnected'}</span><button aria-label="Close panel" title="Close" @click=${this.close}>×</button></header>`; }
}
