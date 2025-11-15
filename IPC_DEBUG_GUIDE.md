# IPC通信错误调试指南

## 🎯 问题描述

当应用启动并尝试从数据库读取RSS信息时，出现错误：
```
Error invoking remote method 'rss:getRssInfoListFromDb': reply was never sent
```

## 🔍 已添加的调试日志

我已经为整个调用链添加了详细的日志记录，便于追踪问题根源：

### 1. IPC处理层 (`electron-main.ts`)
- ✅ 调用时间和参数
- ✅ 超时保护（30秒）
- ✅ 成功/失败状态
- ✅ 详细的错误堆栈

### 2. API层 (`rss/api.ts`)
- ✅ SourceManage实例获取
- ✅ loadFromDb调用
- ✅ getFolderInfoList结果

### 3. 业务逻辑层 (`rss/sourceManage.ts`)
- ✅ 初始FolderMap状态
- ✅ SqliteUtil实例获取
- ✅ loadFolderItemList调用
- ✅ loadFolderInfoList处理
- ✅ 最终FolderMap状态

### 4. 数据访问层 (`storage/sqlite.ts`)
- ✅ 数据库查询操作
- ✅ 查询结果记录
- ✅ 数据处理过程

## 🚀 如何获取调试信息

### 启动应用

1. **编译应用**:
```bash
npx quasar build -m electron
```

2. **运行应用**:
```bash
# 在dist/electron目录下运行
.\RssReader-win32-x64\RssReader.exe
```

### 查看控制台日志

**开发者工具会自动打开**，在Console选项卡中查看日志。

## 📋 预期日志流程

### 正常情况下，你应该看到：

#### 1. 应用启动日志
```
[2025-11-15T10:30:00.000Z] [electron-main] Initializing database...
[2025-11-15T10:30:00.100Z] [electron-main] Database initialized successfully
[2025-11-15T10:30:00.200Z] [electron-main] All IPC handlers registered, creating window...
```

#### 2. IPC调用日志
```
[2025-11-15T10:30:05.000Z] [electron-main] rss:getRssInfoListFromDb called
[2025-11-15T10:30:05.000Z] [electron-main] Event: ...
[2025-11-15T10:30:05.000Z] [electron-main] Args: []
[2025-11-15T10:30:05.000Z] [electron-main] Starting getRssInfoListFromDb...
[2025-11-15T10:30:05.000Z] [api.ts] getRssInfoListFromDb called
[2025-11-15T10:30:05.000Z] [api.ts] Getting SourceManage instance...
[2025-11-15T10:30:05.000Z] [api.ts] SourceManage instance: SourceManage {}
[2025-11-15T10:30:05.000Z] [api.ts] Starting loadFromDb...
[2025-11-15T10:30:05.000Z] [sourceManage.ts] SourceManage.loadFromDb called
[2025-11-15T10:30:05.000Z] [sourceManage.ts] FolderMap before load: {...}
[2025-11-15T10:30:05.000Z] [sourceManage.ts] Getting SqliteUtil instance...
[2025-11-15T10:30:05.000Z] [sourceManage.ts] StorageUtil instance: SqliteUtil {}
[2025-11-15T10:30:05.000Z] [sourceManage.ts] Calling loadFolderItemList...
[2025-11-15T10:30:05.100Z] [sqlite.ts] SqliteUtil.loadFolderItemList called
[2025-11-15T10:30:05.100Z] [sqlite.ts] Querying folders from database...
[2025-11-15T10:30:05.200Z] [sqlite.ts] Folder query result: [...]
[2025-11-15T10:30:05.200Z] [sqlite.ts] Querying RSS sources from database...
[2025-11-15T10:30:05.300Z] [sqlite.ts] RSS query result: [...]
[2025-11-15T10:30:05.300Z] [sqlite.ts] loadFolderItemList completed, returning 1 folders
[2025-11-15T10:30:05.400Z] [sourceManage.ts] Load result: {success: true, msg: '', data: [...]}
[2025-11-15T10:30:05.400Z] [sourceManage.ts] Folder info list from DB: [...]
[2025-11-15T10:30:05.500Z] [sourceManage.ts] Folder count: 1
[2025-11-15T10:30:05.500Z] [sourceManage.ts] SourceManage.loadFromDb completed successfully
[2025-11-15T10:30:05.600Z] [api.ts] loadFromDb completed
[2025-11-15T10:30:05.600Z] [api.ts] Getting folder info list...
[2025-11-15T10:30:05.700Z] [api.ts] Folder info list: [...]
[2025-11-15T10:30:05.700Z] [api.ts] Returning result with 1 folders
[2025-11-15T10:30:05.800Z] [electron-main] rss:getRssInfoListFromDb SUCCESS, result: [...]
[2025-11-15T10:30:05.800Z] [electron-main] Result type: object
[2025-11-15T10:30:05.800Z] [electron-main] Result length: 1
```

## 🚨 问题排查清单

### 如果看到超时错误（30秒后）：
```
[2025-11-15T10:30:05.000Z] [electron-main] rss:getRssInfoListFromDb called
[2025-11-15T10:35:05.000Z] [electron-main] rss:getRssInfoListFromDb ERROR: Error: Timeout after 30 seconds
```

**可能原因**:
- 数据库连接问题
- SQL查询卡死
- 并发锁竞争

### 如果看到数据库初始化错误：
```
[2025-11-15T10:30:00.000Z] [electron-main] Initializing database...
[2025-11-15T10:30:00.100Z] [electron-main] Failed to initialize database: Error: ...
```

**可能原因**:
- SQLite数据库文件损坏
- 权限问题
- 磁盘空间不足

### 如果看到查询错误：
```
[2025-11-15T10:30:05.100Z] [sqlite.ts] loadFolderItemList ERROR: Error: SQLITE_ERROR: ...
```

**可能原因**:
- SQL语法错误
- 表结构不匹配
- 数据损坏

### 如果看到并发错误：
```
[2025-11-15T10:30:05.100Z] [sqlite.ts] loadFolderItemList ERROR: Error: SQLITE_BUSY: database is locked
```

**可能原因**:
- 多个进程同时访问数据库
- 之前的操作未完成
- WAL文件锁定

## 🔧 常见解决方案

### 1. 数据库锁定

**症状**: `SQLITE_BUSY: database is locked`

**解决方案**:
1. 关闭所有RSS阅读器实例
2. 删除WAL文件（如果存在）：
   ```
   删除 %APPDATA%/RssReader/sqlite.db-wal
   删除 %APPDATA%/RssReader/sqlite.db-shm
   ```
3. 重新启动应用

### 2. 数据库损坏

**症状**: `SQLITE_CORRUPT: database disk image is malformed`

**解决方案**:
1. 备份当前数据库
2. 删除数据库文件：
   ```
   删除 %APPDATA%/RssReader/sqlite.db
   ```
3. 重新启动应用（会创建新数据库）

### 3. 权限问题

**症状**: `SQLITE_CANTOPEN: unable to open database file`

**解决方案**:
1. 检查应用数据目录权限
2. 以管理员身份运行应用
3. 更改数据目录位置

## 📊 关键日志位置

### 最关键的日志点

1. **数据库初始化** - 确认数据库连接成功
2. **loadFolderItemList调用** - 确认SQL查询执行
3. **查询结果记录** - 确认返回数据
4. **loadFromDb完成** - 确认数据加载成功
5. **getFolderInfoList返回** - 确认数据处理成功

## 🎯 快速诊断命令

如果无法查看GUI控制台，可以通过以下方式查看日志：

### Windows
1. 打开事件查看器（eventvwr.msc）
2. 或在应用目录查找日志文件

### 或者修改代码写入日志文件
```typescript
// 在electron-main.ts中添加
const fs = require('fs');
const logFile = path.join(app.getPath('userData'), 'app.log');

// 修改所有console.log为
const log = (msg) => {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${msg}\n`;
  console.log(logMsg);
  fs.appendFileSync(logFile, logMsg);
};
```

## 📞 需要帮助？

如果日志显示的问题不在上述列表中，请：

1. 保存所有控制台日志
2. 记录重现问题的步骤
3. 提供系统环境信息（Windows版本、内存等）
4. 发送完整的错误日志

## 📝 日志过滤技巧

在开发者工具Console中，你可以使用过滤功能：

### 按文件过滤
```
[api.ts]
[sourceManage.ts]
[sqlite.ts]
[electron-main]
```

### 按错误过滤
```
Error:
Exception:
SQLITE_
```

### 按时间过滤
```
[2025-11-15T10:30:
```

---

**注意**: 请务必查看完整的调用链日志，从IPC调用到数据库返回的每一步都有详细记录。这将帮助我们精确定位问题所在。
