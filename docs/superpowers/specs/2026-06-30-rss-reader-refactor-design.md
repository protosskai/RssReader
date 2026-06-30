# RSS Reader 渐进式重构设计文档

> 日期：2026-06-30  
> 状态：已批准  
> 决策者：用户确认最终方案

---

## 1. 目标

对 Quasar + Electron RSS Reader 进行渐进式架构重构，实现：

- **架构优秀** — Clean Architecture 分层，高内聚低耦合
- **代码优雅** — 模块职责清晰，单一职责原则
- **高扩展性** — 接口驱动，新增功能无需改动现有代码
- **性能更好** — 标准库替换自研实现，消除冗余层
- **易于理解** — 命名统一，文件组织直观

---

## 2. 核心决策

### 2.1 重构力度：激进

完全删除旧版 `src-electron/rss/` 路径（api.ts, sourceManage.ts, FeedParser.ts, opmlUtil.ts 等 8 个文件），将所有功能统一到 Clean Architecture 架构中。一次性消除双路径问题。

### 2.2 状态管理：Composables 替代 Pinia

14 个 Pinia Store → 8 个 Vue 3 Composables：

| 旧 Store | 新 Composable |
|----------|--------------|
| rssInfoStore + articleStore + feedStore | `useArticles` + `useSubscriptions` |
| favoriteStore | `useFavorites` |
| folderStore | `useFolders` |
| searchStore + readingStore | 合并到 `useArticles` |
| syncProgressStore + loadingStore | `useSync` |
| themeStore | `useTheme` |
| keyboardStore | `useKeyboard` |
| systemDialogStore | `useUI` |

### 2.3 后端目录：整洁架构

```
src-electron/
├── domain/           # 核心业务逻辑（零依赖）
│   ├── models/       Article, FeedSource, Folder 实体
│   ├── repositories/ IArticleRepo, IFeedRepo, IFolderRepo 接口
│   └── value-objects/ FeedUrl, Guid
├── application/      # 用例编排层
│   ├── services/     ArticleService, SyncService, SearchService
│   └── ports/        命令/查询输入端口
├── infrastructure/   # 技术实现层
│   ├── persistence/  SqliteHelper, RepositoryImpl, migrations/
│   ├── network/      NetUtil, CacheManager
│   ├── parsing/      RssParserAdapter, OpmlParserAdapter
│   └── di/           Container
├── presentation/     # IPC 接口层
│   ├── ipc/          article.handler.ts, feed.handler.ts, ...
│   ├── preload.ts
│   └── main.ts
└── shared/           # 跨层工具
    └── errors/       AppError, Result<T>
```

### 2.4 解析库替换

| 旧实现 | 新库 | 原因 |
|--------|------|------|
| FeedParser.ts (695行) | `rss-parser` (~4M/周) | 处理 30+ RSS 变体，支持 ETag |
| opmlUtil.ts (235行) | `opml-to-json` (~10K/周) | 标准化 OPML 解析 |
| xml2js (底层) | `fast-xml-parser` (~20M/周) | 快 10-20 倍 |

**自研代码净减少：~930 行**

---

## 3. 目标架构（后端）

```
┌─────────────────────────────────────────────────┐
│ presentation/                                    │
│  ipc/*.handler.ts → contextBridge → Renderer     │
│  main.ts → BrowserWindow, lifecycle              │
├─────────────────────────────────────────────────┤
│ application/                                     │
│  ArticleService → orchestrate domain objects     │
│  SyncService   → batch update feeds              │
│  SearchService → FTS5 + hybrid search            │
├─────────────────────────────────────────────────┤
│ domain/                                          │
│  models/    → Article, FeedSource, Folder        │
│  repos/     → interfaces (IArticleRepo...)       │
├─────────────────────────────────────────────────┤
│ infrastructure/                                  │
│  persistence/ → SqliteHelper, RepoImpl           │
│  network/     → NetUtil with ETag/caching        │
│  parsing/     → RssParserAdapter, OpmlAdapter    │
│  di/          → Container (手动 DI)              │
└─────────────────────────────────────────────────┘
```

---

## 4. 目标架构（前端）

```
src/
├── composables/        ← 状态+逻辑（替代 Pinia Stores）
│   ├── useArticles.ts
│   ├── useSubscriptions.ts
│   ├── useFolders.ts
│   ├── useFavorites.ts
│   ├── useSync.ts
│   ├── useTheme.ts
│   ├── useKeyboard.ts
│   └── useUI.ts
├── components/
│   ├── feed/           SubscriptionList, FeedCard
│   ├── article/        PostListItem, ContentReader
│   ├── layout/         AppDrawer, AppHeader
│   └── common/         Dialog, Toast, Skeleton
├── pages/
├── common/             types, utils, sanitize
├── types/              TypeScript 类型
└── ipc/                electronClient 封装
```

### 数据流

```
Component → Composable → electronClient (IPC) → Service → Repository → SQLite
                                                                    ↓
Component ← Composable ← electronClient (IPC) ← Service ← Repository
```

- Composable 持有 `ref()` / `reactive()` 状态
- 通过 `provide/inject` 在组件树中共享（可选）
- IPC 调用封装在 `electronClient.ts`，类型安全

---

## 5. 分阶段执行计划

### Phase 1: 依赖替换

- 安装 `rss-parser`, `opml-to-json`, `fast-xml-parser`
- 移除 `xml2js`, `@types/xml2js`
- 影响：~5 文件（package.json + 类型定义）

### Phase 2: 解析器适配

- 创建 `infrastructure/parsing/RssParserAdapter.ts`
- 创建 `infrastructure/parsing/OpmlParserAdapter.ts`
- 定义 `IRssParser` / `IOpmlParser` 接口
- 影响：~4 文件

### Phase 3: 后端目录重组

- 建立 `domain/`, `application/`, `infrastructure/`, `presentation/`, `shared/`
- 迁移现有 domain/infrastructure 文件到对应目录
- 更新所有 import 路径
- 影响：~15 文件

### Phase 4: 删除旧代码

- 删除 `src-electron/rss/api.ts`
- 删除 `src-electron/rss/sourceManage.ts`
- 删除 `src-electron/rss/parser/FeedParser.ts`
- 删除 `src-electron/rss/opmlUtil.ts`
- 删除 `src-electron/rss/feedFetcher.ts`
- 删除 `src-electron/rss/subscriptionManager.ts`
- 删除 `src-electron/rss/folderManager.ts`
- 删除 `src-electron/rss/postListManeger.ts`
- 删除 `src-electron/rss/postQueries.ts`
- 影响：-8 文件

### Phase 5: IPC 重写

- 所有 IPC handler 迁移到 `presentation/ipc/`
- 按领域拆分：article.handler.ts, feed.handler.ts, folder.handler.ts, opml.handler.ts
- 统一错误处理，类型安全
- 影响：~8 文件

### Phase 6: 前端 Composables 重构

- 14 Pinia Stores → 8 Composables
- 组件重新组织到 feed/article/layout/common 子目录
- 更新所有组件中的 store 引用
- 影响：~30 文件

### Phase 7: 性能优化 + 验证

- 虚拟滚动（大文章列表）
- 图片懒加载
- 数据库查询优化（索引、批量操作）
- 510 条测试修复 + 重跑
- Playwright E2E 验证
- 影响：~10 文件

---

## 6. 不变约束

- 不破坏现有功能 — 每阶段独立验证
- TypeScript 严格模式 — 源码 0 错误
- 510 条测试保持通过
- IPC 接口向后兼容 — 前端逐步迁移
- SQLite schema 不变 — 数据不受影响

---

## 7. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| rss-parser 行为差异 | Adapter 层映射到现有接口，阶段 2 可独立回滚 |
| Composable 缺少全局状态 | `useUI` 提供全局 loading/dialog，`provide/inject` 共享 |
| IPC 重写导致断连 | 保留旧 IPC 通道名，阶段 5 与新通道并存过渡 |
| 测试大规模失效 | 每阶段完成后重跑 510 测试，修复后再推进 |
