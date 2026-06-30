# RSS Reader 启动顺畅与易用性重构设计

- **日期**：2026-06-30
- **状态**：已批准（用户确认三阶段设计）
- **目标**：让 APP 首次启动顺畅、不乱弹窗、一下子进入使用页面，易用性好，整个流程打磨顺畅

## 背景与现状

7 个子智能体并行审计 99 个源文件后，识别出导致"打开 APP 白屏/弹窗/启动慢"的 7 个核心瓶颈：

| # | 问题 | 严重度 | 位置 |
|---|------|--------|------|
| 1 | 生产环境 `waitForDevServer()` 阻塞 30 秒后退出 | 致命 | `electron-main.ts:998` |
| 2 | `rssInfoStore` 模块顶层 `void refresh()` 未捕获异常 | 致命 | `rssInfoStore.ts:149` |
| 3 | 无全局错误处理器，任何异常 = 静默崩溃闪退 | 高危 | `electron-main.ts` 顶部 |
| 4 | `SyncManager` 模块级同步 I/O 阻塞主进程 | 高危 | `SyncManager.ts:82` |
| 5 | IPC 响应格式不兼容（`{success,msg}` vs `{error,data}`）| 高危 | `feed/article.handler.ts` |
| 6 | `SqliteHelper` OperationQueue 吞错不 resolve | 高危 | `SqliteHelper.ts:83` |
| 7 | 25 处 `window.electronAPI` 无空值检查 | 中危 | 多个页面/组件 |

技术债规模中等（3-5 人天可清偿）。架构基础扎实（DDD 分层、IPC 安全层、网络层、UI 四态、XSS 防护、暗黑模式均完善）。

## 范围决策（用户确认）

| 决策点 | 选择 |
|--------|------|
| 重构范围 | 先治启动 + 易用性打磨（P0 功能缺失留后续迭代）|
| 首次启动 | 引导式空状态（欢迎页 + 推荐源一键添加）|
| 布局 | 保留当前三段式，只打磨细节 |
| 现有数据 | 保留（2 文件夹/6 订阅源/106 篇文章），只做 schema 迁移 |
| 启动同步 | 先显示缓存 + 后台静默同步 |

## 执行方案：分层渐进（方案 A）

3 个阶段，每阶段可独立验证。阶段 1 完成即可正常打开，阶段 2 保证不白屏，阶段 3 达到"顺畅"。

### 阶段 1 · 启动链路保命（约 1 天）

目标：修复致命/高危问题，应用能正常打开。

**1.1 生产环境 loadFile 回退** · `electron-main.ts:998`

- 现状：`waitForDevServer()` 无条件执行 30 次×1s HTTP 轮询，生产环境阻塞 30 秒后 `app.quit()`
- 修复：`if (process.env.NODE_ENV === 'production')` 跳过 `waitForDevServer()`，直接 `mainWindow.loadFile(path.join(__dirname, 'index.html'))`
- 开发环境保留 `waitForDevServer()` 但加超时兜底

**1.2 全局错误处理器** · `electron-main.ts` 顶部

- 现状：无 `process.on('unhandledRejection')` 和 `process.on('uncaughtException')`
- 修复：注册两个处理器，最低限度 `console.error` + `dialog.showErrorBox`，避免静默崩溃

**1.3 SyncManager 懒加载** · `SyncManager.ts:82`

- 现状：构造函数中 `require('electron')` + `fs.readFileSync` 在 import 阶段执行，阻塞主进程
- 修复：构造函数仅字段初始化，`loadConfig()` 延迟到 `app.whenReady()` 之后调用

**1.4 IPC 格式统一** · `feed.handler.ts` / `article.handler.ts`

- 现状：新 handler 返回 `{success, msg}`，与 `wrapHandler` 的 `{error, data}` 不兼容
- 修复：新 handler 改用 `wrapHandler` 或统一为 `{error, data}` 格式；删除死代码 `presentation/ipc/index.ts`（`registerAllHandlers` 从未被调用）

**1.5 OperationQueue 死锁修复** · `SqliteHelper.ts:83`

- 现状：`process()` catch 块只 `console.error`，pending Promise 永不 resolve/reject → 死锁
- 修复：catch 块补上 `reject(err)`，await 调用方能正常返回

**1.6 initDB 并行化** · `electron-main.ts` initDB()

- 现状：表创建/11 索引/FTS5/触发器/6 迁移全部串行 `await`，冷启动 2-5 秒
- 修复：无依赖的 DDL 用 `Promise.all` 并行执行，冷启动降到 < 1 秒

**验证标准**：开发模式 `npx quasar dev -m electron` 启动无报错；生产构建 `npx quasar build -m electron` 后可直接打开；故意触发异常显示错误框而非闪退。

### 阶段 2 · 渲染健壮性（约 1 天）

目标：前端在任何情况下都不白屏，失败时显示错误页。

**2.1 白屏根因修复：rssInfoStore 顶层异常** · `rssInfoStore.ts:149`

- 现状：`defineStore(() => { void refresh(); ... })` 顶层立即执行，`electronClient` Proxy 在 `window.electronAPI` 不存在时 throw，未捕获 → store 创建失败 → 组件树卸载 → 白屏
- 修复：移除顶层 `void refresh()`，改为显式 `init()` 方法；组件 `onMounted` 时调用 `store.init()`，内部 try/catch，失败设置 `errorState`
- 同样审查其他有顶层副作用的 store（如 `searchStore.loadSearchHistory` 读 localStorage，风险低但一并规范化）

**2.2 全局错误边界**

- `app.config.errorHandler` · `src/stores/index.ts` 或 `main.ts`：注册 Vue 3 全局错误处理器，捕获组件 setup/渲染异常
- 新增 `src/components/ErrorBoundary.vue`：包裹 `router-view`，捕获子树渲染错误，降级显示"出错了，点击重试"

**2.3 electronAPI 空值防护（25 处）** · `src/services/electronClient.ts`

- 现状：`getClient()` 直接 `throw new Error('Electron API is not available')`；25 处直接 `window.electronAPI.xxx` 无可选链
- 修复：`getClient()` 不再 throw，返回安全的 noop 代理（调用时静默返回 undefined/空数组）；所有 `window.electronAPI.xxx` 调用统一改走 `electronClient.xxx`，由 Proxy 统一兜底
- 影响范围：HomePage/PostList/Content/SettingPage/FavoritePage/AppHeader + PostListItem/RssItemContextMenu/SubSubscriptionItemContextMenu/SearchComponent

**2.4 路由守卫** · `src/router/index.ts`

- 新增 `beforeEach` 守卫：检查 `window.electronAPI` 可用性，非 Electron 环境重定向到友好提示页（而非进入页面后崩溃）

**验证标准**：删除 `window.electronAPI` 模拟非 Electron 环境，应用显示错误页而非白屏；store 初始化失败显示错误态而非空白；所有页面有 loading→error→empty→normal 四态。

### 阶段 3 · 易用性打磨（约 1 天）

目标：达到"流程顺畅"。

**3.1 引导式空状态** · `src/pages/HomePage.vue` 空状态分支

- 数据库为空时显示：大图标 + "欢迎使用 Rss Reader" + 醒目「添加订阅」按钮 + 推荐源一键添加卡片（Hacker News / BBC / The Verge 等）
- 点击推荐源自动添加并同步，无需手动填 URL
- 保留现有空状态动画过渡

**3.2 后台静默同步** · `AppLayout.vue` onMounted + `SyncManager`

- 启动后立即显示数据库已有文章（瞬间出内容）
- 后台静默调用 `syncAll()`，不阻塞 UI，不弹模态框
- 有新内容时刷新未读数 + 轻量 toast 提示「已同步 N 篇新文章」
- 同步失败只静默记录日志，不打扰用户

**3.3 快捷键绑定** · `App.vue` + 全局 keydown 监听

- 现状：`useKeyboard.ts` 定义了快捷键，`App.vue` 注册了但未真正绑定到 window 事件
- 修复：`window.addEventListener('keydown', keyboard.execute)` 真正生效
- 快捷键：Ctrl+S 同步 / Ctrl+F 搜索 / Ctrl+N 新订阅 / Ctrl+D 暗色 / Ctrl+R 刷新 / Ctrl+Shift+? 帮助

**3.4 搜索入口统一** · `AppHeader.vue` 顶部搜索图标

- 现状：搜索只在 AppDrawer 内，关闭侧边栏后无搜索入口
- 修复：顶部标题栏加搜索图标，点击展开搜索框（或 Ctrl+F 唤起），无论侧边栏开闭都能搜索

**3.5 阅读进度持久化** · `Content.vue` + localStorage

- 现状：滚动位置重启后丢失
- 修复：按文章 guid 存储滚动位置到 localStorage，重新打开文章时恢复到上次阅读位置

**验证标准**：空数据库启动显示引导页；有数据启动瞬间显示文章列表；快捷键全部生效；搜索随时可用；重开文章恢复阅读位置。

## 不在本次范围

以下 P0 功能缺失留后续迭代（用户确认）：

- OPML 导出
- 订阅编辑（源 URL 变更）
- 移动订阅后端对接
- 文章删除 IPC 暴露
- 未读筛选 UI
- 同步进度通道加入 preload 白名单

## 不破坏的资产

重构时必须保留以下已完善的部分：

- IPC 安全层（白名单 + 输入校验 + 错误脱敏）
- 网络层（双路 fetch + 超时 + 编码回退 + CacheManager）
- UI 四态覆盖（骨架屏/空状态/错误/正常）
- XSS 防护（DOMPurify 双重配置）
- 暗黑模式（全组件覆盖）
- DDD 分层架构

## 测试策略

每阶段完成后验证：

1. **TypeScript 编译**：`npx tsc --noEmit` 零源码错误
2. **单元测试**：`npx vitest run` 现有测试全通过
3. **启动验证**：开发模式 `npx quasar dev -m electron` 无报错启动
4. **Electron E2E**：用 `_electron.launch()` 验证应用加载、UI 渲染、订阅加载、内容渲染
5. **边界场景**：模拟非 Electron 环境、空数据库、DB 初始化失败、网络异常

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| initDB 并行化可能引入 schema 依赖问题 | 先分析 DDL 依赖关系，无依赖的才并行 |
| electronClient 改为 noop 代理可能掩盖真实错误 | noop 返回值要符合类型（空数组/undefined），调用方仍需处理空态 |
| store init() 改造影响多个组件 | 逐个组件验证，保留旧 refresh() 作为过渡 |
