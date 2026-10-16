# ol-debugger 详细设计与 Codex 实施规范

> 文档类型：工程设计基线 / 可执行实施规格  
> 项目名称：`ol-debugger`  
> 文档状态：v0.1  
> 目标：Codex 可以依据本文档创建项目、实现第一版、运行测试并验证验收标准。  
> 技术栈：TypeScript + Lit + Web Components + Web Awesome + Vite + Vitest  
> GIS 核心：OpenLayers 10.x  
> 文档语言：中文；代码、公共 API、Issue code 使用英文。

---

## 0. 给 Codex 的执行说明

本文件是本项目的主要实现依据。开始编码前先检查仓库现状；如果仓库为空，按本文档创建项目。如果已有代码，先对照本文档检查差异，不要不加判断地覆盖现有实现。

### 0.1 实施规则

1. 先实现可运行、可测试的核心，再实现 UI。不要先堆完整页面。
2. TypeScript 必须开启严格模式，禁止使用 `any` 逃避类型检查。确实无法避免的第三方边界类型，需要局部注释并说明原因。
3. Core / Runtime 不得依赖 Lit、Web Awesome 或具体 UI 组件。
4. 只使用 OpenLayers 的公开 API 和公开事件，不得 monkey patch OpenLayers 原型、私有字段或渲染器内部实现。
5. 每一个自动诊断结论都必须带有规则 ID 和可解释证据。不能确认的根因必须标记为疑似或未知，不能把推测写成事实。
6. 所有监听器、订阅、`requestAnimationFrame`、`ResizeObserver`、`MutationObserver` 等资源都必须有对称清理逻辑。
7. 不允许把地图数据、要素属性、服务响应或诊断报告自动上传到任何远程服务。v0.1 完全本地运行。
8. Web Awesome 的样式不能污染宿主应用全局 CSS。必须验证主题样式可以在调试器 Shadow DOM 中生效。
9. 每完成一个阶段，运行对应的 `typecheck`、`lint`、`test` 和 `build`。不能只写代码而不验证。
10. 若第三方包导出路径或类型与本文档示例存在差异，以安装后的包实际导出和官方文档为准，修改实现并记录原因；不要猜测私有路径。
11. 优先选择简单、可读、便于扩展的实现。v0.1 不需要通用 Agent Runtime、复杂插件容器、全局事件总线或状态管理库。
12. 不要生成与本项目无关的页面、服务端、数据库或账户体系。

### 0.2 第一版完成定义

用户在一个普通 OpenLayers 10.x 页面中执行：

```ts
import { createDebugger } from 'ol-debugger';

const debuggerInstance = createDebugger({ map });
debuggerInstance.open();
```

应当看到可停靠的调试面板，并能：

- 查看地图投影、中心点、缩放级别、分辨率和视图范围。
- 查看包括嵌套 `LayerGroup` 在内的图层树。
- 选择图层并查看其核心属性和 Source 状态。
- 运行内置诊断规则，显示 Issue、证据、建议和状态。
- 在地图或图层发生变化后更新视图和 Issue。
- 导出 JSON 诊断报告。
- 调用 `destroy()` 后清理界面和所有调试器监听器。

---

# 1. 产品定位与边界

## 1.1 产品定位

`ol-debugger` 是一个可嵌入 OpenLayers 应用的开发者调试 SDK，提供地图运行状态检查、图层检查、数据源错误观测、规则诊断和问题报告。

它借鉴 OpenClaw 的模块分工与扩展思想，但不复制通用 Agent 平台：

| OpenClaw 概念 | `ol-debugger` 对应 | v0.1 处理方式 |
|---|---|---|
| Runtime | `DebuggerRuntime` | 统一协调观察、快照、诊断和 Issue 生命周期 |
| Tools | Inspectors / Snapshot Builder | 作为有明确输入输出的内部能力，不把每个函数都包装成 Tool 类 |
| Skills / Workflows | 诊断规则组合与后续诊断流程 | v0.1 只实现独立规则；以后根据真实需求增加规则组 |
| Plugins | 诊断规则注册、Source / Layer Adapter | v0.1 开放简单规则注册接口；更通用的 Adapter API 后续扩展 |
| State | Snapshot + IssueStore | 内存状态，不建设会话数据库 |
| Automation | 自动重检 | 根据 OpenLayers 事件合并刷新；不做定时任务服务 |

## 1.2 目标

- 与宿主 GIS 应用解耦，可嵌入原生 JS、Vue、React 等项目。
- 不要求宿主项目采用 Lit 或 Web Awesome。
- 使用公开 API 获取 OpenLayers 运行状态。
- 通过确定性的规则发现可验证问题。
- Issue 有稳定标识、证据、状态和恢复机制。
- UI 样式隔离，避免影响宿主页面。
- Core 可单测，规则可以扩展，报告可导出。

## 1.3 非目标

v0.1 不做：

- 完整替代 QGIS 的地图编辑器。
- 自动修复图层、修改地图业务配置或写回用户数据。
- AI 推理、MCP Server、Agent Loop、多 Agent、Prompt 管理。
- 浏览器扩展、DevTools Extension 或跨页面注入。
- 网络请求全局拦截、对 `fetch` / XHR monkey patch。
- OpenLayers 私有 Renderer 调试或像素级渲染原因定位。
- 服务端、账号、权限、云存储、远程日志。
- 全量性能分析器、FPS 计数器和内存分析器。
- 支持所有第三方自定义图层的深度检查。未知图层先展示基础信息。

---

# 2. 技术决策

## 2.1 固定技术栈

- TypeScript：严格类型。
- Lit：响应式模板和组件生命周期。
- Web Components：自定义元素交付形式。
- Web Awesome：按钮、输入框、选择器、徽标、树、对话框等 UI 控件。
- SCSS：面板布局与局部视觉细节；Lit 组件内需要的样式最终打包为 CSS。
- Vite：开发服务器、Demo 和 Library Build。
- Vitest：单元测试。
- `ol`：OpenLayers 10.x。
- pnpm：包管理器。

不要引入 Vue、React、Pinia、Redux、EventEmitter 类第三方库或额外 CSS 框架。

## 2.2 包名与自定义元素

- npm 包名：`ol-debugger`。
- 主导出函数：`createDebugger`。
- Web Component 标签：`<ol-debugger-panel>`。
- 内部子组件前缀：`ol-debugger-*`。
- CSS 类统一使用 `ol-debugger-` 前缀；设计 token 使用 `--ol-debugger-*` 前缀。

不要给包名添加组织 scope。

## 2.3 OpenLayers 版本策略

- 开发、Demo 与测试使用当前可安装的 OpenLayers `10.x` 稳定版本。
- `peerDependencies` 声明 `ol: ^10.0.0`，避免宿主项目被强制安装第二份 OpenLayers。
- `devDependencies` 中固定一个经过测试的 10.x 版本；锁文件负责精确复现。
- 不在运行时自行加载另一份 OpenLayers。
- 如果未来要支持 OpenLayers 11，另行增加兼容性工作，不在 v0.1 扩大范围。

## 2.4 UI 和 Shadow DOM 决策

- 顶层 `<ol-debugger-panel>` 使用 Lit 默认的 Open Shadow DOM。
- 面板内部 Lit 组件可继续使用 Shadow DOM。
- Web Awesome 组件也有自己的 Shadow DOM；它们的内部外观通过 Web Awesome 的 CSS 自定义属性和 `::part()` 定制，不通过普通选择器越界修改。
- Web Awesome 的主题 CSS 必须限定在 `ol-debugger-panel` 自己的 Shadow DOM 中，不得直接全局导入到宿主页面。
- 使用 Web Awesome 官方公开的组件入口，按需导入组件，不使用过时或未公开的内部路径。
- v0.1 默认深色主题；支持 `light`、`dark`、`auto` 三种配置。`auto` 监听系统主题变化并在 `destroy()` 时清理监听。

### 2.4.1 Web Awesome Shadow DOM 样式验证要求

Codex 必须先完成一个最小样式实验并在 Demo 中验证：

1. 安装 `@awesome.me/webawesome`。
2. 按官方文档导入 Web Awesome 组件模块，例如 `button`、`tree`、`tree-item`、`badge`、`input`、`select`、`option`、`dialog`。
3. 在调试器 Shadow DOM 内加载 Web Awesome 的 Default Theme 样式，推荐通过 Vite 的 CSS `?inline` 导入并在 Lit 的 `static styles` 中借助 `unsafeCSS()` 注入；最终实现需要通过实际构建验证导入路径与 CSS。
4. 在 Shadow DOM 内的根节点设置主题类，例如 `wa-theme-default wa-palette-default wa-brand-blue wa-dark`；浅色时使用相应的 `wa-light` 类。
5. 如果主题文件中仅有 `:root` 规则而没有作用于主题类的规则，要按 Web Awesome 官方主题机制补齐正确的主题样式，不得直接将 CSS 全局注入 `document`。
6. 确认 `wa-button`、`wa-tree`、`wa-badge` 在嵌入组件 Shadow DOM 后有正确的颜色、边框、字体和尺寸。
7. Demo 的 `body` 故意添加醒目的全局 `button`、`input` 样式，验证调试器不受其影响；同时确认调试器不会改变 Demo 外部按钮样式。
8. 如果 CSS `?inline` 构建方式造成外部字体或资源 URL 失效，改用构建期生成并注入 ShadowRoot 的主题 CSS 方案，或在必要时用 Web Awesome 公开的 CSS Token 自己设置面板所需 token。不得以全局污染作为默认妥协。

**验收门槛：** Web Awesome 控件主题和样式隔离测试通过，才能继续大规模编写 UI。

---

# 3. 页面与交互设计

## 3.1 面板总体布局

面板作为叠加在现有地图应用上的调试工具，不创建或控制地图本身。

默认行为：

- `target` 未指定时，把面板挂到 `document.body`，采用固定定位，默认右侧停靠。
- 默认宽度 `380px`，最小宽度 `320px`，最大宽度 `560px`。
- 默认高度为 `100dvh`，顶部和右侧间距为 `0`。
- 默认 z-index 为 `2147483000`，可由 options 覆盖。
- `initiallyOpen` 默认 `true`。
- `close()` 隐藏面板但保留 Runtime 与监听；`destroy()` 才终止监听并移除元素。
- 如果传入 `target`，默认仍采用面板自身的覆盖布局；可通过 `layout: 'overlay' | 'embedded'` 指定覆盖或作为 target 内部的普通块元素。`embedded` 模式下不使用 viewport fixed 定位。
- 不做悬浮启动按钮。v0.1 由宿主代码调用 `open()` / `close()`。

## 3.2 面板区域

顶部 Header：

- 产品名 `ol-debugger`。
- Map 连接状态：`Connected` / `Disconnected`。
- 关闭按钮。

主导航：

1. `Overview`
2. `Layers`
3. `Issues`

底部状态栏：

- 当前图层数量。
- 活跃 Issue 总数。
- 最近一次诊断时间。

## 3.3 Overview

展示只读 Map State：

- Projection Code。
- Center。
- Zoom（如果 View 尚未解析出 zoom，则显示 `—`）。
- Resolution。
- Rotation。
- View Extent。
- Map Size。
- Layer Count。
- Active Issue Count。

数字保留合理小数位，仅格式化 UI 展示值；快照保留原始数值。

## 3.4 Layers

- 使用 Web Awesome `<wa-tree>` 和 `<wa-tree-item>` 展示 `LayerGroup` 嵌套结构。
- 节点标签优先使用 `layer.get('title')`，其次 `layer.get('name')`，最后显示类型与稳定 ID。
- 展示图层类型、可见性状态标识；选中节点后在详情区查看属性。
- 默认只读，不允许用户通过调试器切换图层可见性、透明度或修改地图配置。
- 支持按名称和类型筛选（v0.1 可用简单输入框）。
- 树展开状态和选中状态属于 UI 状态，不写入 OpenLayers 图层属性。
- Web Awesome Tree 的选中事件必须按已安装版本的官方文档实现，并通过 Demo 验证事件中能正确得到图层 ID；不能依赖未验证的 `event.detail` 结构。

Layer Detail 显示：

- 稳定 ID。
- Title / Name。
- 类名（构造函数名，仅供诊断，不作为稳定标识）。
- 父节点 ID。
- Visible。
- Effective Visibility。
- Opacity。
- Effective Opacity。
- zIndex。
- Extent。
- minZoom / maxZoom。
- minResolution / maxResolution。
- Source 类型、状态、URL（如公开 API 能安全读取）。

## 3.5 Issues

Issue 列表：

- severity 筛选：error / warning / info。
- 状态筛选：active / resolved。
- 显示规则标题、对象名称、首次发现时间、最近更新时间。
- 默认按 severity（error 优先）和 `lastSeenAt` 倒序排列。

Issue 详情：

- code、severity、title、message。
- status、firstSeenAt、lastSeenAt、resolvedAt。
- 对象 ID、对象标签。
- evidence：使用可读的键值列表展示。
- suggestions：排查建议列表。
- 原始证据不允许直接以未转义 HTML 插入 DOM。

## 3.6 报告导出

提供 `Export JSON` 动作，导出当前时间的：

- Debugger 版本。
- OpenLayers 版本（如果可从包版本或构建信息可靠获取；无法可靠获取时省略，不要猜测）。
- Map Snapshot。
- Active 和 Resolved Issues。
- 用户配置的报告元数据（如有）。

导出内容必须经过 JSON 可序列化与隐私清理，不包含 Map / Layer / Source 原始对象、DOM 节点、循环引用或原始 Error 实例。

默认不导出完整服务 URL 的敏感 query 参数。URL 可以被清理为 origin + pathname；若用户需要完整地址，应在显式配置中开启，并在 API 文档中说明可能包含敏感信息。

---

# 4. 总体架构

```text
宿主 OpenLayers 应用
        |
        | ol.Map
        v
createDebugger() / <ol-debugger-panel>
        |
        v
DebuggerRuntime
        |
        +-----------------------------+
        |                             |
        v                             v
MapObserver                  SnapshotBuilder
        |                             |
        | events                      | normalized snapshot
        +-----------> Scheduler <-----+
                              |
                              v
                      DiagnosticEngine
                              |
                              v
                         IssueStore
                              |
                   snapshots/issues subscriptions
                              |
                              v
                       Lit UI Components
                              |
                              v
                   Web Awesome + scoped styles
```

## 4.1 分层原则

### Public API Layer

- 对外提供 `createDebugger()`、类型和自定义元素注册能力。
- 不暴露内部监听细节。

### Runtime Layer

- 持有当前 Map 连接状态。
- 管理 Observer、SnapshotBuilder、Scheduler、DiagnosticEngine、IssueStore。
- 向 UI 提供 `inspect()`、`diagnose()` 和订阅能力。
- 不依赖 Lit 或 Web Awesome。

### Observer Layer

- 监听 Map、View、LayerGroup Collection、Layer、Source 的公开事件。
- 合并重复刷新请求。
- 维护所有监听句柄，并统一清理。
- Observer 只告知“需要更新”，不直接渲染 UI，也不直接生成诊断文案。

### Snapshot Layer

- 将 OpenLayers 实例归一化为可序列化的纯数据快照。
- 快照内禁止保存 OpenLayers 对象、Event、DOM 或原始 Error 对象。
- 通过 ObjectIdStore 给 Map / Layer / Source 提供当前 Runtime 生命周期内稳定的 ID。

### Diagnostic Layer

- 以纯函数规则为主，根据快照和受控的 Source 事件状态生成候选 Issue。
- 单个规则失败不得阻止其他规则执行。
- 规则不直接操作 Map，不改变图层属性。

### Issue Layer

- 对诊断候选结果去重、更新、恢复，并保留内存历史。
- 负责通知 UI，而非负责展示。

### UI Layer

- Lit 只负责模板、组件状态和交互。
- Web Awesome 提供通用组件。
- UI 不自行遍历 OpenLayers 对象，不实现诊断逻辑。

---

# 5. 推荐目录结构

```text
ol-debugger/
├── docs/
│   └── design.md
├── examples/
│   └── basic/
│       ├── index.html
│       ├── main.ts
│       └── style.css
├── src/
│   ├── index.ts
│   ├── public-api.ts
│   ├── version.ts
│   ├── runtime/
│   │   ├── debugger-runtime.ts
│   │   ├── runtime-options.ts
│   │   ├── debugger-error.ts
│   │   └── refresh-scheduler.ts
│   ├── observer/
│   │   ├── map-observer.ts
│   │   ├── layer-tree-observer.ts
│   │   └── source-observer.ts
│   ├── snapshot/
│   │   ├── snapshot-builder.ts
│   │   ├── snapshot-types.ts
│   │   ├── object-id-store.ts
│   │   └── extent-utils.ts
│   ├── diagnostic/
│   │   ├── diagnostic-engine.ts
│   │   ├── diagnostic-rule.ts
│   │   ├── diagnostic-context.ts
│   │   └── rules/
│   │       ├── layer-hidden.rule.ts
│   │       ├── layer-zero-opacity.rule.ts
│   │       ├── layer-zoom-limit.rule.ts
│   │       ├── layer-resolution-limit.rule.ts
│   │       ├── layer-outside-extent.rule.ts
│   │       ├── source-error.rule.ts
│   │       └── map-view-invalid.rule.ts
│   ├── issue/
│   │   ├── issue-types.ts
│   │   ├── issue-store.ts
│   │   └── issue-identity.ts
│   ├── report/
│   │   ├── report-types.ts
│   │   ├── create-report.ts
│   │   └── sanitize-report.ts
│   └── ui/
│       ├── define-elements.ts
│       ├── debugger-panel.ts
│       ├── panel-controller.ts
│       ├── components/
│       │   ├── debugger-header.ts
│       │   ├── debugger-tabs.ts
│       │   ├── overview-view.ts
│       │   ├── layer-tree-view.ts
│       │   ├── layer-detail-view.ts
│       │   ├── issue-list-view.ts
│       │   └── issue-detail-view.ts
│       ├── styles/
│       │   ├── web-awesome-theme.ts
│       │   ├── panel-styles.ts
│       │   └── tokens.scss
│       └── ui-types.ts
├── tests/
│   ├── snapshot/
│   ├── diagnostic/
│   ├── issue/
│   ├── runtime/
│   └── ui/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.build.json
├── vite.config.ts
├── vitest.config.ts
├── eslint.config.js
├── .gitignore
├── README.md
└── CHANGELOG.md
```

不要为了“看起来架构完整”而提前创建空的 Plugin、Agent、MCP 或 AI 文件夹。

---

# 6. 工程脚手架与包配置

## 6.1 必须提供的脚本

`package.json` 至少包含：

```json
{
  "name": "ol-debugger",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.build.json && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

Codex 可根据实际 Vite Library Mode 配置调整命令，但上述命令必须真实可运行。

## 6.2 依赖

运行时依赖：

- `lit`
- `@awesome.me/webawesome`

Peer dependency：

- `ol: ^10.0.0`

开发依赖至少包括：

- `typescript`
- `vite`
- `sass`（Vite 处理 SCSS）
- `vitest`
- `jsdom`
- `@types/node`（如配置需要）
- `eslint` 和 TypeScript ESLint 配套依赖

可以根据 Lit / Web Awesome / Vite 当前稳定版本选择兼容版本并写入锁文件。不要把 `ol` 打包成库的第二份运行时依赖；Vite Library Mode 中应 externalize `ol` 及其子路径，并正确 externalize peer 依赖。

## 6.3 TypeScript

要求：

- `strict: true`
- `noUncheckedIndexedAccess: true`（可在解决合理类型问题后开启）
- `useDefineForClassFields: true`
- `moduleResolution: "Bundler"`
- `target` 选择现代浏览器支持的 ES 版本。
- UI 使用标准 TypeScript，不强制使用实验性 decorators。优先用 `static properties` 声明 Lit 属性，减少 TS decorator 配置复杂度。

## 6.4 构建输出

包至少提供：

- `dist/index.js`
- `dist/index.d.ts` 或同等可被 TypeScript 消费的声明文件。
- 需要的主题 CSS 资产（如果使用独立 CSS URL 方式）。

`package.json` 设置合理的 `main`、`module`、`types`、`exports`、`files`。在构建后用一个外部示例验证 `import { createDebugger } from 'ol-debugger'` 能运行。

## 6.5 Library + Demo

同一个仓库同时提供 npm 包构建和 `examples/basic` Demo。Demo 由 Vite 提供，不属于发布包的核心运行时入口。

Demo 至少包含：

- OSM 底图。
- 一组 VectorLayer 或 TileLayer 示例。
- 一个嵌套 LayerGroup。
- 一个可被切换成不可见的图层。
- 一个故意配置到当前视图之外的图层。
- 一个可供测试 source error 处理的可控示例（不要依赖真实坏 URL 才能稳定测试）。
- `createDebugger({ map })` 的实际集成。

---

# 7. 公共 API

## 7.1 使用方式

```ts
import Map from 'ol/Map.js';
import { createDebugger } from 'ol-debugger';

const map = new Map({ /* 宿主应用已有配置 */ });

const debuggerInstance = createDebugger({
  map,
  initiallyOpen: true,
  position: 'right',
  width: 380,
  theme: 'dark',
});

// 面板生命周期
debuggerInstance.open();
debuggerInstance.close();
debuggerInstance.toggle();

// 可手动触发检查
const snapshot = debuggerInstance.inspect();
const issues = debuggerInstance.diagnose();
const report = debuggerInstance.exportReport();

// 页面卸载时
debuggerInstance.destroy();
```

`map` 不由 debugger 创建或销毁。`destroy()` 只清理 debugger 本身，不得调用 `map.dispose()`，不得删除宿主图层或更改地图设置。

## 7.2 `createDebugger()` 内部流程

工厂负责组装对象，不承担诊断细节。严格按以下顺序实现：

1. 校验 options：`width` 必须为有限正数；`zIndex` 必须为有限数值；不满足要求时抛出 `DebuggerError`，错误码为 `INVALID_OPTIONS`。
2. 调用 `defineOLDebuggerElements()`。
3. 创建一个独立 `DebuggerRuntime`，将规则配置、`autoDiagnose`、`onError` 等传入 Runtime。
4. 创建 `<ol-debugger-panel>` 元素，并通过内部 ViewModel 属性连接 UI 与 Runtime。
5. 将 width、z-index、position、layout、theme、initialTab 等 UI 配置传给面板。
6. 将元素 append 到 `target ?? document.body`。
7. 若 options.map 存在，调用 Runtime `connect(map)`。
8. 根据 `initiallyOpen` 设置打开状态。
9. 返回 `DebuggerController` 实现，所有公开操作委托给 Runtime / 面板。

`destroy()` 的执行顺序：先解除 UI 对 Runtime 的订阅，再销毁 Runtime（解除 OpenLayers 监听、调度器和 Store 订阅），最后从 DOM 移除面板。流程必须幂等。

## 7.3 DebuggerOptions

实现以下公开类型，字段命名保持一致：

```ts
import type Map from 'ol/Map.js';
import type { DiagnosticRule } from './diagnostic/diagnostic-rule.js';
import type { DebuggerError } from './runtime/debugger-error.js';

export type DebuggerTheme = 'light' | 'dark' | 'auto';
export type DebuggerPosition = 'left' | 'right';
export type DebuggerLayout = 'overlay' | 'embedded';
export type DebuggerTab = 'overview' | 'layers' | 'issues';

export interface DebuggerOptions {
  map?: Map;
  target?: HTMLElement;
  initiallyOpen?: boolean;
  position?: DebuggerPosition;
  layout?: DebuggerLayout;
  width?: number;
  zIndex?: number;
  theme?: DebuggerTheme;
  initialTab?: DebuggerTab;
  enableDiagnostics?: boolean;
  autoDiagnose?: boolean;
  includeResolvedIssues?: boolean;
  /** 默认 false。开启后报告可包含完整 URL，可能泄漏 token 等敏感信息。 */
  includeFullUrlsInReport?: boolean;
  /** 自定义诊断规则，追加到默认规则之后执行。 */
  rules?: DiagnosticRule[];
  /** 禁用指定的默认规则或自定义规则 ID。 */
  disabledRuleIds?: string[];
  /** 用于接收内部异常；不能让回调抛错破坏 Runtime。 */
  onError?: (error: DebuggerError) => void;
}
```

默认值：

- `initiallyOpen: true`
- `position: 'right'`
- `layout: 'overlay'`
- `width: 380`
- `zIndex: 2147483000`
- `theme: 'dark'`
- `initialTab: 'overview'`
- `enableDiagnostics: true`
- `autoDiagnose: true`
- `includeResolvedIssues: true`
- `includeFullUrlsInReport: false`

`target` 未传入时 append 到 `document.body`。若用户指定 `target`，将其作为容器使用；若未连接到 DOM，仍可创建实例，等 target / element 接入 DOM 后由 Lit 正常渲染。`target` 在 v0.1 限定为 HTMLElement，不接受 selector 字符串，避免选择器无法命中时出现含糊行为。

## 7.4 DebuggerController

`createDebugger` 返回的公开控制对象：

```ts
export interface DebuggerController {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  toggle(): void;
  connect(map: Map): void;
  disconnect(): void;
  inspect(): DebugSnapshot | undefined;
  diagnose(): DiagnosticIssue[];
  getIssues(options?: IssueQueryOptions): DiagnosticIssue[];
  exportReport(): DebugReport;
  subscribeSnapshot(listener: (snapshot: DebugSnapshot) => void): () => void;
  subscribeIssues(listener: (issues: DiagnosticIssue[]) => void): () => void;
  destroy(): void;
}
```

说明：

- `inspect()` 返回最新缓存的快照；没有连接 Map 时返回 `undefined`。
- `diagnose()` 强制重新获取快照并执行一次全量诊断，返回当前 Issue 列表（active + resolved，按默认排序）。
- `getIssues()` 返回快照副本，不暴露内部数组引用。
- `subscribeSnapshot()` 和 `subscribeIssues()` 返回 unsubscribe 函数。
- `disconnect()` 清理当前 Map 相关监听并清除 `map` 连接状态，但不销毁 UI；面板显示空状态。
- `connect(map)` 可切换 Map，必须先清理旧 Map 的所有监听。
- `destroy()` 幂等，多次调用没有副作用。
- 调用 `destroy()` 后，`open()`、`close()`、`toggle()`、`connect()`、`disconnect()` 等修改状态的方法一律抛出 `DebuggerError`，错误码为 `INSTANCE_DESTROYED`；`destroy()` 自身幂等。`inspect()` 返回 `undefined`，`getIssues()` 返回空数组。

## 7.5 注册 Web Component

公开导出：

```ts
export function defineOLDebuggerElements(): void;
```

- `createDebugger()` 内部自动调用 `defineOLDebuggerElements()`。
- 注册前检查 `customElements.get(tagName)`，避免重复定义。
- `<ol-debugger-panel>` 是底层 Web Component；v0.1 推荐且完整支持的集成入口是 `createDebugger()`，因为它会同时创建 Runtime、注入 View Model、挂载元素并返回控制器。
- 不支持通过 HTML attribute 传递 Map；Map 是运行时对象。
- 面板元素由工厂通过内部属性接收 Runtime / View Model；这些内部属性不作为稳定公共 API。
- 高级用户可调用 `defineOLDebuggerElements()` 提前注册标签，但要让面板正常工作仍应通过公开工厂挂载，不承诺无控制器的裸标签自动建立 Runtime。
- `customElements.define()` 只能对同名元素执行一次；若已存在同名但非本包的元素，不能覆盖它，应抛出具有清楚信息的错误。

---

## 7.6 根入口导出约定

`src/index.ts` 是唯一公开包入口。至少导出：

```ts
export { createDebugger } from './public-api.js';
export { defineOLDebuggerElements } from './ui/define-elements.js';
export { DebuggerError } from './runtime/debugger-error.js';
export type {
  DebuggerController,
  DebuggerOptions,
  DebuggerTheme,
  DebuggerPosition,
  DebuggerLayout,
  DebuggerTab,
} from './public-api.js';
export type { DebugSnapshot, MapSnapshot, LayerSnapshot, SourceSnapshot } from './snapshot/snapshot-types.js';
export type { DiagnosticIssue, IssueQueryOptions, IssueSeverity, IssueStatus } from './issue/issue-types.js';
export type { DiagnosticRule, DiagnosticIssueCandidate, DiagnosticContext } from './diagnostic/diagnostic-rule.js';
export type { DebugReport } from './report/report-types.js';
```

根据实际模块拆分可调整 type export 的来源文件，但对外命名保持稳定。内部 Runtime、Observer 与 ObjectIdStore 默认不公开，避免过早承诺内部 API 稳定性。

---

# 8. 核心数据模型

所有 Snapshot / Issue / Report 类型均为纯数据，必须能够 JSON 序列化。禁止把 OpenLayers 实例或 DOM 对象放入其中。

## 8.1 Map Snapshot

```ts
export interface MapSnapshot {
  projectionCode?: string;
  center?: number[];
  zoom?: number;
  resolution?: number;
  rotation?: number;
  size?: [number, number];
  viewExtent?: [number, number, number, number];
  capturedAt: number;
}
```

说明：

- `center` 复制数组，不能直接返回 View 内部数组引用。
- `viewExtent` 由 `view.calculateExtent(size)` 计算；size 不存在或无效时省略。
- `zoom` 可能为 `undefined`，不要默认填 0。
- 无效数字不可直接输出为 `NaN` 或 `Infinity`；对 JSON 报告应归一化为 `undefined` 或 `null`。类型与 UI 展示要一致。

## 8.2 Layer Snapshot

```ts
export type LayerKind = 'group' | 'layer' | 'unknown';

export interface LayerSnapshot {
  id: string;
  parentId?: string;
  index: number;
  title: string;
  kind: LayerKind;
  className: string;
  visible: boolean;
  effectivelyVisible: boolean;
  opacity: number;
  effectiveOpacity: number;
  zIndex?: number;
  minZoom?: number;
  maxZoom?: number;
  minResolution?: number;
  maxResolution?: number;
  extent?: [number, number, number, number];
  source?: SourceSnapshot;
  childIds: string[];
}
```

说明：

- `id` 在 Runtime 生命周期内稳定；不能依赖 `layer.get('id')`，因为应用不一定提供且可能重复。
- `index` 保存该节点在所属 Collection 中的原始位置。UI 可选择从上到下显示，但不能丢失原始 index。
- `title` 解析顺序：非空 `layer.get('title')` → 非空 `layer.get('name')` → `${className} (${id})`。
- `className` 用构造函数名做辅助识别，不作为稳定协议。
- `kind` 判断顺序：`LayerGroup` → 普通 `Layer` → `unknown`。
- 对标准 `LayerGroup` 递归获取孩子；对未知自定义 `BaseLayer` 仍需显示基础属性，不得让快照构建失败。
- `visible` 表示该图层自身 visible 属性。
- `effectivelyVisible` 表示自身和祖先的 visible 值都为 true；暂不表示实际像素已渲染。
- `effectiveOpacity` 是本节点与所有祖先节点 opacity 的乘积。
- `minZoom` / `maxZoom` / `minResolution` / `maxResolution` 读取公开 getter；代表无约束的默认值（如 `-Infinity`、`Infinity` 或默认 `0` 下限）归一化为 `undefined`，UI 显示 `No limit`，保证 Snapshot 不包含非有限数值。
- 对 `LayerGroup` 不创建虚构 Source。
- `childIds` 只包含直接孩子；完整列表由 `layers` 数组表达。

## 8.3 Source Snapshot

```ts
export type SourceState = 'undefined' | 'loading' | 'ready' | 'error' | 'unknown';

export interface SourceErrorSnapshot {
  eventName: string;
  message?: string;
  occurredAt: number;
}

export interface SourceSnapshot {
  id: string;
  type: string;
  state: SourceState;
  url?: string;
  lastError?: SourceErrorSnapshot;
  lastSuccessAt?: number;
  activeLoadCount: number;
}
```

说明：

- 对标准 `Layer`，通过 `getSource()` 读取 Source。
- `type` 优先识别可支持的标准 Source 类，否则使用构造函数名。
- `url` 只有在公开 API 可可靠读到字符串时才记录；不猜测私有字段。
- 错误信息仅保存 `Error.message` 或安全字符串，不能把原始事件 / Error 对象存进 Snapshot。
- Source 网络错误事件因具体 Source 类型不同而异，必须通过受控监听的事件适配层记录，不得假设所有 Source 都会派发相同的 `error` 事件。
- `activeLoadCount` 只能基于已明确支持的 start/end/error 事件维护；未知 Source 固定显示未知或 0，并在内部注明该 Source 未被加载事件监控适配器覆盖，不能把 0 解释为从未加载。

## 8.4 全量快照

```ts
export interface DebugSnapshot {
  revision: number;
  capturedAt: number;
  map: MapSnapshot;
  layers: LayerSnapshot[];
  sourceEvents: Record<string, SourceSnapshot>;
}
```

- `layers` 是扁平数组，每一项通过 `parentId` / `childIds` 表达树形结构。
- `revision` 在每次产生新快照时递增。
- `sourceEvents` 使用 Source ID 索引，值为脱离真实 Source 对象的纯数据。

---

# 9. Object ID 与快照构建

## 9.1 ObjectIdStore

作用：为当前 Runtime 中的 Map / Layer / Source 实例分配稳定 ID。

要求：

- 使用 `WeakMap<object, string>` 记录对象到 ID 的关系。
- 使用当前活动对象的 Map 作为 ID 反查对象的索引；图层或 Source 从当前地图移除后，要从活动索引中移除强引用，避免调试器保留已经移除的对象。
- ID 只保证当前 Runtime 生命周期内稳定，不保证刷新页面后稳定。
- ID 形式可采用 `map-1`、`layer-2`、`source-3`，各对象类别独立计数。
- 不要把业务自定义 `id` 当作主 ID；可以作为额外属性展示。

## 9.2 SnapshotBuilder

输入：`Map`、`ObjectIdStore`、SourceObserver 状态。

输出：`DebugSnapshot`。

步骤：

1. 获取 Map 的 View、Projection、Center、Zoom、Resolution、Rotation、Size。
2. 若 size 和 view 可计算，计算当前 map extent。
3. 从 `map.getLayerGroup()` 开始遍历，而不是仅遍历 `map.getLayers()`，以支持整个层组树。
4. 为每个 Layer / LayerGroup 构建 `LayerSnapshot`。
5. 递归维护父 visible 与父 opacity，计算 `effectivelyVisible`、`effectiveOpacity`。
6. 对支持 `getSource()` 的普通 Layer 读取 Source 快照；Group 不输出 Source。
7. 返回新对象和新数组，不暴露 OpenLayers 内部可变数组引用。
8. 跳过不可读的可选属性并记录内部错误；一个异常图层不能令整个快照失败。快照根对象读取失败时，才向 Runtime 抛出 `DebuggerError`。

## 9.3 范围相交工具

实现独立纯函数：

```ts
export type Extent = [number, number, number, number];
export function intersectsExtent(a: Extent, b: Extent): boolean;
```

使用 inclusive 边界检查；若边缘刚好接触，按相交处理。函数必须检查输入是有限数值且满足 `minX <= maxX`、`minY <= maxY`。非法输入返回 false 或由调用方跳过规则，行为须明确并测试。

---

# 10. Observer 与调度

## 10.1 总原则

Observer 只收集事件和触发刷新，不执行 UI 更新，也不直接判断 Issue。

- 所有 OpenLayers 监听都用 OpenLayers `on()` 返回的事件 key，并通过 `unByKey()` 清理；若某监听 API 返回其他清理函数，统一包装成 disposer。
- `MapObserver` 对外提供 `start(map)`、`stop()` 和 `onChange(callback)`。
- `start()` 多次调用前应清理旧连接，不能重复注册监听。
- Observer 不在事件回调中同步遍历全部图层；事件回调只请求 Scheduler 排队刷新。

## 10.2 MapObserver 监听

需要监听的公开事件：

- Map `change:view`：替换 View 时重新绑定 View 监听。
- Map `change:layerGroup`：替换根图层组时重建 Collection / Layer 监听。
- Map `change:size`：地图尺寸变化时更新 view extent。
- Map `moveend`：移动结束后更新视图状态并执行诊断。
- View `change:center`、`change:resolution`、`change:rotation`（若这些事件类型在当前 OpenLayers 类型中可用）：用于地图视图变化；可与 `moveend` 合并刷新，避免高频执行完整诊断。

需要注意：OpenLayers 事件名必须以当前所用 10.x 公开 API 和类型声明为准。不可凭经验添加不存在的事件。

## 10.3 图层 Collection 监听

- 递归遍历每个 `LayerGroup.getLayers()` 返回的 Collection。
- 监听 Collection 的 `add` 和 `remove` 事件。
- 图层增删后重建受影响的监听树、清理已移除对象的 Source 订阅，并排队生成快照。
- 根层组被替换后，先停止所有旧 Collection / Layer / Source 监听再建立新监听。
- 使用 Set / Map 管理 disposer，保证一个图层不会被重复绑定多个相同监听。

## 10.4 图层属性监听

为每个当前活动图层监听公开属性事件：

- `change:visible`
- `change:opacity`
- `change:zIndex`
- `change:extent`
- `change:minZoom`
- `change:maxZoom`
- `change:minResolution`
- `change:maxResolution`

另可监听 Layer 的通用 `change` 事件，用于发现 `getSource()` 返回对象发生替换；但通用 `change` 不能无条件触发全量快照。回调先比较当前 Source 引用与记录的 Source 引用：只有引用变化时才重新绑定 Source 并请求刷新。Source 自身变化常会触发 Layer change，不能因此造成无限刷新循环。

## 10.5 Source 监听

v0.1 至少支持：

1. 读取 `source.getState()`（如果该 Source 提供该公开能力）。
2. 监听 Source `change`，状态或公开属性变化时更新快照。
3. 对已确认支持对应事件的标准 Source，记录以下加载事件：
   - Tile Source：`tileloadstart`、`tileloadend`、`tileloaderror`。
   - Image Source：`imageloadstart`、`imageloadend`、`imageloaderror`。
   - Vector Source：`featuresloadstart`、`featuresloadend`、`featuresloaderror`。
4. 不要把某个 Source 类未派发的事件解读成没有错误。
5. 支持未知 Source 的降级：只读取可访问的基础状态，UI 显示 `Load events not monitored` 或等价提示。
6. 每个 Source 的事件监听都与当前活动图层生命周期绑定；Source 被替换或所有引用它的当前图层被移除时，释放相应订阅。
7. 同一个 Source 可能被多个 Layer 共享：SourceObserver 应按 Source ID 复用一份监控状态，并使用引用计数或活动关联集合，避免重复监听。
8. 加载计数不能降到负数；遇到异常的 end/error 顺序时要保护计数并记录内部警告。

## 10.6 RefreshScheduler

目的：合并一轮事件导致的重复 refresh。

v0.1 策略：

- 事件回调调用 `scheduleRefresh(reason)`。
- 使用单个 `requestAnimationFrame` 或 microtask 合并同一帧请求；考虑测试环境与不支持 rAF 的环境，封装调度器。
- 默认对视图变化采用 `moveend` 更新；不要对每个 `pointermove` 执行快照与诊断。
- 图层增删和关键属性变化需要快速反馈，可以在下一帧刷新。
- 刷新流程顺序固定：同步 ObjectIdStore / Observer 绑定 → 构建 Snapshot → 通知快照订阅 → 若 `autoDiagnose` 开启则执行诊断 → 更新 IssueStore → 通知 Issue 订阅。
- `destroy()` / `disconnect()` 必须取消未执行的调度任务。
- 禁止采用无条件的高频 `setInterval` 遍历地图。

---

# 11. Diagnostic Engine

## 11.1 规则接口

```ts
import type { DebugSnapshot } from '../snapshot/snapshot-types.js';
import type { DiagnosticIssueCandidate } from '../issue/issue-types.js';

export interface DiagnosticRule {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly defaultSeverity: 'error' | 'warning' | 'info';
  run(snapshot: DebugSnapshot, context: DiagnosticContext): DiagnosticIssueCandidate[];
}

export interface DiagnosticContext {
  now(): number;
  getLayer(id: string): DebugSnapshot['layers'][number] | undefined;
}
```

规则要求：

- `id` 全局唯一、稳定，例如 `layer.visibility-disabled`。
- 规则函数尽量为纯函数，不订阅事件，不访问 Map / DOM，不修改输入快照。
- 规则返回候选 Issue，不生成首次/最近发现时间；时间与状态由 IssueStore 管理。
- 规则抛错时 Engine 捕获、记录 `onError` 并继续执行其他规则。
- 规则输出必须包括确定性的 `fingerprint` 或可由系统计算的稳定 identity key。
- 规则只接收规范化 Snapshot，不直接访问私有渲染器或 Source 内部字段。

## 11.2 Candidate Issue 类型

```ts
export type IssueSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticIssueCandidate {
  ruleId: string;
  fingerprint: string;
  severity: IssueSeverity;
  title: string;
  message: string;
  objectId?: string;
  objectLabel?: string;
  evidence: Record<string, string | number | boolean | null | undefined>;
  suggestions: string[];
}
```

`fingerprint` 仅使用与该问题身份相关的短字符串，例如 `zoom-limit` 或 `source-event:tileloaderror`，不要把完整原始数据放入 fingerprint。

## 11.3 v0.1 内置规则

首版至少实现以下规则。规则 ID 不可随意更改，因为它们会出现在报告与下游自动化中。

### Rule A: `map.view-invalid`

Severity：`error`。

检测：

- 已连接 Map，但视图的 `resolution` 明确为非有限数值或小于等于 0。
- Center 中任一坐标为非有限数值。

注意：View 在初始化/解析期间可能暂时没有 Center 或 Zoom。`undefined` 不等于无效，不得误报；此时跳过对应子检查。

Evidence：`resolution`、`center`、`projectionCode`。

### Rule B: `layer.visibility-disabled`

Severity：`warning`。

检测：某个非 Group Layer 的 `visible === false`。

- 对显式不可见的普通图层生成一个 Issue。
- 对不可见的 LayerGroup，使用同一规则在组节点生成一个 Issue，evidence 中包含受影响后代数量。
- 当某个祖先组已经不可见时，不要再为每个后代重复生成相同含义的 Issue。
- 消息明确说明是“自身被设置为不可见”还是“被某个祖先组隐藏”。

Evidence：`visible`、`parentId`、`effectivelyVisible`、`affectedDescendantCount`（如适用）。

### Rule C: `layer.opacity-zero`

Severity：`warning`。

检测：自身或祖先组的 opacity 为 0，导致有效透明度为 0。

- 只报告最上层导致 `effectiveOpacity === 0` 的节点，避免后代重复 Issue。
- 对非零但较低透明度不自动报告，除非以后新增可配置阈值规则。

Evidence：`opacity`、`effectiveOpacity`、`parentId`。

### Rule D: `layer.zoom-limit`

Severity：`info`。

检测：当前 View 的 zoom 已知，且不满足 OpenLayers 图层 zoom 边界。

按 OpenLayers 公开文档所定义的边界处理：minZoom 是下界（图层需高于它才满足可见条件），maxZoom 是上界且包含边界。规则使用 `zoom <= (minZoom ?? -Infinity) || zoom > (maxZoom ?? Infinity)` 判断越界。Snapshot 中不保存正负无穷，而用 `undefined` 表示无限制。

如果 zoom 为 undefined，跳过，不报错。

Evidence：`zoom`、`minZoom`、`maxZoom`。

### Rule E: `layer.resolution-limit`

Severity：`info`。

检测：当前 resolution 与图层范围限制不匹配。按照 OpenLayers 定义，图层的 minResolution 为包含边界的下界，maxResolution 为不包含边界的上界，因此越界条件是 `resolution < (minResolution ?? 0) || resolution >= (maxResolution ?? Infinity)`。Snapshot 中 `undefined` 表示没有该方向的限制。

如果 resolution 未知或非法，跳过此规则，由 `map.view-invalid` 负责可确认的非法值。

Evidence：`resolution`、`minResolution`、`maxResolution`。

### Rule F: `layer.outside-extent`

Severity：`warning`。

检测：图层自身 extent 与当前地图 View extent 明确不相交。

- 任一 extent 缺失时跳过。
- View size 无效、extent 计算失败或坐标不是有限数值时跳过，不误报。
- 只有在二者位于同一投影/坐标空间且 extent 合法时才比较；v0.1 按 OpenLayers Layer extent 在当前地图视图所使用的坐标空间进行比较，不尝试推断外部 GeoJSON 的真实 CRS。
- LayerGroup 不单独创建 extent Issue，除非它自己显式设置了 extent；如果组 extent 不相交，可以在组节点报告并避免给每个后代重复报告。

Evidence：`mapExtent`、`layerExtent`、`projectionCode`。

### Rule G: `source.load-error`

Severity：`error`。

检测：

- Source 的 `getState()` 为 `error`；或
- 对支持的 Source 适配器收到了明确的 load error event，并且该 Source 的最后一次错误尚未被适配器定义的恢复条件清除。

要求：

- Source 网络加载 error 只证明一次加载错误，不直接推断是 URL 错、跨域、认证失败还是服务端错误。
- `message` 和 `suggestions` 必须按“检查请求地址、网络面板、服务端响应、认证与 CORS 配置”等排查方向表达，不声称已定位根因。
- Evidence 至少包含 `sourceId`、`sourceType`、`state` 或 `eventName`、`occurredAt`。
- 下一次匹配的成功加载事件可清除对应的最近错误标记；必须在规则文档中明确这只表示后续出现了成功加载事件，不代表所有瓦片/要素加载均成功。
- 如果 Source 类型无法可靠判断加载成功/失败事件，不能伪造错误状态。

### Rule H: `layer.source-unavailable`

Severity：`warning`。

检测：支持 `getSource()` 的普通 Layer 当前返回 `null`，并且该图层类型按它的公开接口应具有 Source。

不要对自定义未知 `BaseLayer` 盲目生成该 Issue。只针对能确定是 Source-backed `Layer` 的标准类型报告。

Evidence：`layerId`、`layerClass`。

## 11.4 规则执行与排序

- 默认规则列表由 `createDefaultRules()` 生成。
- `DebuggerOptions` 可提供 `rules?: DiagnosticRule[]` 来追加自定义规则；如果需要禁用默认规则，可增加 `disabledRuleIds?: string[]`。实现之前要将两者写入公开类型和 README，不能出现未文档化行为。
- v0.1 默认：默认规则 + 用户追加规则；通过 `disabledRuleIds` 屏蔽指定规则。
- 按 severity 排序：error → warning → info；同级按 `lastSeenAt` 倒序。
- 每轮完整诊断都执行所有当前启用规则，不做复杂的依赖图或增量规则调度。
- 规则运行失败被记录为 `DebuggerError` 的 `ruleId` 上下文，不作为地图 Issue 显示，以免混淆“地图问题”和“调试器自身问题”。

---

# 12. Issue 生命周期与去重

## 12.1 Issue 类型

```ts
export type IssueStatus = 'active' | 'resolved';

export interface DiagnosticIssue {
  id: string;
  ruleId: string;
  fingerprint: string;
  severity: IssueSeverity;
  title: string;
  message: string;
  objectId?: string;
  objectLabel?: string;
  evidence: Record<string, string | number | boolean | null | undefined>;
  suggestions: string[];
  status: IssueStatus;
  firstSeenAt: number;
  lastSeenAt: number;
  resolvedAt?: number;
}
```

## 12.2 稳定 ID

Issue ID 使用 `${ruleId}:${objectId ?? 'map'}:${fingerprint}` 的稳定组合。对需要多个同类事件区分的规则，fingerprint 中加入经清理的事件类型，但禁止放 URL token、完整异常文本或其他可能泄露敏感信息的值。

## 12.3 Reconcile 规则

每一轮完整诊断：

1. 对每条候选 Issue 计算稳定 ID。
2. 如果 ID 不存在，创建 active Issue，并设置 `firstSeenAt`、`lastSeenAt`。
3. 如果 ID 已存在，更新标题、消息、证据、建议和 severity；设置 status 为 active、更新 `lastSeenAt`、清空 `resolvedAt`，保留原 `firstSeenAt`。
4. 本轮规则运行成功且没有再次产生的 active Issue，转成 resolved，并设置 `resolvedAt`。
5. 如果个别规则运行失败，则不能把该规则上一次产生的 Issue 批量 resolve；该规则这一轮的状态视为 unknown，保留既有结果并记录内部错误。
6. 使用 `includeResolvedIssues` 控制 UI 默认是否显示 resolved，但 Store 保留历史，直至实例销毁。
7. 同一 Issue 长期 active 不因每帧重复刷新而不断累加 occurrences；v0.1 不提供 occurrences 字段。

## 12.4 IssueStore API

建议实现：

```ts
export interface IssueQueryOptions {
  status?: 'active' | 'resolved' | 'all';
  severity?: IssueSeverity | IssueSeverity[];
  objectId?: string;
}

export interface IssueStore {
  reconcile(candidates: DiagnosticIssueCandidate[], successfulRuleIds: Set<string>): void;
  resolveAllActive(): void;
  list(options?: IssueQueryOptions): DiagnosticIssue[];
  get(id: string): DiagnosticIssue | undefined;
  subscribe(listener: (issues: DiagnosticIssue[]) => void): () => void;
  clearResolved(): void;
  clear(): void;
  destroy(): void;
}
```

如果此接口根据实现更适合使用具体 class，可以导出 `IssueStore` class；若不对外公开也可以保持内部模块，但对内行为必须一致。`resolveAllActive()` 在 `disconnect()` 时将全部 active Issue 标记为 resolved。UI 订阅得到的数据必须是复制后的数组与 Issue 对象，避免消费者意外修改内部状态。

---

# 13. DebuggerRuntime

## 13.1 职责

`DebuggerRuntime` 是诊断框架核心，不是 AI Agent。

负责：

- connect / disconnect Map。
- 生命周期管理。
- 调度刷新。
- 持有 SnapshotBuilder、Observer、DiagnosticEngine、IssueStore。
- 处理自动诊断和手动诊断。
- 提供 snapshot / issue subscriptions。
- 隔离内部模块异常。

## 13.2 内部状态

- `map?: Map`
- `latestSnapshot?: DebugSnapshot`
- `destroyed: boolean`
- `snapshotRevision: number`
- Observer 和 Scheduler 实例。
- `IssueStore` 实例。

不要把 Runtime 做成全局单例。页面可同时有多个 Map 与多个 debugger 实例；每个 `createDebugger()` 都创建独立 Runtime。

## 13.3 处理流程

连接 Map：

1. 如果已连接其他 Map，执行内部 disconnect。
2. 设置 Map。
3. 同步图层树和 Source 观察者。
4. 立即构建一次 Snapshot。
5. 通知 snapshot subscriber。
6. 如果 `autoDiagnose` 开启，运行一次完整诊断。
7. UI 显示 Connected。

自动刷新：

1. Observer 请求 Scheduler refresh。
2. Scheduler 合并同一批次事件。
3. 同步 Layer / Source subscriptions。
4. 构建 Snapshot 并递增 revision。
5. 通知 snapshot subscriber。
6. 若启用自动诊断则运行诊断。
7. Reconcile IssueStore 并通知 issue subscriber。

手动 `diagnose()`：

- 即使 `autoDiagnose === false`，也必须立即新建快照并运行诊断。
- 返回 IssueStore 完整列表副本。

断开连接：

- 清理 Map / View / Collection / Layer / Source 所有监听。
- 取消未执行刷新任务。
- 清掉当前连接引用与活动对象反查索引。
- v0.1 在 `disconnect()` 后将已有 active Issue 标记 resolved，`objectLabel` 与 evidence 留在内存中用于历史查看；Snapshot 变为 `undefined`。
- UI 显示 disconnected 空状态。

销毁：

- disconnect。
- dispose Scheduler。
- 清理 Runtime subscriptions。
- 销毁 IssueStore。
- 不触碰宿主 Map。

---

# 14. UI 组件设计（Lit）

## 14.1 组件职责

### `ol-debugger-panel`

- 主入口组件。
- 持有顶层 UI 状态：activeTab、selectedLayerId、selectedIssueId、filters、theme、width。
- 接收 JS 属性 `map` 或由 `createDebugger()` 注入 Controller / view model。
- 不直接构建快照、不执行规则。
- 订阅 Runtime，断开订阅时清理所有 unsubscribe 函数。

### `ol-debugger-header`

- 标题、连接状态、关闭动作。
- 不保留 Map / Runtime 引用。

### `ol-debugger-tabs`

- Overview / Layers / Issues 三个标签。
- 可使用语义明确的原生 button + ARIA tabs 属性。不要为了所有小控件都使用 Web Awesome 而降低可访问性。

### `ol-debugger-overview`

- 只接收 `MapSnapshot` 和数量信息。
- 不访问 Map。

### `ol-debugger-layer-tree`

- 只接收 `LayerSnapshot[]` 和 `selectedLayerId`。
- 发出 `layer-select` 自定义事件，detail 为 `{ layerId: string }`。
- 使用 Web Awesome Tree；选中机制需要按当前 Web Awesome 版本做兼容验证。

### `ol-debugger-layer-detail`

- 只接收已选择的 `LayerSnapshot`。
- 不允许直接修改真实图层。

### `ol-debugger-issue-list`

- 接收 Issue 数组和筛选配置。
- 发出 `issue-select`，detail 为 `{ issueId: string }`。

### `ol-debugger-issue-detail`

- 只展示一个 Issue。
- 使用 Web Awesome Badge / Dialog（确有弹出需求时）和可读的证据列表。

## 14.2 UI ViewModel Contract

主面板通过一个只读的 ViewModel 与 Runtime 通信，不直接持有 OpenLayers 事件 key。接口放在 `ui/ui-types.ts`，只作为 UI 内部契约，不要求对外导出：

```ts
export interface DebuggerViewModel {
  isConnected(): boolean;
  getSnapshot(): DebugSnapshot | undefined;
  getIssues(options?: IssueQueryOptions): DiagnosticIssue[];
  diagnose(): DiagnosticIssue[];
  subscribeSnapshot(listener: (snapshot: DebugSnapshot) => void): () => void;
  subscribeIssues(listener: (issues: DiagnosticIssue[]) => void): () => void;
}
```

`DebuggerRuntime` 通过适配器提供此接口。面板在 `connectedCallback()` / 首次更新后订阅；在 `disconnectedCallback()` 解除 UI 订阅；再次进入 DOM 时可以重新订阅。面板移除 DOM 不等于销毁 Runtime，最终生命周期由 `DebuggerController.destroy()` 管理。

## 14.3 Lit 响应式属性

- 对外输入 Map / Snapshot / Issue 等对象时，使用属性传值（JS property），不要试图放到 HTML attribute 字符串中。
- 内部 UI 状态用 `static properties` 的 `{ state: true }` 声明。
- 避免对大型 Snapshot 全量 JSON stringify 比较；Runtime 按 revision 更新，UI 可使用 `snapshot.revision` 判断刷新。
- 避免在 `render()` 中做遍历以外的业务计算、副作用、地图查询或订阅。
- 不在每次 render 时创建新 Map Observer 或新增 OpenLayers Listener。
- Lit 生命周期订阅必须在 `disconnectedCallback()` 中移除，并在重连时按设计重新连接。

## 14.4 数据与 DOM 安全

- Map 的 layer title、Source URL、Feature 属性和事件 message 均视为不可信内容。
- 通过 Lit 普通文本绑定显示，不将其拼入 `unsafeHTML`。
- 全项目禁止使用 `unsafeHTML` 展示诊断信息。
- 如果证据需要展示 JSON，先用安全的 `JSON.stringify()` 格式化，再通过文本节点显示。
- 不把错误消息作为 CSS selector 或 HTML 属性未经处理地拼接。

---

# 15. Web Awesome 集成

## 15.1 依赖导入

优先按需导入组件，减少打包体积。根据需要使用下面的官方入口（以安装版本实际路径为准）：

```ts
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/badge/badge.js';
import '@awesome.me/webawesome/dist/components/input/input.js';
import '@awesome.me/webawesome/dist/components/select/select.js';
import '@awesome.me/webawesome/dist/components/option/option.js';
import '@awesome.me/webawesome/dist/components/tree/tree.js';
import '@awesome.me/webawesome/dist/components/tree-item/tree-item.js';
import '@awesome.me/webawesome/dist/components/dialog/dialog.js';
```

只有确实使用相应组件时才导入。不要同时加载自动加载器和同一组件的手动模块，以免重复初始化或增加构建复杂度。

## 15.2 默认使用范围

- `wa-button`：刷新、导出、关闭等动作。
- `wa-badge`：severity / status。
- `wa-input`：图层搜索、Issue 搜索（若加入）。
- `wa-select` + `wa-option`：筛选器。
- `wa-tree` + `wa-tree-item`：图层树。
- `wa-dialog`：必要的确认或报告预览。

对于主 Tab、简洁分隔线、只读键值行等布局，允许使用原生语义 HTML + CSS；不需要强迫所有元素都变成 Web Awesome 组件。

## 15.3 Theme CSS 注入策略

项目必须保证：主题在 debugger 的 Shadow DOM 中起作用，但不会污染外部文档。

首选方案：

1. 通过 Vite raw/inline CSS 导入 Web Awesome 官方 Default Theme 样式。
2. 使用 Lit `unsafeCSS()` 把受信任、来自本地依赖包的静态 CSS 字符串纳入顶层组件 `static styles`。
3. 将 `wa-theme-default`、`wa-palette-default`、`wa-brand-blue` 与 `wa-dark` / `wa-light` 放在 debugger Shadow DOM 内的根容器上，确保主题 token 通过继承传递给嵌套 Web Components。
4. 不把 `webawesome.css` 直接作为普通 CSS 全局导入到宿主 document，避免破坏宿主样式或全局主题。
5. `unsafeCSS()` 只允许用于构建时本地安装包的固定 CSS，不得用于用户输入或网络返回内容。
6. 如果 Vite 构建对 `?inline` 不可用或资产路径异常，选用 `?url` + ShadowRoot 内 `<link>` 注入，或构建期生成可被 `adoptedStyleSheets` / `<style>` 使用的局部主题文件；选择后必须由 Demo 验证。
7. Web Awesome 组件内部使用 Shadow DOM。要定制内部元素，只能使用该组件文档列出的 CSS custom properties 或 `::part()`，禁止假设普通 CSS 能穿透。

## 15.4 主题行为

- `dark`：根容器使用 `wa-dark`；Debugger 自定义 CSS 使用深色 token。
- `light`：根容器使用 `wa-light`；自定义 CSS 使用浅色 token。
- `auto`：读取 `matchMedia('(prefers-color-scheme: dark)')`；监听 `change` 更新主题；关闭或销毁时释放监听。
- 不写入或修改宿主 `document.documentElement.classList`。
- 不修改宿主页面的全局 CSS Variables。

---

# 16. 报告与隐私

## 16.1 DebugReport 类型

```ts
export interface DebugReport {
  schemaVersion: '1.0';
  generatedAt: number;
  debuggerVersion: string;
  openLayersVersion?: string;
  snapshot?: DebugSnapshot;
  issues: DiagnosticIssue[];
  metadata?: Record<string, string | number | boolean | null>;
}
```

## 16.2 报告清理

- 报告只能包含纯 JSON 数据。
- 从 Error 中只取安全的 `name` / `message`；不包含 stack，除非未来提供显式 opt-in。
- URL 默认移除 query 和 hash；保留 origin + pathname 的前提是 Source URL 可公开读取。
- 不能包含 HTML 内容、Map 对象、Layer 对象、Source 对象、DOM 节点、Event 对象。
- 生成报告不得产生网络请求。
- 报告使用 `JSON.stringify(report, null, 2)` 生成 Blob，触发浏览器下载，文件名为 `ol-debugger-report-YYYYMMDD-HHmmss.json`。
- 导出中如果遇到意外不可序列化字段，应清理或省略该字段，而不是让整个导出失败；同时通过 `onError` 报告内部问题。

---

# 17. 错误处理与日志

## 17.1 DebuggerError

定义统一错误类型：

```ts
export type DebuggerErrorCode =
  | 'MAP_NOT_CONNECTED'
  | 'INSTANCE_DESTROYED'
  | 'INVALID_OPTIONS'
  | 'SNAPSHOT_FAILED'
  | 'RULE_EXECUTION_FAILED'
  | 'UI_INITIALIZATION_FAILED'
  | 'REPORT_EXPORT_FAILED';

export class DebuggerError extends Error {
  readonly code: DebuggerErrorCode;
  readonly context?: Record<string, string | number | boolean | null>;

  constructor(
    code: DebuggerErrorCode,
    message: string,
    context?: Record<string, string | number | boolean | null>,
  ) {
    super(message);
    this.name = 'DebuggerError';
    this.code = code;
    this.context = context;
  }
}
```

## 17.2 错误原则

- 不依赖全局 Logger / LoggerRegistry。
- 允许 `DebuggerOptions.onError` 接收内部错误。
- 若 `onError` 本身抛错，必须捕获，不得破坏 Runtime。
- 默认不向 console 大量输出日志；开发环境可以为关键错误输出一次 warning，但应避免重复输出。
- 规则错误和 UI 错误不能中断快照采集及其他规则。
- `source.load-error` 是业务诊断 Issue；调试器自身代码崩溃属于内部错误，两者要区分。

---

# 18. 性能要求

v0.1 目标为常见的几十至数百个图层树节点保持交互顺畅；不保证数十万图层节点的虚拟树性能。

必须遵守：

- 不监听 `pointermove` 后每次都遍历所有图层。
- 不使用固定高频 interval 做全图扫描。
- 相同一帧的多个变化事件合并成一次刷新。
- 不在 Lit `render()` 内访问 OpenLayers 实例。
- UI 只更新需要变化的组件；Issue 变化不应无条件重建整个外壳。
- Source event 监听按 Source 实例去重。
- 清除移除 Layer / Source 的活动引用，避免内存泄漏。
- 数组和证据对象只在生成快照时做必要复制，不在每条 UI 文本格式化时重建全量树。
- 暂不实现 FPS 和精细 Renderer 耗时归因，避免测量机制本身干扰地图。

---

# 19. 测试策略

## 19.1 单元测试

### SnapshotBuilder

覆盖：

- 普通 TileLayer / VectorLayer。
- 多层嵌套 LayerGroup。
- `visible`、opacity、zIndex、extent 和 zoom / resolution 限制。
- 自身可见但祖先组不可见。
- 父组 opacity 影响 effectiveOpacity。
- Map 尚无 size、View center 或 zoom 尚未确定。
- Source 为 null 或未知自定义层。
- ID 在同一实例重复快照时稳定。
- Collection 移除后，ObjectIdStore 活动对象索引不会继续强引用已移除图层。

### Diagnostic rules

每条规则至少包含：

- 应触发的正向测试。
- 不应触发的负向测试。
- 边界值测试。
- `undefined` / 缺失信息时不误报的测试。
- Issue evidence 中包含必需字段的测试。

边界重点：

- `zoom === minZoom`：越界。
- `zoom === maxZoom`：符合上界。
- `resolution === minResolution`：符合下界。
- `resolution === maxResolution`：越界。
- extent 只在边缘接触：按相交处理。
- 非法或缺失 extent：跳过，而不是误报范围不相交。

### IssueStore

覆盖：

- 第一次出现创建 Issue。
- 同一 Issue 再次出现不重复新增。
- active Issue 更新 evidence / lastSeenAt。
- Issue 消失后 resolved。
- Issue 恢复时复用稳定 ID，保留 firstSeenAt，并清空 resolvedAt。
- 单个规则执行失败时不能错误 resolve 该规则此前的 Issue。
- subscribe 返回的 unsubscribe 有效。
- 消费者修改返回对象不影响内部状态。

### Runtime / Observer

覆盖：

- connect 绑定监听。
- connect 到新 Map 时旧 Map 监听被移除。
- 图层 add/remove 后快照同步。
- 更换 Layer Source 后解绑旧 Source 并监听新 Source。
- 共享 Source 不被重复注册事件监听。
- destroy 幂等。
- disconnect/destroy 清理 pending schedule。
- 地图本身在 debugger destroy 后仍然可继续使用。

## 19.2 UI 测试

用 Vitest + jsdom 覆盖基础自定义元素注册和模板行为；依赖浏览器实际 Shadow DOM、Web Awesome Theme 和布局的内容必须通过 Demo 浏览器验收。

至少验证：

- `ol-debugger-panel` 能注册。
- Map 属性以 property 注入，不通过 attribute 序列化。
- 三个 Tab 正常切换。
- Snapshot / Issue 更新后 UI 自动刷新。
- Tree 选择事件能返回正确 layer ID。
- 未连接 Map 时显示空状态而非崩溃。
- `destroy()` 后无重复监听。
- 全局 Demo CSS 不污染面板，面板 CSS 不污染宿主页面。

## 19.3 每阶段必须运行

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

所有命令必须真实通过。不能用关闭规则、`skipLibCheck` 或大量 `@ts-ignore` 掩盖本项目代码错误。

---

# 20. 分阶段实施计划

## Phase 0：工程与样式验证

完成：

- 初始化 Vite TypeScript 项目、Library Build 和 Demo。
- 安装 Lit、Web Awesome、OpenLayers。
- 建立最简单的 `<ol-debugger-panel>`。
- 在 Shadow DOM 中渲染一个 Web Awesome Button 和 Tree。
- 验证主题 CSS 只作用于调试器，不污染宿主页面。
- `pnpm build` 可成功。

验收：两个隔离方向的 CSS 验证通过。此阶段未通过之前，不继续堆叠其他 UI 组件。

## Phase 1：Snapshot

完成：

- `ObjectIdStore`。
- `SnapshotBuilder`。
- Map / Layer / LayerGroup / Source snapshot。
- Extent utility。
- Snapshot 单元测试。

验收：Demo 的 console 或临时 Overview 可读到完整地图和嵌套图层快照；快照可安全 JSON stringify。

## Phase 2：Runtime 与 Observer

完成：

- MapObserver。
- LayerTreeObserver。
- SourceObserver。
- RefreshScheduler。
- `DebuggerRuntime.connect / disconnect / inspect / destroy`。

验收：地图移动、图层增删、图层属性变更、Source 替换都能触发合并刷新；销毁后事件不再触发 debugger 更新。

## Phase 3：IssueStore 与规则

完成：

- DiagnosticRule 接口。
- DiagnosticEngine。
- IssueStore。
- 首版 8 条规则。
- Issue 生命周期测试。

验收：重复诊断不会重复产生相同 Issue；问题恢复后状态变为 resolved；规则报错不会中止其他规则。

## Phase 4：UI

完成：

- Header + Overview / Layers / Issues Tab。
- Layer Tree 与详情。
- Issue List 与详情。
- 自动刷新、手动运行诊断。
- Light / Dark / Auto 主题。
- 打开 / 关闭 / toggle。

验收：所有状态来自 Runtime 输出，UI 本身没有诊断逻辑；样式隔离测试通过。

## Phase 5：报告与发布构建

完成：

- JSON 报告。
- URL 清理。
- `createDebugger()`、`defineOLDebuggerElements()` 公共导出。
- 类型声明、README、CHANGELOG。
- 外部 consumer 示例。

验收：按 README 从新 Vite 项目安装/链接该包后能运行；`destroy()` 不会销毁宿主 Map。

---

# 21. 最终验收清单

Codex 在宣告完成前必须逐条核对：

- [ ] 包名准确为 `ol-debugger`，无组织 scope。
- [ ] 技术栈为 TypeScript + Lit + Web Components + Web Awesome。
- [ ] OpenLayers 为 peer dependency，v0.1 支持 10.x。
- [ ] 能创建独立 `DebuggerRuntime`，没有全局 singleton。
- [ ] Core 不依赖 Lit / Web Awesome。
- [ ] Snapshot 只含 JSON-safe 纯数据。
- [ ] LayerGroup 子层遍历完整。
- [ ] 图层 ID 在当前 Runtime 生命期稳定。
- [ ] Observer 对集合增删、属性变更、Map/View 替换做了正确清理。
- [ ] Source 事件只对明确支持的类型解释，不把未知加载状态误判为无错误。
- [ ] 至少 8 条内置规则均有正反测试与边界测试。
- [ ] Issue 可以去重、更新和恢复。
- [ ] 单条规则异常不会中断其他规则。
- [ ] Web Awesome Tree selection 能可靠返回 layer ID。
- [ ] Web Awesome 主题样式在 Shadow DOM 内生效。
- [ ] 宿主页面样式不会污染面板，面板样式不会污染宿主。
- [ ] `close()` 仅关闭 UI，`disconnect()` 断开 Map，`destroy()` 销毁 debugger，语义区分明确。
- [ ] `destroy()` 不调用 Map 的 dispose，不删除业务图层，不更改业务状态。
- [ ] JSON 导出会清理敏感 URL 信息，不上传数据。
- [ ] `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 全部通过。
- [ ] README 有最小可运行示例、Options 说明和生命周期说明。

---

# 22. Codex 推荐编码顺序

请按以下顺序直接开始实施，每个阶段完成后跑检查：

1. 检查仓库现状，创建 `package.json`、TypeScript、Vite Library Build、Vitest、Demo 基础结构。
2. 先完成 Phase 0：验证 Lit + Web Awesome 在 Shadow DOM 中的样式方案。
3. 完成 `snapshot-types.ts`、`object-id-store.ts`、`extent-utils.ts`、`snapshot-builder.ts` 和测试。
4. 完成 `IssueStore` 与测试，再完成 Diagnostic Rule 与 Engine。
5. 完成 Map / Layer / Source Observer 和 Runtime，优先保障监听清理和共享 Source 处理。
6. 实现内置规则和边界测试。
7. 实现 Lit UI 和 Web Awesome Tree / Badge / Button 集成。
8. 实现报告导出和隐私清理。
9. 运行所有检查，修复真实错误，最后补齐 README / CHANGELOG。
10. 最终回复只陈述实际完成的模块、运行过的命令及尚未解决的问题；不能声称未执行过的测试已经通过。

---

# 23. 官方参考

- Lit 文档：<https://lit.dev/docs/>
- Lit Components / Shadow DOM：<https://lit.dev/docs/components/shadow-dom/>
- Lit Styles：<https://lit.dev/docs/components/styles/>
- Web Awesome 安装：<https://webawesome.com/docs>
- Web Awesome Customizing / Theming：<https://webawesome.com/docs/customizing>
- Web Awesome Tree：<https://webawesome.com/docs/components/tree/>
- Web Awesome Tree Item：<https://webawesome.com/docs/components/tree-item/>
- Web Awesome Dialog：<https://webawesome.com/docs/components/dialog/>
- OpenLayers API：<https://openlayers.org/en/latest/apidoc/>
- OpenLayers Map：<https://openlayers.org/en/latest/apidoc/module-ol_Map-Map.html>
- OpenLayers BaseLayer：<https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html>

> 官方文档中的 API 与包路径可能随依赖版本调整。编码时必须以锁文件所安装的稳定版本为准，并保留本文档定义的对外语义与验收要求。

---

# End of specification
