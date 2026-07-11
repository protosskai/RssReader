# 目标模块边界

> 这是逻辑模块清单，不是要求一次性创建的目录树。每个模块可以先以 facade、端口和测试
> 形成边界，再在有独立迁移价值时移动文件。

## 模块总览

| 模块 | 类型 | 公开接口 | 拥有的状态/规则 | 主要依赖 |
| --- | --- | --- | --- | --- |
| `subscriptions` | 领域 + 应用 | `SubscriptionCommands`、`SubscriptionQueries` | URL 唯一性、feed 创建/移除、folder 归属 | Feed/Folder repository、fetch/parse 端口 |
| `folders` | 领域 + 应用 | `FolderCommands`、`FolderQueries` | 平面、唯一名称、删除语义 | Folder repository |
| `articles` | 领域 + 应用 | `ArticleQueries`、`ReadingCommands`、`FavoriteCommands` | 查询、已读、收藏、统计、搜索意图 | Article repository |
| `synchronization` | 应用 | `FeedSynchronization` | 单源同步、并发批次、进度与结果 | subscriptions query、articles、fetch/parse、config/notifier 端口 |
| `opml-import` | 应用 | `OpmlImport` | outline 到文件夹/订阅命令的编排 | OPML reader、subscriptions、folders |
| `persistence-sqlite` | 基础设施 | 各 repository 的实现 | SQLite、schema、migration、队列、FTS、内容编解码 | sqlite3、appdata-path |
| `feed-network` | 基础设施 | fetch/parse 端口的实现 | HTTP、超时、缓存、RSS/Atom 解析 | Electron net、Axios、rss-parser |
| `desktop-runtime` | 基础设施/接口 | config、notification、file picker、window 操作 | `sync-config.json`、Notification、shell/dialog | Electron、fs |
| `ipc` | 接口适配 | channel handler 与 DTO mapper | 参数验证、envelope、legacy/current 映射 | 应用用例、Electron IPC |
| `main-composition` | 组合根 | 无业务公开 API | window 生命周期、装配、handler 注册 | 全部实现模块 |

## 能力契约与所有权

### subscriptions

订阅模块是 feed 生命周期的唯一所有者。它可以创建 feed 后请求同步，但不直接写文章表；
首次同步失败不回滚 feed 的现有行为由用例显式表达并以测试保留。编辑订阅的破坏性
“删除后新增”不是目标默认实现：在没有独立行为规格前，迁移只能保持它的可观察行为，
不能借重构悄悄改成原地更新。

### folders

文件夹模块只实现当前扁平模型。`parent_id` 的历史列不构成嵌套能力承诺。删除文件夹造成
订阅和文章删除是高风险持久化行为，必须由 SQLite adapter 的事务/外键策略和特征测试
共同保护。

### articles

文章模块拥有文章读取、分页、已读、收藏、统计和搜索的业务意图。`setRead` 与
`setFavorite` 是幂等命令；旧的 toggle/add/remove 语义由 IPC adapter 映射。文章正文在
adapter 返回前可被转换为 renderer DTO，但 HTML 消毒仍归 renderer。

### synchronization

同步模块拥有“何时尝试”“一个 feed 如何同步”“结果如何汇总”的应用编排。它不拥有
Electron timer 或 Notification。`SyncManager` 的 timer、进度轮询数据和文件配置将先作为
`desktop-runtime` adapter，随后以用例结果替换其直接的服务依赖。

### opml-import

OPML 模块只处理已批准的当前导入范围。它通过 `folders` 与 `subscriptions` 命令创建结果，
不直接访问 SQLite。递归层级、导出和冲突策略均是独立的产品能力，不能在本迁移中扩张。

## 进程边界 DTO 与领域模型

`src/common/models.ts` 目前混合 renderer、legacy RSS 和主进程模型。目标中应按用途拆分，
但不要求一次移动：

| 类型类别 | 所在逻辑边界 | 规则 |
| --- | --- | --- |
| preload/IPC request、response、legacy RSS DTO | `contracts` | 可被 renderer、preload、IPC adapter 依赖；字段变更视为兼容性变更 |
| Feed、Folder、Article、查询与端口值对象 | 主进程 `domain` | 不含 Electron、数据库或 legacy envelope 字段 |
| SQLite row、FTS row、Base64 编码中间值 | `persistence-sqlite` 内部 | 不得穿出 adapter |
| Vue props、页面状态、localStorage 偏好 | renderer | 不得进入主进程领域或 IPC 之外的共享模块 |

## 接口适配的兼容策略

在迁移完成前，一个业务能力的 IPC 入口可以同时存在，例如 legacy
`rss:queryPostContentByGuid` 与 current `article:getArticle`。两者必须：

1. 调用同一个应用用例；
2. 在 adapter 内完成字段、默认值和 `ApiResponse` 映射；
3. 使用特征测试证明保留现有成功、失败和空结果语义；
4. 在全部 renderer 调用方迁移并有引用证据前保留 legacy channel；
5. 删除前在独立规格中明确可观察的 breaking change（如有）。

## 建议的逻辑布局

当某个完整能力链开始迁移时，可采用以下布局；未迁移的旧代码留在原路径并由 adapter
封装。

```text
src-electron/
├── domain/
│   ├── articles/          # 模型、端口、规则
│   ├── subscriptions/
│   └── folders/
├── application/
│   ├── articles/          # 查询与命令用例
│   ├── subscriptions/
│   ├── synchronization/
│   └── opml-import/
├── infrastructure/
│   ├── persistence/       # SQLite adapter 与现有迁移机制
│   ├── feed-network/
│   └── desktop-runtime/
├── interfaces/
│   └── ipc/               # handler、校验、legacy/current DTO mapper
└── composition/            # 主进程装配；由 electron-main 调用
```

这只是迁移完成后的逻辑落点；第一步可以只新增一个端口、一个用例 facade 和一个 adapter
测试，而不移动任何文件。
