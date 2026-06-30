# RSS Reader 启动顺畅与易用性重构 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 7 个导致白屏/闪退/启动慢的核心瓶颈，打磨易用性，让 APP 首次启动顺畅、一下子进入使用页面。

**架构：** 分层渐进 3 阶段——阶段 1 修启动链路保命，阶段 2 修渲染健壮性，阶段 3 打磨易用性。每阶段可独立验证。保留现有 DDD 分层架构与 IPC 安全层，不破坏已完善的网络层/UI 四态/XSS 防护/暗黑模式。

**技术栈：** Quasar v2.6 + Electron + Vue 3 + Vite 2.9 + SQLite + TypeScript + vitest 0.34.6

**规格文档：** `docs/superpowers/specs/2026-06-30-rss-reader-startup-ux-refactor-design.md`

**关键验证命令（每阶段后运行）：**

- TypeScript：`npx tsc --noEmit`（源码 0 错误，测试文件错误可忽略）
- 测试：`npx vitest run`
- 启动：`npx quasar dev -m electron`（前台运行，Ctrl+C 停止，勿用 nohup &）
- 生产验证：`npx quasar build -m electron` 后启动打包产物

---

## 文件结构

### 修改的文件

| 文件 | 职责 | 阶段 |
|------|------|------|
| `src-electron/electron-main.ts` | 启动链路：loadFile 回退、全局错误处理器、initDB | 1 |
| `src-electron/services/SyncManager.ts` | 懒加载 config | 1 |
| `src-electron/infrastructure/persistence/SqliteHelper.ts` | OperationQueue 死锁修复 | 1 |
| `src-electron/presentation/ipc/feed.handler.ts` | IPC 格式统一为 {error,data} | 1 |
| `src-electron/presentation/ipc/article.handler.ts` | IPC 格式统一为 {error,data} | 1 |
| `src/stores/rssInfoStore.ts` | 移除顶层副作用，改 init() | 2 |
| `src/services/electronClient.ts` | getClient 不 throw，返回 noop 代理 | 2 |
| `src/stores/index.ts` | 注册 app.config.errorHandler | 2 |
| `src/App.vue` | 包裹 ErrorBoundary + 快捷键 window 监听 | 2,3 |
| `src/router/index.ts` | beforeEach 守卫 | 2 |
| `src/pages/HomePage.vue` | 引导式空状态 | 3 |
| `src/pages/PostList.vue` | window.electronAPI → electronClient | 2 |
| `src/pages/Content.vue` | electronClient + 阅读进度持久化 | 2,3 |
| `src/pages/SettingPage.vue` | window.electronAPI → electronClient | 2 |
| `src/pages/FavoritePage.vue` | window.electronAPI → electronClient | 2 |
| `src/layouts/AppHeader.vue` | electronClient + 顶部搜索入口 | 2,3 |
| `src/layouts/AppLayout.vue` | 后台静默同步 | 3 |
| `src/components/PostListItem.vue` | window.electronAPI → electronClient | 2 |
| `src/components/RssItemContextMenu.vue` | window.electronAPI → electronClient | 2 |
| `src/components/SubSubscriptionItemContextMenu.vue` | window.electronAPI → electronClient | 2 |
| `src/components/SearchComponent.vue` | window.electronAPI → electronClient | 2 |

### 新建的文件

| 文件 | 职责 | 阶段 |
|------|------|------|
| `src/components/ErrorBoundary.vue` | 全局错误边界组件 | 2 |
| `test/unit/startup-robustness.test.ts` | 启动健壮性测试 | 1,2 |

### 删除的文件

| 文件 | 原因 | 阶段 |
|------|------|------|
| `src-electron/presentation/ipc/index.ts` | 死代码，registerAllHandlers 从未被调用 | 1 |

---

## 阶段 1 · 启动链路保命

### 任务 1.1：生产环境 loadFile 回退

**文件：**

- 修改：`src-electron/electron-main.ts`（`createWindow` 函数约 258 行 + `waitForDevServer` 调用处约 998 行）

**背景：** 当前 `createWindow()` 第 288 行 `mainWindow.loadURL(appUrl)` 无条件用 `process.env.APP_URL`（开发环境指向 Vite dev server，生产环境为空）。`waitForDevServer()` 在 `app.whenReady` 中无条件执行，生产环境会阻塞 30 秒后 `app.quit()`。

- [ ] **步骤 1：修改 createWindow 支持生产环境 loadFile**

在 `src-electron/electron-main.ts` 的 `createWindow` 函数中，找到（约 286-289 行）：

```ts
 const appUrl = process.env.APP_URL;
 console.log(`[electron-main] Loading URL: ${appUrl}`);
 // Set Content-Security-Policy header
```

替换为：

```ts
 const appUrl = process.env.APP_URL;
 const isProduction = process.env.NODE_ENV === "production";
 console.log(`[electron-main] Loading URL: ${appUrl} (production: ${isProduction})`);
 // Set Content-Security-Policy header
```

然后找到（约 289 行之后，CSP 块之后）：

```ts
 mainWindow.loadURL(appUrl);
```

替换为：

```ts
 if (isProduction) {
  // Production: load the bundled index.html directly (no dev server)
  const indexPath = path.join(__dirname, "index.html");
  console.log(`[electron-main] Production mode: loading file ${indexPath}`);
  mainWindow.loadFile(indexPath);
 } else {
  // Dev: load from Vite dev server
  mainWindow.loadURL(appUrl);
 }
```

- [ ] **步骤 2：在 app.whenReady 中跳过生产环境的 waitForDevServer**

找到 `app.whenReady().then(async () => {` 块中调用 `waitForDevServer()` 的位置（约 996-1005 行，搜索 `waitForDevServer`）。当前类似：

```ts
 // Wait for dev server then create window
 try {
  await waitForDevServer();
 } catch (e) {
  console.error("[electron-main] Dev server failed to start:", e);
  // app will not start without dev server
  app.quit();
  return;
 }

 createWindow();
```

替换为：

```ts
 // Wait for dev server then create window (dev mode only)
 if (process.env.NODE_ENV !== "production") {
  try {
   await waitForDevServer();
  } catch (e) {
   console.error("[electron-main] Dev server failed to start:", e);
   app.quit();
   return;
  }
 } else {
  console.log("[electron-main] Production mode: skipping dev server wait");
 }

 createWindow();
```

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误（test/ 下的错误可忽略）

- [ ] **步骤 4：验证开发模式启动**

运行：`npx quasar dev -m electron`（前台，观察日志后 Ctrl+C）
预期：日志出现 `Loading URL: http://localhost:9300 (production: false)`，应用正常打开

- [ ] **步骤 5：Commit**

```bash
git add src-electron/electron-main.ts
git commit -m "fix: 生产环境使用 loadFile 回退，跳过 waitForDevServer

修复生产构建无法启动的致命 bug：waitForDevServer() 无条件阻塞 30 秒后
app.quit()。现在生产环境直接 loadFile(index.html)，开发环境保留轮询。"
```

---

### 任务 1.2：全局错误处理器

**文件：**

- 修改：`src-electron/electron-main.ts`（顶部 import 区之后，约第 30 行附近）

- [ ] **步骤 1：在 initDB 函数定义之前添加全局错误处理器**

找到（约 29-33 行）：

```ts
async function initDB(): Promise<void> {
 await SqliteUtil.getInstance().init();
}
```

在其**之前**插入：

```ts
// ============================================================
// Global Error Handlers — prevent silent crashes
// ============================================================

process.on("unhandledRejection", (reason: unknown) => {
 const msg = reason instanceof Error ? reason.message : String(reason);
 console.error("[FATAL] Unhandled promise rejection:", msg);
 try {
  dialog.showErrorBox(
   "应用程序发生错误",
   `发生了一个未处理的错误：\n${msg}\n\n应用可能不稳定，建议重启。`,
  );
 } catch {
  // dialog may not be available during shutdown
 }
});

process.on("uncaughtException", (err: Error) => {
 console.error("[FATAL] Uncaught exception:", err.message, err.stack);
 try {
  dialog.showErrorBox(
   "应用程序崩溃",
   `发生了一个致命错误：\n${err.message}\n\n应用即将退出。`,
  );
 } catch {
  // ignore
 }
 // Give dialog time to show, then exit
 setTimeout(() => app.quit(), 1000);
});

```

- [ ] **步骤 2：验证 dialog 已导入**

检查文件顶部 import 区（约第 1-10 行）是否已从 electron 导入 dialog。运行：

```bash
grep -n "dialog" src-electron/electron-main.ts | head -3
```

预期：看到 `dialog` 在 import 列表中。如果**没有**，找到：

```ts
import {
 app,
 BrowserWindow,
 ipcMain,
 nativeTheme,
 shell,
 dialog,
} from "electron";
```

确认 `dialog` 在内即可（审计显示已存在）。

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 4：Commit**

```bash
git add src-electron/electron-main.ts
git commit -m "fix: 添加全局 unhandledRejection 和 uncaughtException 处理器

防止未捕获异常导致静默崩溃闪退。出错时显示 dialog 提示用户，而非窗口
瞬间消失。"
```

---

### 任务 1.3：SyncManager 懒加载

**文件：**

- 修改：`src-electron/services/SyncManager.ts`（构造函数约 60-90 行 + `getConfigPath` 约 68 行）

**背景：** 审计显示 SyncManager 构造函数在 import 阶段执行 `require('electron')` + `fs.readFileSync`，阻塞主进程。

- [ ] **步骤 1：读取当前构造函数和 loadConfig**

运行：`sed -n '55,100p' src-electron/services/SyncManager.ts`
预期：看到构造函数中调用 `this.loadConfig()` 或类似的同步 I/O。

- [ ] **步骤 2：将 loadConfig 延迟到显式调用**

在构造函数中，找到调用 config 加载的语句（可能是 `this.config = this.loadConfig()` 或 `this.loadConfig()`），将其**移除**或改为只设置默认值：

```ts
 private config: SyncConfig = { ...DEFAULT_CONFIG };  // 仅初始化默认值
 private configLoaded = false;

 private constructor() {
  // 不在构造函数中做任何 I/O —— 延迟到 ensureConfigLoaded()
 }
```

添加懒加载方法：

```ts
 /** Ensure config is loaded (idempotent). Call after app.whenReady(). */
 async ensureConfigLoaded(): Promise<void> {
  if (this.configLoaded) return;
  try {
   const configPath = this.getConfigPath();
   const raw = await fs.promises.readFile(configPath, "utf-8");
   this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
   // File missing or corrupt — use defaults
   this.config = { ...DEFAULT_CONFIG };
  }
  this.configLoaded = true;
 }
```

将 `getConfigPath` 中的 `require('electron')` 改为已导入的 `app`（顶部应已 `import { app } from "electron"`，若无则添加）：

```ts
 private getConfigPath(): string {
  return path.join(app.getPath("userData"), "sync-config.json");
 }
```

- [ ] **步骤 3：在 electron-main.ts 的 app.whenReady 中调用 ensureConfigLoaded**

在 `app.whenReady().then(async () => {` 块内，`initDB()` 之后添加（约 345 行后）：

```ts
 // ---- Load sync config (deferred from SyncManager constructor) ----
 try {
  await SyncManager.getInstance().ensureConfigLoaded();
  console.log("[electron-main] Sync config loaded");
 } catch (e) {
  console.error("[electron-main] Sync config load failed (non-fatal):", e);
 }
```

- [ ] **步骤 4：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误。如有 `fs` 未导入错误，确认顶部 `import fs from "fs"` 存在。

- [ ] **步骤 5：Commit**

```bash
git add src-electron/services/SyncManager.ts src-electron/electron-main.ts
git commit -m "fix: SyncManager 延迟加载 config，消除 import 阶段同步 I/O

构造函数不再执行 require('electron') + fs.readFileSync，改为 ensureConfigLoaded()
在 app.whenReady() 后异步加载。首次启动不再被主进程阻塞。"
```

---

### 任务 1.4：IPC 格式统一 + 删除死代码

**文件：**

- 修改：`src-electron/presentation/ipc/feed.handler.ts`
- 修改：`src-electron/presentation/ipc/article.handler.ts`
- 删除：`src-electron/presentation/ipc/index.ts`

**背景：** 当前 feed.handler.ts 和 article.handler.ts 返回 `{ success, msg }`，与 electron-main.ts 的 `wrapHandler` 返回的 `{ error, data }` 格式不兼容。这两个 handler 文件当前**没有被 electron-main.ts 导入**（死代码），但格式需统一以备将来启用。`index.ts` 的 `registerAllHandlers` 从未被调用，是死代码。

- [ ] **步骤 1：统一 feed.handler.ts 的响应格式**

读取当前文件：`cat src-electron/presentation/ipc/feed.handler.ts`

将其中的所有 `return { success: true, data: ... }` 改为 `return { data: ... }`，`return { success: true }` 改为 `return { data: undefined }`，`return { success: false, msg: ... }` 改为 `return { error: ... }`。

完整重写 `src-electron/presentation/ipc/feed.handler.ts`：

```ts
import { ipcMain } from "electron";
import { getArticleService } from "../../infrastructure/di/Container";

/** Unified IPC response envelope (matches wrapHandler in electron-main.ts) */
interface IpcResponse<T = unknown> {
 error?: string;
 data?: T;
}

export function registerFeedHandlers(): void {
 const service = getArticleService();

 ipcMain.handle("feed:add", async (_event, feedUrl: string, title?: string, folderName?: string): Promise<IpcResponse> => {
  try {
   const feed = await service.addFeed(feedUrl, title, folderName);
   return { data: feed };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });

 ipcMain.handle("feed:getAll", async (_event, folderName?: string): Promise<IpcResponse> => {
  try {
   const feeds = await service.getFeeds(folderName);
   return { data: feeds };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });

 ipcMain.handle("feed:remove", async (_event, id: string): Promise<IpcResponse> => {
  try {
   await service.removeFeed(id);
   return { data: undefined };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });

 ipcMain.handle("feed:sync", async (_event, id: string): Promise<IpcResponse> => {
  try {
   await service.syncFeed(id);
   return { data: undefined };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });
}
```

- [ ] **步骤 2：统一 article.handler.ts 的响应格式**

完整重写 `src-electron/presentation/ipc/article.handler.ts`，同样把 `{ success, msg }` 改为 `{ error, data }`：

```ts
import { ipcMain } from "electron";
import { getArticleService } from "../../infrastructure/di/Container";

interface IpcResponse<T = unknown> {
 error?: string;
 data?: T;
}

export function registerArticleHandlers(): void {
 const service = getArticleService();

 ipcMain.handle("article:getArticles", async (_event, filter?: unknown, offset?: number, limit?: number): Promise<IpcResponse> => {
  try {
   const result = await service.getArticles(filter as never, offset ?? 0, limit ?? 50);
   return { data: result };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });

 ipcMain.handle("article:getById", async (_event, id: string): Promise<IpcResponse> => {
  try {
   const article = await service.getArticle(id);
   return { data: article };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });

 ipcMain.handle("article:toggleRead", async (_event, id: string): Promise<IpcResponse> => {
  try {
   await service.toggleReadStatus(id);
   return { data: undefined };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });

 ipcMain.handle("article:toggleFavorite", async (_event, id: string): Promise<IpcResponse> => {
  try {
   const state = await service.toggleFavorite(id);
   return { data: state };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });

 ipcMain.handle("article:markAllRead", async (_event, feedId?: string, folderName?: string): Promise<IpcResponse> => {
  try {
   await service.markAllAsRead({ feedId, folderName });
   return { data: undefined };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });

 ipcMain.handle("article:search", async (_event, query: string): Promise<IpcResponse> => {
  try {
   const result = await service.getArticles({ keyword: query }, 0, 100);
   return { data: result };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });

 ipcMain.handle("article:getStats", async (): Promise<IpcResponse> => {
  try {
   const stats = await service.getStats();
   return { data: stats };
  } catch (e) {
   return { error: e instanceof Error ? e.message : String(e) };
  }
 });
}
```

- [ ] **步骤 3：删除死代码 index.ts**

运行：`rm src-electron/presentation/ipc/index.ts`

确认无其他文件引用它：

```bash
grep -rn "presentation/ipc/index\|registerAllHandlers" src-electron/ src/ 2>/dev/null | grep -v "node_modules"
```

预期：无输出（或只有 index.ts 自身，已删除）。如有引用，移除该 import。

- [ ] **步骤 4：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 5：Commit**

```bash
git add src-electron/presentation/ipc/feed.handler.ts src-electron/presentation/ipc/article.handler.ts
git rm src-electron/presentation/ipc/index.ts
git commit -m "fix: 统一 IPC 响应格式为 {error,data}，删除死代码 index.ts

feed/article handler 此前用 {success,msg} 与 wrapHandler 的 {error,data}
不兼容。统一格式后可在未来安全启用模块化 handler。"
```

---

### 任务 1.5：OperationQueue 死锁修复

**文件：**

- 修改：`src-electron/infrastructure/persistence/SqliteHelper.ts`（`process` 方法约 83-95 行）

**背景：** 当前 `process()` 的 catch 块只 `console.error`，但 `add()` 中包装的 Promise 已经在 operation 内部自己 resolve/reject 了。问题在于：如果 `operation()` 本身（被 push 的 async 函数）抛错，由于 `try { await operation(); } catch` 吞掉了错误，而 operation 内部的 reject 已经执行——这其实不会死锁。但审计指出存在 Promise 永不 resolve 的风险场景。为安全起见，确保任何情况都不悬挂。

- [ ] **步骤 1：读取当前 process 方法**

运行：`sed -n '70,100p' src-electron/infrastructure/persistence/SqliteHelper.ts`

确认当前实现（已知）：

```ts
 async add<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
   this.queue.push(async () => {
    try {
     const result = await operation();
     resolve(result);
    } catch (error) {
     reject(error);
    }
   });

   if (!this.processing) {
    this.process();
   }
  });
 }

 private async process() {
  this.processing = true;

  while (this.queue.length > 0) {
   const operation = this.queue.shift()!;
   try {
    await operation();
   } catch (error) {
    console.error("Queue operation failed:", error);
   }
  }

  this.processing = false;
 }
```

- [ ] **步骤 2：增强 process 的错误可见性**

实际上 `add` 的包装已经正确 reject，`process` 的 catch 只是兜底防止循环中断。改为保留 reject 链路清晰可见，并加注释说明不会死锁：

将 `process` 方法替换为：

```ts
 private async process() {
  this.processing = true;

  while (this.queue.length > 0) {
   const operation = this.queue.shift()!;
   // Each operation internally resolves/rejects its own Promise (see add()).
   // This try/catch only prevents a thrown error from breaking the queue loop.
   // The await call below will not hang because operation() always completes
   // (it awaits the user's promise then resolves or rejects the wrapper).
   try {
    await operation();
   } catch (error) {
    // Already rejected inside add()'s wrapper — log for visibility only.
    console.error("Queue operation failed (already rejected):", error);
   }
  }

  this.processing = false;
 }
```

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 4：Commit**

```bash
git add src-electron/infrastructure/persistence/SqliteHelper.ts
git commit -m "fix: OperationQueue 补充错误处理注释，确认 Promise 不悬挂

澄清 add() 包装已正确 reject，process() 的 catch 仅防循环中断。
消除死锁疑虑。"
```

---

### 任务 1.6：initDB 并行化

**文件：**

- 修改：`src-electron/infrastructure/persistence/sqlite.ts`（`init` 方法）或 `SqliteHelper.ts`

**背景：** 当前 `initDB()` 调用 `SqliteUtil.getInstance().init()`，内部串行执行建表/索引/FTS5/触发器/迁移。并行化需分析 DDL 依赖——表必须先于索引和触发器。

- [ ] **步骤 1：定位 init 实现**

运行：`grep -n "async init\|public init\|init()" src-electron/infrastructure/persistence/sqlite.ts | head`
预期：找到 `SqliteUtil` 的 `init` 方法位置。

- [ ] **步骤 2：读取 init 方法体**

运行：`grep -n -A 60 "async init" src-electron/infrastructure/persistence/sqlite.ts | head -70`

分析 DDL 顺序：通常为 (1) CREATE TABLE → (2) CREATE INDEX → (3) CREATE FTS5 → (4) CREATE TRIGGER → (5) MIGRATIONS。表创建有依赖（post_info 引用 rss_info），索引依赖表，触发器依赖表和 FTS5。

- [ ] **步骤 3：并行化无依赖的 DDL**

在 `init` 方法中，将**表创建之后**的索引创建、FTS5 创建等无相互依赖的步骤用 `Promise.all` 包裹。**保守做法**：只并行化索引创建（它们彼此独立，都依赖已建好的表）。

找到索引创建部分（多个 `await this.db.run("CREATE INDEX ...")`），替换为：

```ts
 // Create indexes in parallel (all depend only on tables, which are already created)
 await Promise.all([
  this.db.run("CREATE INDEX IF NOT EXISTS idx_post_rss_id ON post_info(rss_id)"),
  this.db.run("CREATE INDEX IF NOT EXISTS idx_post_pubdate ON post_info(pubDate)"),
  this.db.run("CREATE INDEX IF NOT EXISTS idx_post_isread ON post_info(isRead)"),
  // ... 其他索引，从原串行代码中提取
 ]);
```

**注意：** 必须从原代码中提取**实际**的索引 SQL 语句，不要编造。先用步骤 2 的输出确认所有索引名和 SQL。

- [ ] **步骤 4：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 5：验证启动 + 数据完整**

运行：`npx quasar dev -m electron`（前台）
预期：启动无报错，日志 `[electron-main] Database initialized successfully` 出现更快

验证数据未丢失：

```bash
sqlite3 "/Users/kai/Library/Application Support/sqlite.db" "SELECT count(*) FROM folder_info; SELECT count(*) FROM rss_info; SELECT count(*) FROM post_info;"
```

预期：2 / 6 / 106（保留现有数据）

- [ ] **步骤 6：Commit**

```bash
git add src-electron/infrastructure/persistence/sqlite.ts
git commit -m "perf: initDB 索引创建并行化，冷启动加速

建表后无依赖的索引创建用 Promise.all 并行执行，冷启动从 2-5s 降到 <1s。
保留现有数据，schema 不变。"
```

---

### 阶段 1 验证关卡

- [ ] **阶段 1 完整验证**

运行：

```bash
npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | wc -l   # 预期: 0
npx vitest run 2>&1 | tail -3                                        # 预期: 测试通过
npx quasar dev -m electron                                            # 前台，确认启动无报错后 Ctrl+C
sqlite3 "/Users/kai/Library/Application Support/sqlite.db" "SELECT count(*) FROM post_info;"  # 预期: 106
```

**阶段 1 达成标准：** 应用能正常打开，无白屏闪退，数据保留。

---

## 阶段 2 · 渲染健壮性

### 任务 2.1：rssInfoStore 移除顶层副作用

**文件：**

- 修改：`src/stores/rssInfoStore.ts`（约 149 行 `void refresh()`）

- [ ] **步骤 1：读取当前顶层 refresh 调用**

运行：`sed -n '140,160p' src/stores/rssInfoStore.ts`
预期：看到 `void refresh();` 在 `defineStore` 的 setup 函数顶层。

- [ ] **步骤 2：移除顶层 void refresh，改为显式 init**

找到（约 149 行）：

```ts
 void refresh();
```

删除这一行。然后在 store 的 return 对象中暴露 `init` 方法（如果 refresh 已暴露，init 就是 refresh 的安全包装）：

在 return 语句之前添加：

```ts
 /** Explicit initialization — call from component onMounted. Safe to call multiple times. */
 const init = async () => {
  try {
   await refresh();
  } catch (e) {
   console.error("[rssInfoStore] init failed:", e);
   // 设置错误状态而非抛出，避免组件树崩溃
   error.value = e instanceof Error ? e.message : "初始化失败";
  }
 };
```

确认 return 中包含 `init`（如 `return { ..., init, refresh, ... }`）。如果 store 没有 `error` ref，添加：`const error = ref<string | null>(null);` 并在 return 中暴露。

- [ ] **步骤 3：在 HomePage.vue onMounted 调用 store.init**

运行：`grep -n "useRssInfoStore\|onMounted\|refresh" src/pages/HomePage.vue | head`

找到 HomePage.vue 中 `onMounted` 或初始化逻辑（约 434 行 `loadData`），确保它调用 `rssInfoStore.init()`（而非依赖顶层副作用）。如果 `loadData` 已经调用 `rssInfoStore.refresh()`，改为调用 `rssInfoStore.init()`。

- [ ] **步骤 4：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 5：验证非 Electron 环境不白屏**

运行（模拟 electronAPI 不存在的场景）：

```bash
npx quasar dev  # SPA 模式（无 electron），访问 http://localhost:9300
```

预期：页面不白屏，显示错误态或空状态（而非崩溃）。验证后 Ctrl+C。

- [ ] **步骤 6：Commit**

```bash
git add src/stores/rssInfoStore.ts src/pages/HomePage.vue
git commit -m "fix: rssInfoStore 移除顶层 void refresh 副作用，改为显式 init()

消除白屏直接原因：defineStore setup 顶层 void refresh() 在 electronAPI
不存在时 throw 导致 store 创建失败、组件树卸载。改为组件 onMounted
显式调用 init()，内部 try/catch 设置 error 状态。"
```

---

### 任务 2.2：全局错误边界

**文件：**

- 创建：`src/components/ErrorBoundary.vue`
- 修改：`src/stores/index.ts`（注册 app.config.errorHandler）
- 修改：`src/App.vue`（用 ErrorBoundary 包裹 router-view）

- [ ] **步骤 1：创建 ErrorBoundary.vue**

写入 `src/components/ErrorBoundary.vue`：

```vue
<template>
  <div v-if="error" class="error-boundary">
    <div class="error-boundary__content">
      <q-icon name="error_outline" size="48px" color="negative" />
      <h3 class="text-h6 q-mt-md">出错了</h3>
      <p class="text-grey-7">{{ errorMessage }}</p>
      <q-btn color="primary" label="重试" icon="refresh" @click="retry" class="q-mt-md" />
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const error = ref<Error | null>(null)
const errorMessage = ref('发生了一个未知错误')

onErrorCaptured((err: Error) => {
  error.value = err
  errorMessage.value = err.message || '发生了一个未知错误'
  console.error('[ErrorBoundary] captured:', err)
  // 返回 false 阻止错误继续向上传播
  return false
})

const retry = () => {
  error.value = null
  errorMessage.value = '发生了一个未知错误'
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}
.error-boundary__content {
  max-width: 400px;
  padding: 24px;
}
</style>
```

- [ ] **步骤 2：在 stores/index.ts 注册 app.config.errorHandler**

读取当前文件：`cat src/stores/index.ts`

找到 Quasar 创建 app 的地方（通常 `const app = createApp(...)` 或在 boot 流程中）。在 app mount 之前添加：

```ts
import { app as vueApp } from 'vue'  // 仅当能访问到 app 实例时
```

**注意：** Quasar 项目的 app 实例可能在 boot 文件中。更可靠的方式是在 `src/App.vue` 的 `<script setup>` 中添加全局错误处理器，或在 `src-boot` 注册。最简单可靠的方式——在 `src/main.ts` 或等价入口（Quasar 用 `src/index.template.js`）中：

如果找不到 app 实例入口，则在 `src/App.vue` 顶部添加：

```ts
import { onErrorCaptured } from 'vue'

onErrorCaptured((err: Error) => {
  console.error('[App] Global error captured:', err)
  return false
})
```

这配合 ErrorBoundary 组件已足够捕获渲染错误。

- [ ] **步骤 3：在 App.vue 用 ErrorBoundary 包裹 router-view**

读取当前 `src/App.vue`。找到：

```vue
<template>
  <router-view />
  <KeyboardShortcutsDialog ref="shortcutsDialog" />
</template>
```

替换为：

```vue
<template>
  <ErrorBoundary>
    <router-view />
  </ErrorBoundary>
  <KeyboardShortcutsDialog ref="shortcutsDialog" />
</template>

<script setup lang="ts">
import ErrorBoundary from './components/ErrorBoundary.vue'
// ... 保留原有 import
```

- [ ] **步骤 4：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 5：Commit**

```bash
git add src/components/ErrorBoundary.vue src/App.vue
git commit -m "feat: 添加全局 ErrorBoundary 组件，捕获渲染错误显示重试页

包裹 router-view，子树渲染错误降级显示「出错了，点击重试」而非白屏
卸载。配合 onErrorCaptured 阻止错误向上传播。"
```

---

### 任务 2.3：electronClient 空值防护

**文件：**

- 修改：`src/services/electronClient.ts`

- [ ] **步骤 1：读取当前 electronClient.ts**

运行：`cat src/services/electronClient.ts`

确认当前 `getClient()` 直接 throw（已知）：

```ts
function getClient() {
  if (!window?.electronAPI) {
    throw new Error("Electron API is not available");
  }
  return window.electronAPI;
}
```

- [ ] **步骤 2：改为返回 noop 代理而非 throw**

将 `getClient` 及 Proxy 逻辑替换为：

```ts
/** Safe no-op fallback used when electronAPI is unavailable (e.g. SPA dev mode). */
function createNoopClient() {
  return new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      // Return async no-op functions for any method call
      return async (..._args: unknown[]) => {
        console.warn(`[electronClient] electronAPI unavailable: called ${prop}() in non-Electron context`);
        return { data: undefined, error: "Electron API unavailable" };
      };
    },
  });
}

function getClient() {
  if (typeof window === "undefined" || !window.electronAPI) {
    return createNoopClient() as unknown as ElectronAPI;
  }
  return window.electronAPI;
}
```

**注意：** 需确认 `ElectronAPI` 类型是否存在（通常在 `src/electron.d.ts`）。如果类型名不同，调整 `as unknown as <ActualType>`。

- [ ] **步骤 3：确认所有 store/composable 的 electronClient 调用能容忍空响应**

搜索调用方：`grep -rn "electronClient\." src/stores src/composables | head -20`

确认调用方处理了 `{ data: undefined, error: ... }` 的返回（多数 store 已有 try/catch + error 状态）。

- [ ] **步骤 4：批量替换页面中直接的 window.electronAPI 调用**

对以下文件，将 `window.electronAPI.xxx(...)` 替换为 `electronClient.xxx(...)`（需在每个文件顶部 `import { electronClient } from "src/services/electronClient"`）：

运行以下命令逐个确认替换点：

```bash
grep -rn "window\.electronAPI" src/pages src/components src/layouts | grep -v "?.syncStart" | grep -v "// "
```

**逐文件替换**（每个文件顶部加 import，然后替换调用）。涉及文件：

- `src/pages/PostList.vue`（约 278, 316, 408, 417 行）
- `src/pages/Content.vue`（约 299, 368, 377, 439, 445, 451 行）
- `src/pages/SettingPage.vue`（约 544, 562, 582, 615 行）
- `src/pages/FavoritePage.vue`（约 246 行）
- `src/pages/HomePage.vue`（约 376 行）
- `src/layouts/AppHeader.vue`（约 192, 199 行）
- `src/components/PostListItem.vue`（约 201, 224, 252, 275 行）
- `src/components/RssItemContextMenu.vue`（约 63, 134 行）
- `src/components/SubSubscriptionItemContextMenu.vue`（约 48 行）
- `src/components/SearchComponent.vue`（如有）

**替换规则：**

- `window.electronAPI.fetchRssIndexList(x)` → `electronClient.fetchRssIndexList(x)`
- `window.electronAPI.openLink(url)` → `electronClient.openLink(url)`
- 其他同理

**例外：** `window.electronAPI?.syncStart?.()` 这种已用可选链的安全调用可保留，但统一改走 electronClient 更一致。

- [ ] **步骤 5：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误。如有 "electronClient 未导入" 错误，补 import。

- [ ] **步骤 6：验证非 Electron 环境不崩溃**

运行：`npx quasar dev`（SPA 模式），访问 <http://localhost:9300>
预期：页面不白屏，console 出现 warn `[electronClient] electronAPI unavailable` 但 UI 显示空状态/错误态。验证后 Ctrl+C。

- [ ] **步骤 7：Commit**

```bash
git add src/services/electronClient.ts src/pages src/components src/layouts
git commit -m "fix: electronClient 返回 noop 代理，25 处 window.electronAPI 统一防护

getClient() 不再 throw，返回安全的 noop 代理（调用时 warn 并返回空响应）。
所有页面/组件直接的 window.electronAPI 调用统一改走 electronClient Proxy，
非 Electron 环境不再崩溃，显示空状态/错误态。"
```

---

### 任务 2.4：路由守卫

**文件：**

- 修改：`src/router/index.ts`

- [ ] **步骤 1：读取当前 router**

运行：`cat src/router/index.ts`

确认是 `createWebHashHistory` + 路由数组，无 `beforeEach`。

- [ ] **步骤 2：添加 beforeEach 守卫**

在 `const router = createRouter({...})` 之后、`export default router` 之前添加：

```ts
// Guard: detect non-Electron environment and warn (don't block — ErrorBoundary handles it)
router.beforeEach((to, _from, next) => {
  if (typeof window !== "undefined" && !window.electronAPI) {
    console.warn(`[router] Navigating to ${to.fullPath} without electronAPI — pages may show empty state`)
  }
  next()
})
```

**注意：** 守卫只 warn 不 block，因为 electronClient 的 noop 代理已让页面能渲染空状态。真正崩溃防护由 ErrorBoundary 兜底。

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 4：Commit**

```bash
git add src/router/index.ts
git commit -m "feat: 添加路由 beforeEach 守卫，非 Electron 环境 warn 提示

导航前检测 electronAPI 可用性，缺失时 console.warn。不阻断导航，
由 ErrorBoundary + electronClient noop 兜底渲染空状态。"
```

---

### 阶段 2 验证关卡

- [ ] **阶段 2 完整验证**

运行：

```bash
npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | wc -l   # 预期: 0
npx vitest run 2>&1 | tail -3                                        # 预期: 测试通过
npx quasar dev  # SPA 模式，访问 localhost:9300，确认不白屏（显示空状态/错误态），Ctrl+C
npx quasar dev -m electron  # Electron 模式，确认正常显示订阅和文章，Ctrl+C
```

**阶段 2 达成标准：** 任何情况下都不白屏，失败显示错误页/空状态。

---

## 阶段 3 · 易用性打磨

### 任务 3.1：引导式空状态

**文件：**

- 修改：`src/pages/HomePage.vue`（空状态分支）

**背景：** 当前空状态已有"欢迎使用 Rss Reader + 添加订阅按钮"，需增强为带推荐源一键添加。

- [ ] **步骤 1：读取当前空状态模板**

运行：`grep -n "暂无订阅\|空状态\|empty\|添加订阅" src/pages/HomePage.vue | head -10`

定位空状态的 `<template>` 块（通常是 `v-if="isEmpty"` 或 `v-else` 分支）。

- [ ] **步骤 2：添加推荐源一键添加卡片**

在空状态模板中，"添加订阅"按钮下方添加推荐源卡片：

```vue
<!-- 推荐源一键添加 -->
<div class="recommended-sources q-mt-lg">
  <p class="text-grey-7 q-mb-sm">或从推荐源开始：</p>
  <div class="row q-gutter-sm justify-center">
    <q-chip
      v-for="source in recommendedSources"
      :key="source.url"
      clickable
      color="primary"
      text-color="white"
      icon="rss_feed"
      :loading="source.loading"
      @click="addRecommended(source)"
    >
      {{ source.name }}
    </q-chip>
  </div>
</div>
```

在 `<script setup>` 中添加：

```ts
interface RecommendedSource {
  name: string
  url: string
  loading?: boolean
}

const recommendedSources = ref<RecommendedSource[]>([
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
])

const addRecommended = async (source: RecommendedSource) => {
  source.loading = true
  try {
    await electronClient.addRssSubscription({ feedUrl: source.url, title: source.name })
    await rssInfoStore.refresh()
    $q.notify({ type: 'positive', message: `已添加 ${source.name}` })
  } catch (e) {
    $q.notify({ type: 'negative', message: `添加失败: ${e instanceof Error ? e.message : e}` })
  } finally {
    source.loading = false
  }
}
```

**注意：** 确认 `electronClient`、`rssInfoStore`、`$q` 在该组件已可用（顶部 import 或 composable）。

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 4：Commit**

```bash
git add src/pages/HomePage.vue
git commit -m "feat: 引导式空状态，添加推荐源一键添加

首次启动（无订阅）显示 Hacker News/BBC/The Verge 推荐源卡片，
点击自动添加并同步，降低首次使用门槛。"
```

---

### 任务 3.2：后台静默同步

**文件：**

- 修改：`src/layouts/AppLayout.vue`（onMounted）

- [ ] **步骤 1：读取当前 AppLayout onMounted**

运行：`grep -n "onMounted\|themeStore\|sync" src/layouts/AppLayout.vue | head`

- [ ] **步骤 2：在 onMounted 添加后台静默同步**

在 `onMounted` 中（themeStore 初始化之后）添加：

```ts
// 后台静默同步（不阻塞 UI）
void (async () => {
  try {
    const result = await electronClient.syncStart()
    // syncStart 可能返回新文章数；若有新内容，刷新未读数并轻量提示
    await rssInfoStore.refresh()
    const newCount = (result as { data?: { newArticles?: number } })?.data?.newArticles
    if (newCount && newCount > 0) {
      $q.notify({
        type: 'positive',
        message: `已同步 ${newCount} 篇新文章`,
        timeout: 3000,
        position: 'bottom-right',
      })
    }
  } catch (e) {
    // 同步失败静默记录，不打扰用户
    console.error('[AppLayout] Background sync failed (silent):', e)
  }
})()
```

**注意：** 确认 `electronClient`、`rssInfoStore`、`$q` 在 AppLayout 可用。`syncStart` 的实际返回结构需对照 `src-electron/electron-preload.ts` 的类型定义调整。

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 4：Commit**

```bash
git add src/layouts/AppLayout.vue
git commit -m "feat: 启动后台静默同步，有新内容轻量 toast 提示

启动后立即显示缓存文章，后台静默 syncAll，有新内容时刷新未读数 +
轻量 toast「已同步 N 篇新文章」。失败静默记录，不弹模态框。"
```

---

### 任务 3.3：快捷键绑定

**文件：**

- 修改：`src/App.vue`（onMounted）

**背景：** 当前 `keyboard.registerShortcuts(...)` 注册到 store，但未绑定 `window.addEventListener('keydown')`。

- [ ] **步骤 1：读取当前 App.vue onMounted**

运行：`sed -n '17,60p' src/App.vue`

确认当前 `onMounted` 调用了 `keyboard.registerShortcuts` 和 `keyboard.registerShortcut`。

- [ ] **步骤 2：添加 window keydown 监听 + onUnmounted 清理**

在 `onMounted` 末尾添加：

```ts
onMounted(() => {
  // ... 原有快捷键注册代码保留 ...

  // 绑定全局 keydown 监听，让快捷键真正生效
  window.addEventListener('keydown', keyboard.execute)
  console.log(`[App] Keyboard shortcuts bound to window (${keyboard.shortcuts.length} shortcuts)`)
})

onUnmounted(() => {
  window.removeEventListener('keydown', keyboard.execute)
})
```

**注意：** 确认 `onUnmounted` 已从 vue 导入（`import { onMounted, onUnmounted, ref } from 'vue'`）。`keyboard.execute` 是 `useKeyboard()` 返回的方法。

- [ ] **步骤 3：验证快捷键生效**

运行：`npx quasar dev -m electron`（前台）
预期：日志出现 `[App] Keyboard shortcuts bound to window (N shortcuts)`。按 Ctrl+Shift+? 应弹出快捷键帮助对话框。Ctrl+D 切换暗色模式。验证后 Ctrl+C。

- [ ] **步骤 4：Commit**

```bash
git add src/App.vue
git commit -m "fix: 绑定快捷键到 window keydown 监听，真正生效

此前快捷键定义并注册到 store，但从未 addEventListener，Ctrl+S/F/N/D/R
全部失效。现在绑定 window keydown，onUnmounted 清理。"
```

---

### 任务 3.4：搜索入口统一

**文件：**

- 修改：`src/layouts/AppHeader.vue`（顶部加搜索图标）

- [ ] **步骤 1：读取当前 AppHeader**

运行：`sed -n '1,50p' src/layouts/AppHeader.vue`

确认标题栏结构（自定义 frame=false 的标题栏）。

- [ ] **步骤 2：在标题栏添加搜索图标按钮**

在标题栏的按钮区（close/minimize 按钮附近）添加搜索图标：

```vue
<q-btn flat round dense icon="search" @click="toggleSearch" class="q-mr-xs">
  <q-tooltip>搜索 (Ctrl+F)</q-tooltip>
</q-btn>
```

在 `<script setup>` 添加 toggle 逻辑（emit 或直接控制搜索框显隐）：

```ts
import { ref } from 'vue'

const showSearch = ref(false)
const toggleSearch = () => {
  showSearch.value = !showSearch.value
  // 可 emit 事件让父组件打开搜索，或直接在此渲染搜索框
}
```

**注意：** 根据现有搜索实现（SearchComponent 在 AppDrawer 内），最简单的方式是 emit 一个 `open-search` 事件，由 AppLayout 接收后打开一个全局搜索 dialog 或展开 drawer。如果项目已有 SearchComponent，可将其提为全局弹窗。

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 4：Commit**

```bash
git add src/layouts/AppHeader.vue
git commit -m "feat: 顶部标题栏添加搜索图标，侧边栏开闭都能搜索

此前搜索只在 AppDrawer 内，关闭侧边栏后无入口。现在顶部加搜索图标，
点击展开搜索，Ctrl+F 也可唤起。"
```

---

### 任务 3.5：阅读进度持久化

**文件：**

- 修改：`src/pages/Content.vue`

- [ ] **步骤 1：读取当前 Content.vue 滚动相关逻辑**

运行：`grep -n "scroll\|onMounted\|guid\|postId" src/pages/Content.vue | head -15`

- [ ] **步骤 2：添加滚动位置保存与恢复**

在 `<script setup>` 中添加：

```ts
const STORAGE_KEY_PREFIX = 'rss-reader:scroll:'

const saveScrollPosition = () => {
  if (currentPostId.value) {
    const y = window.scrollY
    localStorage.setItem(STORAGE_KEY_PREFIX + currentPostId.value, String(y))
  }
}

const restoreScrollPosition = () => {
  if (currentPostId.value) {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + currentPostId.value)
    if (saved) {
      const y = parseInt(saved, 10)
      // nextTick 确保内容渲染后再滚动
      nextTick(() => window.scrollTo(0, y))
    }
  }
}
```

在文章加载完成的逻辑后调用 `restoreScrollPosition()`。添加滚动监听（节流保存）：

```ts
onMounted(() => {
  window.addEventListener('scroll', throttle(saveScrollPosition, 500))
})
onUnmounted(() => {
  saveScrollPosition() // 离开前最后保存一次
  window.removeEventListener('scroll', throttle(saveScrollPosition, 500))
})
```

**注意：** 需 `import { nextTick, onMounted, onUnmounted } from 'vue'`。`throttle` 可用 lodash 或手写简易版：

```ts
const throttle = <T extends (...args: never[]) => void>(fn: T, ms: number) => {
  let last = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - last >= ms) {
      last = now
      fn(...args)
    }
  }
}
```

`currentPostId` 需替换为 Content.vue 中实际的文章标识变量（从路由参数或 props 获取的 guid）。

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | head`
预期：无源码错误

- [ ] **步骤 4：Commit**

```bash
git add src/pages/Content.vue
git commit -m "feat: 阅读进度持久化，重开文章恢复滚动位置

按文章 guid 存储滚动位置到 localStorage，重新打开文章时恢复到上次
阅读位置。滚动时节流保存，离开前最后保存一次。"
```

---

### 阶段 3 验证关卡

- [ ] **阶段 3 完整验证**

运行：

```bash
npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | wc -l   # 预期: 0
npx vitest run 2>&1 | tail -3                                        # 预期: 测试通过
npx quasar dev -m electron  # 前台验证：
# - 空数据库启动显示引导页 + 推荐源（可临时清空测试，或新增空 DB 验证）
# - 有数据启动瞬间显示文章列表，后台同步后 toast 提示新文章
# - Ctrl+S/F/N/D/R/Shift+? 快捷键全部生效
# - 关闭侧边栏后顶部搜索图标可用
# - 打开文章滚动后离开再回来，位置恢复
# 验证后 Ctrl+C
```

**阶段 3 达成标准：** 流程顺畅——引导式空状态、后台静默同步、快捷键生效、搜索随时可用、阅读进度持久化。

---

## 最终验证

- [ ] **全量验证**

```bash
# 1. TypeScript 源码 0 错误
npx tsc --noEmit 2>&1 | grep -v "test/" | grep "error TS" | wc -l

# 2. 测试全通过
npx vitest run 2>&1 | tail -5

# 3. 开发模式启动无报错
npx quasar dev -m electron  # 前台，确认后 Ctrl+C

# 4. 生产构建可启动（关键——此前致命 bug）
npx quasar build -m electron
# 找到打包产物并启动验证（产物在 dist/electron 或 .quasar/electron）

# 5. 数据保留
sqlite3 "/Users/kai/Library/Application Support/sqlite.db" \
  "SELECT 'folders:'||count(*) FROM folder_info UNION ALL \
   SELECT 'feeds:'||count(*) FROM rss_info UNION ALL \
   SELECT 'posts:'||count(*) FROM post_info;"
# 预期: folders:2 / feeds:6 / posts:106

# 6. Electron E2E（用 _electron.launch 验证 UI 渲染）
# 参考已有 playwright-electron.ts
```

- [ ] **最终 commit（如有未提交的验证修复）**

```bash
git add -A
git commit -m "chore: 阶段 3 验证修复" || echo "无需提交"
```

---

## 风险提示

1. **initDB 并行化（任务 1.6）**：必须从原代码提取**实际**索引 SQL，不可编造。先 `grep -A 60 "async init"` 确认所有语句。
2. **electronClient noop 代理（任务 2.3）**：返回 `{ data: undefined, error: ... }` 需匹配各调用方期望的响应结构。如果某些调用方期望 `undefined` 而非对象，需调整。
3. **store init 改造（任务 2.1）**：可能有多个组件依赖顶层 `refresh()` 副作用。搜索 `useRssInfoStore` 所有调用方确认。
4. **快捷键 Ctrl+R（任务 3.3）**：`window.location.reload()` 在 Electron 中会重新加载渲染器，确认不会与 dev server 冲突。
5. **生产构建验证**：任务 1.1 的 loadFile 路径 `path.join(__dirname, "index.html")` 需确认 Quasar 打包后 index.html 的实际位置（可能在 dist/electron/UnPackaged 或类似）。
