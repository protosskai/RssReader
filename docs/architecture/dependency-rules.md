# 目标依赖规则

> 本规则约束主进程的新增和迁移代码。它优先于“把文件移动到看似正确的目录”的做法；
> 未形成隔离边界的移动不算完成重构。

## 允许方向

| 模块类别 | 可以依赖 | 不得依赖 |
| --- | --- | --- |
| 领域模型与端口 | 同一领域、纯 TypeScript 工具 | 应用层、基础设施、Electron、SQLite、RSS/OPML 库、IPC DTO |
| 应用用例 | 领域模型、领域端口、纯工具 | Electron、SQLite、文件系统、网络/解析器具体实现、IPC envelope |
| 基础设施 adapter | 领域端口、领域模型、所需第三方库 | IPC adapter、renderer、其他能力的应用用例 |
| IPC/preload adapter | 应用用例、边界 DTO、参数验证、错误映射 | SQLite、RSS parser、文件系统、schema/migration |
| 同步调度 adapter | `FeedSynchronization`、配置/通知端口、Electron timer | SQLite、文章保存规则、renderer Store |
| 组合根 | 所有实现和 adapter，用于装配 | 业务规则、SQL、DTO 业务映射 |

基础设施对领域端口的“实现”关系通过依赖反转发生：adapter 可以导入端口以实现它，
领域层不能导入 adapter。应用层只接收端口，不选择 SQLite、网络或解析器实现。

## 必须遵守的规则

1. 新的领域端口 MUST 位于主进程领域模块，参数和返回值 MUST 使用领域值对象或纯值，
   不得使用 `Electron.Ipc*`、`ApiResponse`、`sqlite3` 行类型或 persistence 路径的类型。
2. 新的应用用例 MUST 通过构造函数或工厂接收端口；不得调用全局 singleton、
   `getArticleService()`、`SqliteUtil.getInstance()` 或 `ipcMain`。
3. SQL、Base64 存储编解码、FTS、schema 和 migration MUST 留在 SQLite adapter。应用层只
   能表达“保存新文章”“查询文章”“标记已读”等意图。
4. `rss-parser`、`NetUtil`、OPML 库、文件对话框和 Notification MUST 只被相应基础设施或
   Electron adapter 使用。网络失败如何映射为用例结果由应用层决定，具体请求方式不外泄。
5. 新 renderer 功能 MUST 通过 preload 白名单和 IPC adapter 调用应用用例；不得让 renderer
   直接访问 Node、SQLite 或新增未白名单 channel。
6. legacy IPC 与 current IPC MUST 映射到同一用例；不得为同一业务行为创建两套并行持久化
   流程。存在差异时，adapter 负责形状/默认值兼容并以特征测试锁定。
7. 任何新增共享模块 MUST 是无框架、无副作用的纯工具，或是被明确列出的跨进程 DTO。
   不能仅因两个模块都需要它就创建“common service”。

## 迁移期例外

迁移期间允许旧路径继续存在，但新增代码不得增加其使用者。临时例外必须在对应 plan 中
记录：旧路径、唯一新调用点、替代端口、删除条件、回滚方式和到期阶段。

允许的过渡形态包括：

- 用例调用一个 facade，而 facade 暂时委托 `ArticleService` 或 `SqliteUtil`；
- IPC adapter 同时支持 legacy 和 current DTO，并在内部映射至同一用例；
- SQLite adapter 暂时复用 `SqliteHelper` 的队列与 migration；
- 同步调度 adapter 暂时复用 `SyncManager` 的 timer/进度结构。

不允许的过渡形态包括：应用用例直接导入 `SqliteUtil`、领域端口导入 persistence DTO、
新组件新增第二套 IPC channel 以绕过现有用例、或为了迁移而复制一份 SQLite schema。

## 导入检查清单

在合并一个主进程重构增量前，审查者 MUST 确认：

- 领域与应用目录没有 `electron`、`sqlite3`、`fs`、`path`、`axios`、`rss-parser` 或
  persistence 相对路径导入；
- IPC adapter 没有 SQL、repository 或 parser 导入；
- 所有新 channel 位于 preload 白名单并具有输入验证和错误映射；
- 新旧 adapter 调用同一用例，且特征测试覆盖其可观察返回值；
- 删除旧路径前已搜索静态 import、IPC 字符串、动态 import、运行时注册和数据迁移引用；
- 组合根之外没有新增进程级 singleton 或定时器。

## 依赖偏差的处理

如果一个增量不能遵守规则，计划必须把偏差列入 Constitution Check 和 Decision Record，说明
替代方案、成本、临时范围与回滚。未记录的偏差不是“遗留兼容”，而是新的架构债务。
