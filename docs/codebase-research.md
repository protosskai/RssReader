# RSS Reader 代码库研究

> 研究基线：2026-07-11 工作区当前内容（含尚未提交的源码改动）。本文以可执行配置、导入关系和实际调用为证据；不以历史文档或目录名称推断。本文不提出目标架构。

## 一、运行、构建、测试与交付

| 目的 | 入口/命令 | 已验证现状 | 证据 |
| --- | --- | --- | --- |
| 安装 | `npm install` 或 Yarn | `package-lock.json` 与 `yarn.lock` 并存；Electron 打包阶段实际选择 Yarn。 | `package.json`；`npm run build:electron` 输出 |
| 浏览器开发 | `npm run dev` | 执行 `quasar dev`，可渲染 UI，但没有 Electron preload，`electronClient` 返回安全 noop。 | `package.json`；`src/services/electronClient.ts:6-16,117-136` |
| Electron 开发 | `npm run dev:electron` | 执行 `quasar dev -m electron`，这是具有本地数据能力的正常启动路径。主进程等待 `APP_URL`（默认 `http://localhost:9000`）后创建窗口。 | `package.json`；`src-electron/electron-main.ts:257-310,402-1105` |
| SPA 构建 | `npm run build` | 已成功，输出 `dist/spa`。 | `package.json`；`quasar.config.js:48-67`；研究期间的实际运行结果 |
| Electron 构建 | `npm run build:electron` | UI、主进程和 preload 都已编译，但最终包失败：产物目录执行 `yarn install --production` 时 Node 22.22.0 不满足 engines 的 `^14.19 || ^16 || ^18`。 | `package.json:23-25`；`quasar.config.js:168-192`；实际运行结果 |
| 单元测试 | `npm test` | 5 文件、24 断言通过；仅包含 `test/**/*.{test,spec}.ts`，明确排除 `test/__archived-old-tests/**` 和 `test/e2e/**`。 | `package.json`；`vitest.config.ts:5-25`；实际运行结果 |
| 覆盖率 | `npm run test:coverage` | 通过；报告总计 41.01% 行/语句覆盖，但只纳入 7 个实际被测源文件，不能代表全仓库。 | `vitest.config.ts:10-20`；实际运行结果 |
| E2E | `npx playwright test` | 配置要求外部已运行的 `http://localhost:9300`，没有 `webServer`。页面实际可以渲染，但断言要求 HTML 大于 50KB，实际约 21KB，故失败。 | `playwright.config.ts`；`test/e2e/check-render.spec.ts:3-24`；实际运行结果 |
| 真实 RSS 测试 | `npm run test:real-rss` | 失败：脚本引用的 `scripts/real-rss-e2e.ts` 不存在。 | `package.json:10`；`rg --files scripts`；实际运行结果 |
| 生产托管 | `npm run serve` | 不可用：当前 Quasar CLI 将 `serve` 解释为缺失的 App Extension 后退出。 | `package.json:13`；实际运行结果 |
| 发布/部署 | 无 | 没有 CI、发布、签名、公证、上传或自动更新配置；Electron bundler 为 `packager`，签名字段未设置。 | `quasar.config.js:168-192`；仓库中不存在 `.github` 工作流 |

`tsc --noEmit` 当前失败，原因不是核心应用类型本身的单一错误：默认 include 把 `dist/ssr/render-template.js`、`scripts/*.ts` 和测试也编入；已见 SSR 严格模式 `with`、三个 E2E 脚本 `env` 类型、以及 `ipc-envelope.test.ts` 的 `unknown` 泛型错误。见 `tsconfig.json`、`scripts/deep-ui-e2e.ts`、`scripts/electron-e2e-smoke.ts`、`scripts/product-qa-checklist.ts` 与 `test/unit/ipc-envelope.test.ts`。

## 二、顶层目录的实际职责

| 路径 | 经代码验证的职责 |
| --- | --- |
| `src/` | Vue/Quasar 渲染进程：路由、页面、布局、Pinia 状态、UI 组件和经 preload 暴露的 IPC 客户端。Quasar 依次执行 `pinia`、`axios`、`router-bridge` boot 文件；渲染根组件为 `App.vue`。见 `quasar.config.js:20-24`、`src/App.vue`、`src/boot/*.ts`。 |
| `src-electron/` | Electron 主进程、preload、SQLite 持久化、RSS/OPML 解析、网络获取、同步服务与 DI 容器。`electron-main.ts` 是主进程入口；`electron-preload.ts` 是独立的 preload 入口，而非主进程的普通导入模块。 |
| `src-ssr/` | Quasar 自动生成风格的 Express SSR server/middleware 模板；当前构建和脚本未选择 SSR 模式，主产品运行路径不调用它。见 `src-ssr/server.ts`、`quasar.config.js`。 |
| `test/unit/` | 5 个活动 Vitest 测试：解析、IPC envelope、阅读状态、设计令牌。 |
| `test/__archived-old-tests/` | 被 Vitest 明确排除的旧测试，不能作为当前回归保护。 |
| `test/e2e/` | Playwright 页面渲染检查；未自带启动服务。 |
| `scripts/` | 人工/本地 QA 与 Electron 烟测工具，未接入 `package.json`（除缺失的 real RSS 脚本引用）。 |
| `docs/superpowers/`、`DESIGN.md`、审计 JSON/报告 | 既有设计和审计工件，不是程序运行时依赖。 |
| `coverage/`、`dist/`、`.quasar/` | 构建/覆盖率生成物；不要把它们当作当前源代码。 |

### 运行时入口图（补充）

- 渲染路径为 Quasar 应用根 → `src/App.vue` → Vue Router → 动态导入的 `AppLayout` 与页面。`App.vue` 还包裹 `ErrorBoundary`、初始化主题和全局键盘快捷键；其中同步快捷键会动态导入 `electronClient` 并调用 `syncStart()`，刷新快捷键会动态导入 `rssInfoStore` 并调用 `refresh()`。因此它是除路由外的实际业务入口。见 `src/App.vue:1-96`、`src/router/routes.ts`。
- Electron 路径为主进程入口 → `BrowserWindow`（指定 preload）→ `contextBridge.exposeInMainWorld('electronAPI', ...)` → 渲染端 `electronClient`。浏览器开发或 SSR 中缺少 preload 时，客户端代理返回默认/noop 结果；`App.vue` 会显示浏览器预览横幅。见 `src-electron/electron-main.ts:312-395`、`src-electron/electron-preload.ts:1-201`、`src/services/electronClient.ts`。

## 三、核心业务流程

### 1. 应用启动与首次同步

1. Electron 在 `app.whenReady()` 中启动数据库初始化 Promise、注册 IPC，再等待开发服务器（仅开发模式）并创建无边框窗口。数据库 Promise 不阻塞窗口创建或 handler 注册，最终才在 `whenReady` 回调末尾等待；因此渲染端首次 IPC 可以与初始化并发。`BrowserWindow` 开启 `contextIsolation`、关闭 `nodeIntegration`、开启 sandbox。见 `src-electron/electron-main.ts:312-395,402-418,1078-1105`。
2. 数据库初始化打开 `{appdata-path}/sqlite.db`，启用外键、WAL 与 5 秒 busy timeout，建表、索引、FTS5 及迁移。见 `src-electron/infrastructure/persistence/SqliteHelper.ts:169-200,204-338,459-515`。
3. 初始化完成后读取 `sync-config.json`；三秒后调用 `startAutoSync()`，但仅当 `config.enabled` 为真才启动。见 `src-electron/services/SyncManager.ts:67-118,270-299`。
4. 渲染侧 `AppLayout.onMounted` 初始化 `rssInfoStore` 后仍会无条件调用 `electronClient.syncStart()` 并刷新订阅列表；这是独立于自动同步设置的一次启动后台同步。`App.vue` 注册的全局同步快捷键也会直接调用同一 IPC。见 `src/layouts/AppLayout.vue:74-87`、`src/App.vue:46-83`。
5. 主进程还注册了进程级错误副作用：未处理 rejection 会弹出错误框；未捕获异常会弹框，并在一秒后退出应用。见 `src-electron/electron-main.ts:24-53`。

### 2. 新增订阅与初始同步

`AddSubscriptionDialog`/首页推荐源 → `rssInfoStore.addRssSubscription()` → preload `secureInvoke('rss:addRssSubscription')` → `wrapHandler` 校验 URL/标题/文件夹 → `ArticleService.addFeed()`。

服务先按 URL 查重，再用 `getUrl()` 取得 XML、`RssParserAdapter.parseString()` 解析元数据，生成 `feed_${Date.now()}_${random}`，保存 `rss_info`（不存在的文件夹会先创建），随后尝试首次 `syncFeed()`；首次同步失败只记录日志，不回滚已新增订阅。见 `src/stores/rssInfoStore.ts:124-134`、`src-electron/electron-preload.ts:80-195`、`src-electron/electron-main.ts:422-448`、`src-electron/application/services/ArticleService.ts:189-232`、`src-electron/infrastructure/persistence/ArticleRepositoryImpl.ts:439-496`。

OPML 导入是另一条写入链：文件选择框 → `fs.promises.readFile` → `OpmlParserAdapter` → handler 逐条调用 `ArticleService.addFeed()`，每条都会走上述联网、建订阅和首次同步流程。handler 只处理根 RSS，以及文件夹的第一层子 RSS；解析器保留的更深层 `children` 不会继续遍历。当前没有真正的 OPML 导出：`rss:dumpFolderToDb` 是兼容性 no-op，`rss:loadFolderFromDb` 只返回文件夹 JSON。见 `src-electron/electron-main.ts:463-614`、`src-electron/infrastructure/parsing/OpmlParserAdapter.ts`。

### 3. 同步文章

手动同步（首页/设置/IPC）、feed 刷新或定时同步 → `SyncManager.syncAll()`（每批最多 5 个源）或 `ArticleService.syncFeed(id)` → `RssParserAdapter.parseUrl()`；失败时才回退到 `NetUtil.getUrl()+parseString()` → 将条目转换为 `{title, link, desc, read:false, author, updateTime, guid}` → `SqliteUtil.syncRssPostList()`。

持久化以文章 GUID 去重，只插入当前 feed 中尚不存在的 GUID；但数据库 schema 对 `guid` 另有全局 UNIQUE 约束，跨 feed 的同 GUID 插入会失败并被本次循环记录后跳过。文章 HTML 内容先 Base64 编码再写入 `post_info`。见 `src-electron/services/SyncManager.ts:124-248`、`src-electron/application/services/ArticleService.ts:291-338`、`src-electron/infrastructure/persistence/sqlite.ts:750-835`、`src-electron/infrastructure/persistence/SqliteHelper.ts:230-250`、`src-electron/util/string.ts:24-30`。

### 4. 列表、正文、已读与收藏

订阅树来自 `rss:getRssInfoListFromDb`：主进程逐个文件夹取 feeds 并映射为 legacy `RssFolderItem`。点击 feed 后，`PostList.getPostListById()` 先读本地缓存；若缓存非空，立即显示并在后台刷新；若空或用户强制刷新，先同步后查询。见 `src-electron/electron-main.ts:615-705`、`src/pages/PostList.vue:304-403`。

打开正文使用 query 中的 `postId`（允许 URL 形 GUID），`Content.getContentById()` 经 legacy `rss:queryPostContentByGuid` 读取完整正文，再以 `setReadStatus(id, true)` 幂等标已读，避免列表点击与打开正文的 toggle 翻转竞态。正文在模板中使用 `sanitizeHtml()` 后呈现。见 `src/router/routes.ts:19-35`、`src/pages/Content.vue:120-132,279-344`、`src/utils/sanitize.ts:8-48`、`src-electron/application/services/ArticleService.ts:93-131`。

收藏同时存在两条兼容路径：新版 `article:toggleFavorite` 和旧版 `article:addFavoritePost/removeFavoritePost`。旧版已改为幂等 set true/false；`FavoritePage` 仍通过 `favoriteStore` 的旧 API 路径加载和切换。见 `src-electron/electron-main.ts:779-785,926-981`、`src/stores/favoriteStore.ts:28-116`、`src/pages/FavoritePage.vue:77-178`。

## 四、状态、数据与副作用

### 渲染状态

- 生产主状态是 `rssInfoStore`（订阅树/统计）、`favoriteStore`、`searchStore`、`themeStore`、`readingStore`、`syncProgressStore`、`systemDialogStore`，以及经 `useKeyboard()` 被 `App.vue` 使用的 `keyboardStore`。其中 `rssInfoStore` 被 14 个产品源文件导入，是 UI 订阅领域中心。见 `src/stores/*.ts`、`src/App.vue` 与静态导入统计。
- `localStorage` 承载主题（`themeMode`）、搜索历史、阅读进度（`readingProgress`）、阅读偏好（`readingSettings`）、正文大小（`contentFontSize`）和一般设置（`appSettings`）。见 `src/stores/themeStore.ts`、`src/stores/readingStore.ts`、`src/stores/searchStore.ts`、`src/composables/useReadingExperience.ts:240-300`、`src/pages/SettingPage.vue:534-613`。
- 自动同步配置不在 SQLite 或 `localStorage`，而是同步服务以同步文件 I/O 读写 `{userData}/sync-config.json`；`enabled`、`interval`、`syncOnStartup`、`notification` 会参与运行时行为。`backgroundSync` 与 `systemTray` 虽在设置页展示并随整个 config 保存，但在 `SyncManager` 中只出现在类型/默认值，未见读取分支。见 `src-electron/services/SyncManager.ts:6-118,270-305`、`src/pages/SettingPage.vue:249,524-525,742-743`。
- `articleStore/feedStore/folderStore/loadingStore` 及 `useArticle/useFavorite/useSubscription/useSync/useTheme/useUIState` 没有来自产品组件的导入；其中 `useArticle` 只连接 `articleStore`，`useLoading` 只连接 `loadingStore`，但这些链本身也未接入产品组件。这是未接入的并行状态/API 层，不是运行时的第二套业务流程。见各文件的静态导入点。

### 主进程状态与外部依赖

- SQLite 是唯一持久化数据库；没有 Redis、远程数据库、消息队列或事件总线进程。`ArticleService` 内部 `EventEmitter` 仅供本进程监听，现有代码没有订阅者。见 `ArticleService.on/off/emitEvent`（`src-electron/application/services/ArticleService.ts:60-81`）与全仓库引用。
- 内存 `CacheManager` 是 URL → 字符串的单例缓存，默认 5 分钟、最多 100 条、每 30 分钟清理；不落盘。见 `src-electron/infrastructure/network/CacheManager.ts:12-71,161-235`。
- 第三方网络：`getUrl()` 优先 Electron `net.request`、不可用时 Axios 回退；但常规 `ArticleService.syncFeed()` 会先让 `rss-parser.parseURL()` 直接请求，只有失败后才走 `getUrl()+parseString()`。因此正常同步不经过 `NetUtil` 的内存缓存、内容大小限制和编码处理。OPML 用 `opml-to-json`；外链交给 `shell.openExternal`；同步通知使用 Electron `Notification`。见 `NetUtil.ts`、`RssParserAdapter.ts`、`OpmlParserAdapter.ts`、`ArticleService.ts:291-338`、`electron-main.ts:377-395`、`SyncManager.ts:258-268`。
- `axios` boot 文件创建的 `https://api.example.com` 客户端只被注册到 Vue 全局属性，当前未发现渲染业务使用；同一 Axios 包仍被主进程 `NetUtil` 用作网络回退。`moment`、`@vueuse/core`、`fast-xml-parser` 没有源码导入。见 `src/boot/axios.ts`、`src-electron/infrastructure/network/NetUtil.ts` 和依赖导入搜索。

## 五、隐含规则与兼容面

1. 文件夹名称是唯一、平面化的业务键；模型虽有 `parentId`，但 schema 的 `parent_id` 未建外键且 UI 明确拒绝嵌套移动。见 `SqliteHelper.ts:215-220`、`models.ts:112-118`、`rssInfoStore.moveFolder()`。
2. 默认文件夹为中文字符串 `默认`；未传文件夹时 `ArticleService.addFeed()` 使用它。删除全部数据时设置页特意保留该文件夹。见 `ArticleService.ts:189`、`SettingPage.vue:683-690`。
3. GUID 在整个数据库全局唯一而不是 per-feed。删除 feed 的实际路径会在同一事务中先显式删 `post_info`、再删 `rss_info`；schema 也为该关系设置了 `ON DELETE CASCADE`。GUID 可为 URL，因此路由使用 query 参数且 IPC 的 GUID 验证与普通 ID 不同。见 `SqliteHelper.ts:230-250`、`ArticleRepositoryImpl.ts:498-516`、`routes.ts:19-35`、`electron-main.ts:156-180`。
4. `post_info.content` 在当前写路径中为 Base64 文本，FTS 对同一字段建索引。搜索在 FTS **无结果**时回退到仅匹配标题/作者的 `LIKE`；FTS 查询抛错则直接返回失败，并不回退。因此内容编码调整会影响正文读取、FTS 索引和历史数据兼容，不能据此推断 `LIKE` 能搜索正文。见 `sqlite.ts:155-198,991-1162`、`SqliteHelper.ts:296-330`。
5. IPC 的可用通道被 preload 白名单限制，主进程错误被 `wrapHandler` 变成 `{error}`，preload 再解封装；legacy 方法仍返回 `ApiResponse<T>`，新方法返回直接数据。这个双重 envelope 和双 API 是当前 UI 兼容契约。见 `electron-preload.ts:12-104,110-201`、`ErrorMsg.ts:68-144`。

## 六、复杂/高频/高风险区域

| 区域 | 代码证据 | 风险原因 |
| --- | --- | --- |
| 主进程 IPC | `src-electron/electron-main.ts`（1118 行，45 个 `ipcMain.handle` 调用） | 输入校验、45 条 handler、legacy/new 映射、窗口生命周期和启动逻辑集中于同一文件。 |
| SQLite 访问 | `SqliteHelper.ts`、`sqlite.ts`（1171 行）、`ArticleRepositoryImpl.ts`（612 行） | schema、迁移、FTS、队列、锁、编码和 SQL 分散；新旧 storage API 并存。 |
| RSS 订阅树 | `rssInfoStore.ts`、`SubscriptionList.vue`、多个 dialog/context menu | 同时处理 legacy API、UI 刷新、统计和“编辑=删除后新增”的数据语义。 |
| 正文/阅读体验 | `Content.vue`（617 行）、`useReadingExperience.ts`、`readingStore.ts` | 外部 HTML、已读状态、收藏、滚动位置、快捷键与 localStorage 互相交织。 |
| 搜索 | `SearchComponent.vue`（1319 行）、`searchStore.ts`、`sqlite.ts.searchPosts()` | 组件承载 UI/键盘/路由/历史/收藏，底层有 FTS 和 LIKE 回退。 |
| 同步 | `SyncManager.ts`、`ArticleService.syncFeed()`、`NetUtil.ts` | 定时器、渲染端进度轮询、批量并发、网络超时、写库、文件配置与桌面通知形成跨进程可见的副作用；同步业务代码本身运行在主进程，并非额外工作线程。 |

## 七、架构模式（实际已存在）

- **Electron 进程边界**：renderer 只见 `window.electronAPI`；preload 使用 `contextBridge` 和白名单，主进程执行数据与系统能力。这是已实现的进程适配层；代码没有独立 HTTP 后端，故不把它额外定性为 BFF 架构约束。见 `electron-preload.ts`、`electron-main.ts`。
- **Ports-and-adapters 的局部实现**：`ArticleRepository`/`FeedRepository`/`FolderRepository` 是 port，`Sqlite*Repository` 是 adapter，`DIContainer` 组装单例服务。见 `domain/repositories/Interfaces.ts`、`infrastructure/persistence/ArticleRepositoryImpl.ts`、`infrastructure/di/Container.ts`。
- **兼容性防腐层**：同一服务被 legacy RSS 形状与新版 Article/Feed/Folder 形状映射，`electronClient` 在浏览器/SSR 时提供 noop。见 `electron-main.ts:420-710,712-1076`、`electronClient.ts`。
- **缓存优先/后台刷新**：文章列表先展示本地 SQLite，再后台同步后重新查询。见 `PostList.vue:319-345`。
- **单例与共享可变状态**：`SqliteHelper`、`SqliteUtil`、`CacheManager`、`SyncManager`、DI container 都为进程级单例。见各 `getInstance()`/`getContainer()`。

## 八、已识别问题（非改造方案）

- 未将“没有文件级循环依赖”列为结论：仓库没有受版本控制的依赖图/SCC 分析脚本，不能以一次性搜索结果替代可复现证据。已能直接证实的是层间依赖不纯：`ArticleService` 直接导入 network/parser/shared infrastructure，`ArticleRepository` interface 反向引用 persistence 的 `PostInfoItem` 类型。见 `ArticleService.ts:18-20`、`Interfaces.ts:23-24`。
- `SqliteHelper.transaction()` 调用 `begin/run/commit` 时，每个 SQL 操作都单独经过 `OperationQueue`；事务区间没有由同一个队列任务整体占有，且 `inTransaction` 是全局布尔值。`deleteFeed()` 是已使用该事务 API 的路径，因此并发改动存在高风险。见 `SqliteHelper.ts:68-120,400-453`、`ArticleRepositoryImpl.ts:498-506`。
- `SyncManager.newArticlesCount` 每个成功 source 固定加 1，并非插入文章数；通知“获取到 N 篇新文章”可能不准确。见 `SyncManager.ts:188-198,231-238`。
- `ArticleService.setReadStatus()` 调用的 feed unread 增减实现为空操作，未读数实际靠 SQL 聚合；接口语义和实现不一致但最终数据库计数不受影响。见 `ArticleService.ts:117-123`、`ArticleRepositoryImpl.ts:523-534`。
- 文件夹删除依赖 `SqliteUtil.deleteFolderInfo()` 的显式删除，SQLite 对 `rss_info.folder_id` 的 `ON DELETE CASCADE` 会删除订阅并进一步删除文章；UI 确认文案应视为数据破坏性契约。见 schema 和 `SqliteUtil.deleteFolderInfo()`。
- `FavoritePage` 在打开或外部打开前只修改本地 `post.read`。其中“打开文章”随后路由到 `Content.vue`，仅在正文读取成功且原记录未读时才异步写入数据库；“外部打开”没有后续数据库写入。见 `FavoritePage.vue:127-168`、`Content.vue:279-344`。
- 设置页中的 `backgroundSync`、`systemTray` 虽会保存到同步配置，但 `SyncManager` 没有行为读取点；不能把它们当作已实现的同步能力。见 `SyncManager.ts:6-118,270-305`、`SettingPage.vue:249,524-525,742-743`。
- 运行中存有旧路径名称的 coverage、历史 commit 和 `CLAUDE.md`；例如它提及 `src-electron/storage`/`rss`/`net`，而实际运行代码在 `infrastructure`。后续规格必须以当前导入图为准。

详见配套文档：[当前架构](architecture/current-architecture.md)、[依赖](architecture/current-dependencies.md)、[业务能力](architecture/business-capabilities.md)、[重构风险](architecture/refactoring-risks.md)。
