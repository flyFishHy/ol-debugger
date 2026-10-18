# ol-debugger

An embeddable, local-only diagnostics panel for OpenLayers 10 applications. The panel is built with TypeScript, Lit and project-owned Web Components. It has no Web Awesome dependency.

## Install

```sh
pnpm add ol-debugger ol
```

`ol` is a peer dependency. The debugger uses the OpenLayers instance already present in the host application.

## Quick start

```ts
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { createDebugger } from 'ol-debugger';

const map = new Map({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() })],
  view: new View({ center: [0, 0], zoom: 2 }),
});

const debuggerInstance = createDebugger({ map });

// On page teardown:
debuggerInstance.destroy();
```

The debugger does not create or dispose the map, mutate layer settings, or transmit map information. Its JSON report is generated in the browser and removes URL query strings and fragments by default.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `map` | — | OpenLayers Map to inspect. |
| `target` | `document.body` | HTMLElement receiving the panel. |
| `initiallyOpen` | `true` | Whether the panel starts open. |
| `position` | `right` | Overlay edge: `left` or `right`. |
| `layout` | `overlay` | `overlay` covers the page; `embedded` fills its target. |
| `width` | `380` | Overlay panel width in pixels; must be finite and positive. |
| `zIndex` | `2147483000` | Overlay stacking order; must be finite. |
| `theme` | `dark` | `light`, `dark`, or `auto` (system preference). |
| `initialTab` | `overview` | `overview`, `layers`, or `issues`. |
| `toggleShortcut` | `false` | Optional key chord that toggles the panel, such as `Ctrl+Shift+.`. |
| `enableDiagnostics` | `true` | Enables built-in and custom diagnostic rules. |
| `autoDiagnose` | `true` | Re-runs diagnostics after observed map changes. |
| `includeResolvedIssues` | `true` | Starts the Issues view with resolved issues included. |
| `includeFullUrlsInReport` | `false` | Keeps URL query/hash in exported reports; may expose secrets. |
| `rules` | `[]` | Rules appended after built-in rules. |
| `disabledRuleIds` | `[]` | Rule IDs to disable. |
| `onError` | — | Receives internal debugger errors. |

## Controller

`open()`, `close()` and `toggle()` control the panel. `connect(map)` switches the inspected map and `disconnect()` stops observing it. `inspect()` returns the current normalized snapshot; `diagnose()` immediately refreshes it and runs rules. `getIssues()` returns copied issue data, `subscribeSnapshot()` and `subscribeIssues()` return unsubscribe functions, and `exportReport()` returns a JSON-safe report object. Call `destroy()` when the debugger is no longer needed; it is idempotent and does not dispose the host map.

To enable a document-level shortcut, pass a modifier chord such as `toggleShortcut: 'Ctrl+Shift+.'`. Supported modifier names are `Ctrl`/`Control`, `Alt`/`Option`, `Shift`, and `Meta`/`Cmd`/`Command`; one non-modifier key is required. The shortcut is disabled by default to avoid taking over host application keys. It is ignored while typing in form controls or editable content, and its listener is removed by `destroy()`. If multiple debugger instances use the same shortcut, the most recently created instance handles it; destroying that instance restores the previous handler. F12 is not registered by default because browsers commonly reserve it for developer tools.

## Included diagnostics

- Invalid map center or resolution.
- Hidden layers and groups.
- Zero effective opacity.
- Zoom and resolution range limits.
- Layer extents outside the current view.
- Explicit source load failures for supported Tile, Image and Vector source event types.
- Missing source on recognized source-backed layer classes.

The evidence and suggested checks accompany each issue. Source errors are not used to guess a root cause such as CORS or authentication failure. Unknown source types are shown with basic state and are marked as not monitored for load events.

## Development

```sh
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```

The basic demo includes a nested layer group, intentionally hidden and out-of-view layers, and loud host-page control styles to demonstrate that the panel's custom components remain scoped to their Shadow DOM.
