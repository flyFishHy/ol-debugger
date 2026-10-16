import { LitElement, css, html } from 'lit';

export class DebuggerBadge extends LitElement {
  static properties = { label: {}, tone: {} };
  declare label: string;
  declare tone: 'error' | 'warning' | 'info' | 'success' | 'neutral';
  static styles = css`
    :host { display: inline-flex; }
    span { display: inline-flex; align-items: center; border: 1px solid currentColor; border-radius: 999px; padding: 2px 8px; font: 600 10px/1.5 var(--od-font, system-ui, sans-serif); letter-spacing: .04em; text-transform: uppercase; }
    .error { color: var(--od-danger); background: var(--od-danger-bg); }
    .warning { color: var(--od-warning); background: var(--od-warning-bg); }
    .info { color: var(--od-accent); background: var(--od-accent-bg); }
    .success { color: var(--od-success); background: var(--od-success-bg); }
    .neutral { color: var(--od-muted); background: var(--od-subtle); }
  `;
  render() { return html`<span class=${this.tone ?? 'neutral'}><slot>${this.label}</slot></span>`; }
}
