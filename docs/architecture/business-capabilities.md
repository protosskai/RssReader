# 当前业务能力

> 能力以可达 UI/IPC/服务调用链归纳，不以页面或目录名称猜测。状态“已实现”表示当前有真实调用；“部分实现”表示界面或类型存在但后端/运行时未闭环。

| 能力 | 状态 | 用户入口与调用链 | 数据/副作用 | 关键规则 |
| --- | --- | --- | --- | --- |
| 管理订阅 | 已实现 | Dialog、首页推荐源、context menu → `rssInfoStore` → `rss:addRssSubscription/removeRssSubscription` → `ArticleService` | `rss_info`/`post_info`；网络读取 XML；首次同步 | URL 全局查重；添加成功即保存 feed，首次同步失败不回滚。 |
| 导入 OPML | 已实现（有限） | 首页/订阅操作 → `rss:importOpmlFile` → Electron file dialog → `OpmlParserAdapter` → `ArticleService.addFeed/addFolder` | 读取用户选的文件；写 SQLite；每个源可能网络同步 | 仅处理顶层 folder 与其直接 RSS child；更深层级不在 handler 中递归添加。见 `electron-main.ts:504-547`。 |
| 文件夹 | 已实现但扁平 | Add/Edit/Delete dialog/context menu → legacy/v2 folder IPC → repository | `folder_info`；删除会级联 feeds/articles | 唯一 name；默认 `默认`；嵌套移动被 UI 显式拒绝。 |
| 编辑订阅 | 部分实现/破坏性 | `rssInfoStore.editRssSubscription` | 删除旧订阅及文章，再新增订阅并首次同步 | 没有 update IPC；即使 URL 未变也会删除文章，代码注释中的“保留 posts”与实际 `removeFeed` 级联删除不一致。见 `rssInfoStore.ts:175-208`、`ArticleRepositoryImpl.ts:498-506`。 |
| 拉取与自动同步 | 已实现 | 首页、设置、`AppLayout`、定时器 → `SyncManager.syncAll` 或 `ArticleService.syncFeed` | HTTP、内存 cache、SQLite、通知、`sync-config.json` | 全量最多 5 并发；同一时间已有同步则直接跳过；启动 layout 会无条件请求一次全量同步。 |
| 浏览 feed 文章 | 已实现 | subscription tree → `PostList` | 首读 SQLite；后台同步/再读 SQLite | 有缓存时 cache-first；刷新失败保留缓存；单 feed legacy 列表上限为 500。 |
| 搜索 | 已实现 | Drawer/`SearchComponent` → `searchStore.search` → `search:searchPosts` → Article repository | SQLite FTS5，失败时 LIKE；localStorage 搜索历史 | IPC 查询最长度 1024、结果最多 200；UI Drawer 再截取 12。 |
| 阅读正文 | 已实现 | `PostListItem`/搜索/收藏页 → Content query route → `rss:queryPostContentByGuid` | SQLite 解码、DOMPurify、localStorage 阅读偏好/进度 | GUID 为 URL 时必须 query route；打开正文使用 idempotent set-read。 |
| 已读状态 | 已实现但局部不一致 | 正文、文章项、context menu、PostList 批量操作 | `post_info.read`；聚合未读数 | `setReadStatus` 是安全的开文入口；list 的“全标未读”逐条写；收藏页只改本地 read，未持久化。 |
| 收藏 | 已实现 | 正文 toggle、文章项、收藏页、搜索组件 | `post_info.favorite` | 新旧 IPC 都映射同一列；旧 add/remove 是幂等 set，不应被改回 toggle。 |
| 阅读进度 | 已实现（本地） | Content + `useReadingExperience` / `readingStore` | `localStorage.readingProgress` | 滚动到 80% 会自动标已读；进度和阅读时间不进 SQLite。 |
| 主题/阅读样式 | 已实现（本地） | Header/Home/Settings → `themeStore`；Content → reading settings | DOM class/meta + localStorage | 两套主题 API（store 和 composable）都可能写 `themeMode`。 |
| 应用设置 | 部分实现 | `SettingPage` | `appSettings` localStorage 与 `sync-config.json` | 只有同步配置、主题和正文大小有已见运行时作用；语言、autoStart、minimizeToTray、通知细项、cacheSizeLimit 等没有配套 Electron 实现。 |
| 清空所有数据 | 已实现但非原子 | SettingPage 确认 → clear favorite → 逐 feed remove → 逐非默认 folder remove → 删除部分 localStorage | 破坏性 SQLite / localStorage 变更 | 逐项执行，无跨库事务；任一步失败会造成部分清空。见 `SettingPage.vue:658-720`。 |
| 外部链接与窗口控制 | 已实现 | Header/正文/文章项 → `openLink/close/minimize` | 系统浏览器、窗口生命周期 | `openLink` 只接受 HTTP(S)；renderer 本身没有 shell 权限。 |

## 关键能力链的契约

### 同步后“新增文章”的定义

存储层以 `guid` 查询已有文章并只插入新 GUID（`SqliteUtil.syncRssPostList()`）；因此“同步”默认不是更新既有文章内容。`SyncManager` 的 `newArticlesCount` 不是真实插入数，而是成功源数；用户可见通知的文案不能被当作精确文章计数。

### 可搜索内容

FTS5 table 使用 `post_info` 的 `title/content/author/rss_id/update_time`，并借 trigger 同步；当前内容采用 Base64 存储，所以搜索语义还取决于 SQLite FTS 对该已编码字段的行为与 LIKE 回退。见 `SqliteHelper.createFtsTable()`、`SqliteUtil.searchPosts()`。

### 浏览器预览能力边界

浏览器模式不是另一个后端：`electronClient` 的 noop 只让 UI 不崩溃，返回空订阅/文章/统计或“非 Electron 环境”的 legacy 失败响应。可用于视觉验证，不可用于真实订阅数据验证。
