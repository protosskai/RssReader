# 主进程渐进式重构路线图

> 本路线图只处理主进程核心业务与持久化边界。每个阶段是独立规格的候选范围；不得把
> 多个阶段或渲染端重构合并为一次提交。所有阶段遵守
> [重构宪章](../.specify/memory/constitution.md)。

## 共同交付门槛

每个阶段开始前必须记录当前调用方、可观察基线、高风险点、目标依赖方向和回滚方式。
每个阶段完成前必须：

- 运行 `npm run build`；
- 运行活动 Vitest 测试；
- 启动 `npm run dev:electron` 并验证该阶段涉及的实际能力；
- 验证 legacy/current IPC、SQLite 数据和预期 renderer 路径未被无规格地改变；
- 对照规格、计划、任务、测试和代码完成一致性检查；
- 保持变更可独立提交和回滚。

现有 `npm run build:electron` 的 Node engines 问题是已知交付环境问题，不应被任一架构
阶段顺带修改；若要处理，必须建立独立规格。

## 阶段 0：基线与契约护栏

**范围**：为后续主进程迁移建立证据，不改变业务实现。

- 记录每个 IPC channel 到当前服务/存储路径的映射，以及 legacy/current DTO 差异。
- 为高风险能力补齐或明确特征测试：订阅添加后首次同步失败不回滚、文件夹级联删除、
  GUID 去重、正文读取与幂等已读、收藏 set 语义、同步并发/跳过规则、搜索回退。
- 建立对 SQLite schema、现有 migration 和关键 `sync-config.json` 行为的回归证据。

**迁移前 / 后**：前后均使用原服务和原 IPC；后仅新增测试与调用方清单。

**回滚**：独立回滚测试/文档提交，不影响运行时。

**完成条件**：任一后续阶段都能在不阅读实现细节的情况下引用基线测试和兼容契约。

## 阶段 1：领域类型、端口与组合根隔离

**范围**：为一个最小能力链引入不依赖 SQLite/Electron 的领域端口和应用 facade；建议先选
文章的 `setRead` 或文件夹查询，不同时改写同步。

- 定义领域值对象和一个窄 repository 端口，避免 persistence 类型泄漏。
- 以 adapter 包装现有 `SqliteUtil`/repository 实现，不移动 schema 或迁移逻辑。
- 在 composition 模块创建用例并让一个 IPC handler 通过 adapter 调用它；保留原 DTO 和
  channel 名称。

**迁移前 / 后**：前为 handler → 旧 service/storage；后为 handler → 用例 facade →
旧存储 adapter。

**回滚**：恢复该 handler 到原调用链；adapter 和领域类型可作为无调用代码一并回滚。

**完成条件**：该链的应用层没有 Electron、SQLite 或 legacy DTO 导入，构建、测试和
Electron 路径通过。

## 阶段 2：订阅与文件夹目录链

**范围**：迁移订阅创建/删除/查询和文件夹 CRUD；不改变扁平模型、默认文件夹、级联删除
或“首次同步失败不回滚”的行为。

- 建立 `SubscriptionCommands/Queries` 与 `FolderCommands/Queries`。
- 将 URL 查重、默认文件夹创建和删除语义移入用例；SQLite adapter 保留真实 SQL/事务。
- legacy RSS 和 v2 feed/folder IPC 均映射到同一用例；renderer 无需先改动。

**迁移前 / 后**：前为 `ArticleService` 混合处理；后为目录用例协调仓储与同步入口。

**回滚**：按能力恢复 handler 到 `ArticleService`，不删除原 facade，确保现有 SQLite 数据
仍可读写。

**完成条件**：新增订阅/文件夹相关代码不再直接依赖 `SqliteUtil`；订阅树和设置页的现有
路径均通过特征测试和 Electron 验证。

## 阶段 3：文章库、已读、收藏与搜索链

**范围**：迁移文章查询、正文、阅读状态、收藏、统计和搜索。HTML 消毒与阅读进度继续在
renderer，不进入本阶段。

- 建立 `ArticleQueries`、`ReadingCommands`、`FavoriteCommands` 和文章 repository adapter。
- 保留 Base64、FTS、LIKE 回退和现有分页限制在 SQLite adapter；用例不依赖 SQL 行或编码。
- 将 legacy 文章 API 和 current article API 统一映射到相同用例，保留 envelope/字段形状。

**迁移前 / 后**：前为页面、`ArticleService`、repository 和 `SqliteUtil` 的多套路径；后为
所有新主进程路径经过文章用例。

**回滚**：逐个 adapter 恢复旧 delegate；不执行数据重写或 schema 删除。

**完成条件**：`setRead`/`setFavorite` 保持幂等，搜索和正文历史数据可读，收藏页与正文的
已读副作用有明确回归证据。

## 阶段 4：单源同步与调度分离

**范围**：将单 feed 同步迁入 `FeedSynchronization`，再把全量批次、进度、配置和通知隔离
为调度 adapter。不得在此阶段改变同步策略或引入新的网络框架。

- 将 fetch/parse 定义为端口；先以当前 `RssParserAdapter` 和 `NetUtil` 实现它们。
- 将文章保存、feed 时间更新和结果定义放入单源用例。
- 让 `SyncManager` 仅负责 timer、配置文件、把用例进度映射为当前进度快照以及
  Notification，并委托 `syncAll` 用例；保留用例内现有 5 并发、启动/手动同步和进度
  轮询语义。

**迁移前 / 后**：前为 `SyncManager`/`ArticleService` 交叉调用；后为调度 adapter → 同步
用例 → 端口实现。

**回滚**：恢复 `SyncManager` 对旧同步路径的 delegate；停止新增 timer 或通知实例。

**完成条件**：单源同步可在无 BrowserWindow 的测试中执行；自动同步、手动同步、失败和
进度路径仍可在 Electron 中运行。

## 阶段 5：OPML、IPC adapter 收口与组合根瘦身

**范围**：迁移 OPML 导入编排，收口 `electron-main.ts` 到组合根职责。OPML 深层嵌套或导出
不属于本阶段。

- 将 OPML parser/文件读取放进 adapter，把 outline 编排放进 `OpmlImport` 用例。
- 按能力拆分 IPC handler 注册和 DTO mapper；保持 channel 名、preload 白名单和错误行为。
- 让 `electron-main.ts` 仅装配模块、管理窗口/生命周期并注册 adapter。

**迁移前 / 后**：前为主文件承载 handler、DTO、服务调用和 OS 操作；后为主文件调用
composition 与接口 adapter。

**回滚**：恢复原 handler 注册模块；兼容 adapter 保留，确保 preload 不需要同步变更。

**完成条件**：主进程入口没有业务 SQL、RSS/OPML 解析或文章/订阅规则；导入的当前一层
语义与取消文件选择行为不变。

## 阶段 6：旧路径退役与后续边界

**范围**：只删除已被证明无人调用的旧 facade、重复 DTO mapper 或存储入口；renderer Store/
组件边界改造是后续独立路线图。

- 搜索静态 import、动态 import、IPC 字符串、preload whitelist、测试、运行时注册和数据
  migration 引用。
- 确认 legacy channel 是否仍由 renderer 使用；若需移除，建立单独的 breaking-change 规格。
- 删除前后均运行完整共同门槛，并保留迁移决策记录。

**回滚**：恢复独立的删除提交；不得通过恢复已弃用 schema 来回滚。

**完成条件**：删除证据完整、没有新增反向依赖、`electron-main.ts` 是组合根，且后续 renderer
边界改造可在不触碰主进程业务核心的独立规格中进行。

## 阶段顺序与禁止合并

阶段 0 是所有实现的前置条件。阶段 1 可以选择一个小能力试点；阶段 2、3、4、5 按能力
链独立推进，但同一提交不得同时迁移目录、文章和同步三类主链。阶段 6 只在调用方迁移
证据完成后执行。任何需要改变用户可见行为、SQLite 数据含义、IPC contract 或同步策略的
工作都从本路线图分离，先建立独立 feature specification。
