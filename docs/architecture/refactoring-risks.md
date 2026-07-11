# 当前重构风险与兼容约束

> 本文记录修改当前实现时的风险事实，不提供重构方案。优先级按数据丢失、用户可见错误、跨进程契约破坏和测试缺口综合排序。

## P0：不可在缺少回归验证时修改

| 区域 | 证据 | 风险与必须保持的行为 |
| --- | --- | --- |
| IPC envelope + preload | `src-electron/electron-preload.ts:68-104`；`src/common/ErrorMsg.ts:68-144`；`test/unit/ipc-envelope.test.ts` | 主进程 `wrapHandler` 的 `{data}` 与 `{error}`、legacy `ApiResponse<T>`、新 API 直接值三种形状共存。任何改变必须保证 `secureInvoke` 不会将 `{data: ApiResponse}` 误传给 `unwrapOrThrow`。 |
| 文章打开的已读语义 | `Content.vue:327-338`；`ArticleService.setReadStatus()`；`test/unit/set-read-status.test.ts` | 打开文章必须是 `setReadStatus(id,true)`，而不是 toggle；多次/并发打开不得把文章翻回未读。 |
| SQLite schema、迁移和内容编码 | `SqliteHelper.ts:136-152,204-338,459-515`；`sqlite.ts:155-198` | 用户数据库在应用数据目录中持久存在；`guid` 唯一、外键级联、favorite migration、FTS trigger 和 Base64 内容均需向后兼容。不得修改已有 migration 的含义。 |
| 删除 feed/folder | `ArticleRepositoryImpl.ts:498-506`；schema 外键；`SettingPage.vue:658-720` | 删除 feed 会在事务中删除文章和订阅；删除 folder 触发级联。编辑订阅目前也使用删除后新增，改动前必须明确文章保留/丢失契约。 |
| Renderer-main 安全边界 | `electron-main.ts:71-228,312-395`；`electron-preload.ts:12-66` | context isolation、sandbox、无 nodeIntegration、channel whitelist、URL 校验、内容/分页上限与外链拦截不能被 UI 便利性绕过。 |

## P1：高复杂度或高耦合

| 区域 | 具体风险 | 证据 |
| --- | --- | --- |
| `electron-main.ts` | 1118 行内混合启动、窗口、安全、所有 IPC 和 legacy DTO 转换；改动容易同时影响开发启动与生产加载。 | 历史提交中修改频率最高（39 次）。 |
| `sqlite.ts` + repository | 旧 `StorageUtil`、新 repository、手工 SQL、Base64 与 FTS 查询并存；同一行为可能有两个实现。 | `sqlite.ts` 1171 行；`ArticleRepositoryImpl.ts` 612 行；`SqliteUtilV2.ts` 仍在仓库但运行主链未引用。 |
| SQLite transaction | `transaction()` 不是单个 queue work item；`begin/run/commit` 可在队列间交错，`inTransaction` 是单例全局状态。 | `SqliteHelper.ts:68-120,400-453`。 |
| SyncManager | 同时涉及 5 并发、状态对象原地修改、timer、文件 config、Notification 与 API 回调。 | `SyncManager.ts:37-330`。 |
| 搜索组件 | `SearchComponent.vue` 1319 行，含交互、键盘、路由、历史与收藏；底层 FTS/LIKE fallback 复杂。 | 文件大小与 `SearchComponent` 调用。 |
| 正文阅读 | 外部 HTML 消毒、阅读进度、本地偏好、快捷键、收藏、路由和已读并存。 | `Content.vue`、`sanitize.ts`、`readingStore.ts`。 |

## P1：行为不一致或隐藏副作用

- `AppLayout.onMounted` 不管同步配置是否 enabled 都请求 `syncStart()`；不能把“关闭自动同步”简单理解为“启动绝不联网”。见 `AppLayout.vue:78-87`。
- `ArticleService.addFeed()` 初始同步失败仍保留订阅；调用方需将“订阅已保存”和“已获得文章”分开处理。见 `ArticleService.ts:219-231`。
- `SyncManager` 对成功 feed 固定 `newArticlesCount += 1`；通知不能被解释为精确新增文章数。见 `SyncManager.ts:188-198`。
- 未读数按 SQL `post_info.read` 聚合，`FeedRepository.increment/decrement/resetUnreadCount` 实际 no-op；切勿依赖它们维护内存计数。见 `ArticleRepositoryImpl.ts:523-534`。
- `FavoritePage` 的开文/外链只把 `post.read` 改为 true，没有 IPC 持久化；如果修正，需验证收藏列表、文章列表与 unread 统计的刷新时机。见 `FavoritePage.vue:127-168`。
- `SettingPage` 中很多选项只是 localStorage UI 数据；不要假定 `autoStart`、tray、语言、通知细项、缓存限制已有运行时承诺。见 `SettingPage.vue:507-528,589-613`。

## P2：重复、上帝类与共享状态

| 问题 | 实证 |
| --- | --- |
| 双 API 形状 | legacy RSS DTO 与 Article/Feed/Folder DTO，且主进程维护两个 handler 族。`models.ts`、`electron-main.ts:420-1076`。 |
| 双 store/composable | `article/feed/folder/loading` stores 与 `useArticle/useFavorite/useSubscription/useSync/useTheme/useUIState` 未由产品组件使用；与正在使用的 stores 重叠。见静态使用搜索。 |
| 双主题状态 | `themeStore` 与 `useTheme` 均读写 `themeMode` 并操作 DOM class。 |
| 双搜索状态 | `searchStore` 与 `useSearch` 都维护 query/results/history。 |
| 分散 direct IPC | 多个 pages/components 绕过 store 直调 `electronClient`，导致刷新、错误呈现、乐观更新标准不一致。 |
| 共享可变单例 | `SqliteHelper`、`SqliteUtil`、`CacheManager`、`SyncManager`、DI container，以及 `window.__APP_ROUTER__`；单元测试需要隔离/重置策略。 |

## 测试保护边界

### 现有可靠保护

- RSS/Atom parser：4 测试；
- OPML adapter：3 测试；
- IPC envelope 规则：7 测试，但 `secureInvoke` 逻辑在测试内镜像实现，非直接导入 preload；
- `ArticleService.setReadStatus`：4 服务行为 + 2 源码结构测试；
- 设计 CSS token：4 结构测试。

### 未被安全覆盖的区域

SQLite migration/FTS/事务、所有真实 IPC handler、preload 真正运行时、`SyncManager`、`NetUtil` 的超时/缓存/编码路径、大多数页面与组件、文件删除级联、Settings 清空、自动同步、通知、OPML 导入写库、Electron 生产打包均没有可通过的自动回归保护。

覆盖率虽报告 41.01%，只显示 7 个被执行源文件；而 `vitest.config.ts` 声明的 include 更大，未执行文件未出现在汇总明细中。因此不能将 41% 作为全代码可靠覆盖程度。

### 当前无法安全依赖的测试入口

- `npm run typecheck` 失败（dist/scripts/test inclusion）；
- `npm run test:real-rss` 指向不存在脚本；
- `npm run serve` 不可用；
- Playwright 无 server orchestration，且 HTML 大小阈值已经失真；
- `npm run build:electron` 在 Node 22 上因 engines/Yarn 安装失败，尚无可验证的最终安装包。

## 后续规格必须声明的兼容项

1. 保持 hash 路由和 `/content?rssId=&postId=` 形式；URL 型 GUID 不能安全地作为普通 path segment。
2. 继续支持 preload whitelist 中已有 channel，或提供迁移期兼容；尤其 legacy RSS、收藏与文件夹 channel。
3. 保持 `ApiResponse` 的 legacy 成功/错误语义和 preload 的 envelope 解封装规则。
4. 保持文章 GUID 全局唯一、重复同步不插入既有 GUID、删除订阅级联删除文章，除非规格明确迁移数据。
5. 保持正文加载时的幂等已读，而不是 toggle。
6. 保持非 Electron 预览的安全 noop 行为，或明确替代的 SSR/browser 数据策略。
7. 保持 SQLite 数据库位置、schema migration 单调递增和已存 Base64 文章内容的可读性。
8. 保持用户 localStorage 键的读取兼容，或定义迁移：`themeMode`、`appSettings`、`contentFontSize`、`readingProgress`、`readingSettings`、搜索历史键。
