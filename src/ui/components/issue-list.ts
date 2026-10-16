import { LitElement, css, html } from 'lit';
import type { DiagnosticIssue, IssueSeverity, IssueStatus } from '../../issue/issue-types.js';

export class IssueList extends LitElement {
  static properties = { issues: { attribute: false }, selectedId: { type: String }, severity: { type: String }, status: { type: String } };
  declare issues: DiagnosticIssue[];
  declare selectedId: string | undefined;
  declare severity: IssueSeverity | 'all';
  declare status: IssueStatus | 'all';
  static styles = css`
    :host { display: block; min-width: 0; }
    .list { display: grid; gap: 6px; }
    button { display: grid; grid-template-columns: auto 1fr; gap: 6px 9px; width: 100%; padding: 10px; color: var(--od-text); text-align: left; background: var(--od-surface); border: 1px solid var(--od-border); border-radius: 9px; cursor: pointer; }
    button:hover, button.selected { border-color: var(--od-accent-border); background: var(--od-hover); }
    strong { align-self: center; font: 600 12px/1.3 var(--od-font, system-ui, sans-serif); }
    small { grid-column: 2; color: var(--od-muted); font: 10px/1.4 var(--od-font, system-ui, sans-serif); }
    .empty { color: var(--od-muted); padding: 16px 8px; font: 12px/1.5 var(--od-font, system-ui, sans-serif); }
  `;
  private select(issue: DiagnosticIssue): void { this.dispatchEvent(new CustomEvent('issue-select', { detail: { issueId: issue.id }, bubbles: true, composed: true })); }
  render() {
    const filtered = this.issues.filter((issue) => (this.severity === 'all' || issue.severity === this.severity) && (this.status === 'all' || issue.status === this.status));
    if (!filtered.length) return html`<div class="empty">No issues match these filters.</div>`;
    return html`<div class="list">${filtered.map((issue) => html`<button class=${this.selectedId === issue.id ? 'selected' : ''} @click=${() => this.select(issue)}>
      <ol-debugger-badge .tone=${issue.severity} .label=${issue.severity}></ol-debugger-badge><strong>${issue.title}</strong>
      <small>${issue.objectLabel ?? 'Map'} · ${issue.status} · ${new Date(issue.lastSeenAt).toLocaleTimeString()}</small>
    </button>`)}</div>`;
  }
}
