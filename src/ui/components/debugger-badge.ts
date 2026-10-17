import { LitElement, css, html } from 'lit';

export class DebuggerBadge extends LitElement {
  static properties = { label: {}, tone: {} };
  declare label: string;
  declare tone: 'error' | 'warning' | 'info' | 'success' | 'neutral';
  static styles = css`
    :host { display: inline-flex; }
    span { display: inline-flex; align-items: center; border: 1px solid currentColor; border-radius: 999px; padding: 2px 8px; font: 600 10px/1.5 var(--ol-debugger-font, system-ui, sans-serif); letter-spacing: .04em; text-transform: uppercase; }
    .ol-debugger-error { color: var(--ol-debugger-danger); background: var(--ol-debugger-danger-bg); }
    .ol-debugger-warning { color: var(--ol-debugger-warning); background: var(--ol-debugger-warning-bg); }
    .ol-debugger-info { color: var(--ol-debugger-accent); background: var(--ol-debugger-accent-bg); }
    .ol-debugger-success { color: var(--ol-debugger-success); background: var(--ol-debugger-success-bg); }
    .ol-debugger-neutral { color: var(--ol-debugger-muted); background: var(--ol-debugger-subtle); }
  `;
  render() { return html`<span class="ol-debugger-${this.tone ?? 'neutral'}"><slot>${this.label}</slot></span>`; }
}
