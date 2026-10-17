import { LitElement, css, html } from 'lit';
import type { DiagnosticIssue } from '../../issue/issue-types.js';

export class IssueDetailView extends LitElement {
  static properties = { issue: { attribute: false } };
  declare issue: DiagnosticIssue | undefined;
  static styles = css`
    :host { display: block; min-width: 0; }
    .ol-debugger-details { margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--ol-debugger-border); }
    .ol-debugger-section-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    h3 { margin: 18px 0 8px; color: var(--ol-debugger-muted); font: 700 11px/1.2 var(--ol-debugger-font, system-ui, sans-serif); text-transform: uppercase; }
    p, dl { color: var(--ol-debugger-text); font: 11px/1.5 var(--ol-debugger-font, system-ui, sans-serif); }
    dl { display: grid; grid-template-columns: 112px minmax(0,1fr); gap: 8px 10px; margin: 12px 0; }
    dt { color: var(--ol-debugger-muted); } dd { margin: 0; overflow-wrap: anywhere; }
    .ol-debugger-evidence { margin-top: 8px; padding: 10px; background: var(--ol-debugger-surface); border: 1px solid var(--ol-debugger-border); border-radius: 8px; }
    .ol-debugger-suggestions { margin: 8px 0 0; padding-left: 17px; color: var(--ol-debugger-muted); font: 11px/1.55 var(--ol-debugger-font, system-ui, sans-serif); }
    .ol-debugger-empty { padding: 24px 16px; color: var(--ol-debugger-muted); border: 1px dashed var(--ol-debugger-border); border-radius: 10px; text-align: center; font: 12px/1.6 var(--ol-debugger-font, system-ui, sans-serif); }
  `;
  render() {
    const issue = this.issue;
    if (!issue) return html`<div class="ol-debugger-empty">Select an issue to read its evidence and suggestions.</div>`;
    const evidence = Object.fromEntries(Object.entries(issue.evidence).filter(([, value]) => value !== undefined));
    return html`<div class="ol-debugger-details"><div class="ol-debugger-section-title"><h3>${issue.title}</h3><ol-debugger-badge .tone=${issue.severity} .label=${issue.severity}></ol-debugger-badge></div>
      <p>${issue.message}</p><dl><dt>Rule</dt><dd>${issue.ruleId}</dd><dt>Status</dt><dd>${issue.status}</dd><dt>Object</dt><dd>${issue.objectLabel ?? 'Map'} · ${issue.objectId ?? '—'}</dd><dt>First seen</dt><dd>${new Date(issue.firstSeenAt).toLocaleString()}</dd><dt>Last seen</dt><dd>${new Date(issue.lastSeenAt).toLocaleString()}</dd><dt>Resolved at</dt><dd>${issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleString() : '—'}</dd></dl>
      <h3>Evidence</h3><dl class="ol-debugger-evidence">${Object.entries(evidence).map(([key, value]) => html`<dt>${key}</dt><dd>${value === null ? 'null' : value}</dd>`)}</dl><h3>Suggestions</h3><ul class="ol-debugger-suggestions">${issue.suggestions.map((suggestion) => html`<li>${suggestion}</li>`)}</ul></div>`;
  }
}
