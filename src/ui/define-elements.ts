import { DebuggerBadge } from './components/debugger-badge.js';
import { DebuggerHeader } from './components/debugger-header.js';
import { IssueList } from './components/issue-list.js';
import { LayerTree } from './components/layer-tree.js';
import { DebuggerPanel } from './debugger-panel.js';

const definitions: Array<[string, CustomElementConstructor]> = [
  ['ol-debugger-badge', DebuggerBadge],
  ['ol-debugger-header', DebuggerHeader],
  ['ol-debugger-layer-tree', LayerTree],
  ['ol-debugger-issue-list', IssueList],
  ['ol-debugger-panel', DebuggerPanel],
];

export function defineOLDebuggerElements(): void {
  if (typeof customElements === 'undefined') throw new Error('Custom Elements are unavailable in this environment.');
  for (const [tagName, constructor] of definitions) {
    const existing = customElements.get(tagName);
    if (existing && existing !== constructor) throw new Error(`The custom element "${tagName}" is already registered by another implementation.`);
    if (!existing) customElements.define(tagName, constructor);
  }
}
