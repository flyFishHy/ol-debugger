import { LitElement, css, html } from 'lit';

export class DebuggerHeader extends LitElement {
  static properties = { connected: { type: Boolean } };
  declare connected: boolean;
  static styles = css`
    :host { display: block; }
    header { height: 58px; display: flex; align-items: center; gap: 10px; padding: 0 18px; border-bottom: 1px solid var(--ol-debugger-border); }
    .ol-debugger-mark { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 9px; color: var(--ol-debugger-accent); background: var(--ol-debugger-accent-bg); font-weight: 800; }
    strong { font: 700 14px/1 var(--ol-debugger-font, system-ui, sans-serif); letter-spacing: -.02em; }
    .ol-debugger-connection { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--ol-debugger-muted); font: 11px/1 var(--ol-debugger-font, system-ui, sans-serif); }
    .ol-debugger-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ol-debugger-muted); }
    .ol-debugger-dot.ol-debugger-on { background: var(--ol-debugger-success); box-shadow: 0 0 0 3px var(--ol-debugger-success-bg); }
    button { border: 0; color: var(--ol-debugger-muted); background: transparent; width: 30px; height: 30px; border-radius: 8px; font-size: 20px; cursor: pointer; }
    button:hover { color: var(--ol-debugger-text); background: var(--ol-debugger-hover); }
  `;
  private close(): void { this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true })); }
  render() { return html`<header><span class="ol-debugger-mark">O</span><strong>ol-debugger</strong><span class="ol-debugger-connection"><i class="ol-debugger-dot ${this.connected ? 'ol-debugger-on' : ''}"></i>${this.connected ? 'Connected' : 'Disconnected'}</span><button aria-label="Close panel" title="Close" @click=${this.close}>×</button></header>`; }
}
