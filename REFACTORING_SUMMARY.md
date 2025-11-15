# 代码重构总结 - 基于Article的资源管理模式

## 概述

本次重构将原有的**文件夹管理和RSS源管理**模式重构为**以Article（文章）为核心的资源管理模式**，采用多种设计模式来提高代码的可维护性、可扩展性和可测试性。

## 重构前的问题

1. **职责混乱**: `SourceManage` 类既管理文件夹又管理RSS源，还处理数据库操作和OPML导入导出
2. **耦合度高**: `Folder` 和 `Source` 类之间紧密耦合
3. **违反单一职责原则**: 每个类承担了太多不相关的功能
4. **难以测试**: 业务逻辑和数据访问层混合在一起
5. **缺乏抽象**: 没有清晰的资源管理接口

## 重构后的架构

### 采用的设计模式

1. **Domain Model（领域模型）**
   - 以 `Article` 为核心，其他资源作为其属性
   - 清晰的领域边界和实体关系

2. **Repository Pattern（仓储模式）**
   - 分离数据访问逻辑和业务逻辑
   - 提供统一的 CRUD 接口
   - 支持多种存储后端（当前为SQLite）

3. **Service Layer（服务层）**
   - 封装复杂的业务逻辑
   - 协调多个Repository
   - 处理事务和业务规则

4. **Factory Pattern（工厂模式）**
   - 统一创建Repository实例
   - 简化依赖管理

5. **Observer Pattern（观察者模式）**
   - 实现资源变更事件通知
   - 解耦组件之间的依赖

6. **Dependency Injection（依赖注入）**
   - 使用Container统一管理依赖
   - 降低类之间的耦合

### 目录结构

```
src-electron/
├── domain/                           # 领域层
│   ├── models/
│   │   └── Article.ts               # Article领域模型
│   ├── repositories/
│   │   └── Interfaces.ts            # Repository接口定义
│   └── services/
│       └── ArticleService.ts        # Article业务服务
└── infrastructure/                   # 基础设施层
    ├── repositories/
    │   └── ArticleRepositoryImpl.ts # Repository实现
    └── Container.ts                 # 依赖注入容器

src/
└── stores/                          # 前端状态管理
    ├── articleStore.ts              # Article管理Store
    ├── feedStore.ts                 # Feed管理Store
    └── folderStore.ts               # Folder管理Store
```

## 新架构的优势

### 1. 职责清晰

**Article-centric 模型**:
- `Article`: 核心资源，包含所有相关信息
- `FeedSource`: RSS源信息（作为Article的属性）
- `Folder`: 文件夹分类（作为Article的属性）

### 2. 关注点分离

- **Domain Layer**: 定义业务实体和规则
- **Infrastructure Layer**: 实现数据存储和技术细节
- **Application Layer**: 处理业务逻辑
- **Presentation Layer**: 处理UI和用户交互

### 3. 易于测试

```typescript
// 可以轻松mock Repository进行单元测试
const mockRepo = {
  getArticles: jest.fn().mockResolvedValue({ articles: [], total: 0 })
};
const service = new ArticleService(mockRepo, mockFeedRepo, mockFolderRepo);
```

### 4. 易于扩展

- **添加新存储**: 实现Repository接口
- **添加新业务逻辑**: 在Service层添加方法
- **支持事件驱动**: 使用观察者模式

### 5. 向后兼容

保留旧API，确保现有功能正常工作：
```typescript
// 旧API仍然可用
window.electronAPI.getRssInfoListFromDb()

// 新API提供更好的抽象
window.electronAPI.getFeeds()
```

## 关键文件说明

### 1. Article模型 (`src-electron/domain/models/Article.ts`)

定义了核心的领域模型：
- `Article`: 文章实体
- `FeedSource`: RSS源实体
- `Folder`: 文件夹实体
- `ArticleFilter`: 过滤条件
- `ArticleStats`: 统计信息

### 2. Repository接口 (`src-electron/domain/repositories/Interfaces.ts`)

定义了数据访问契约：
- `ArticleRepository`: Article的CRUD操作
- `FeedRepository`: RSS源的CRUD操作
- `FolderRepository`: 文件夹的CRUD操作
- `RepositoryFactory`: Repository工厂

### 3. Repository实现 (`src-electron/infrastructure/repositories/ArticleRepositoryImpl.ts`)

基于SQLite的具体实现：
- `SqliteArticleRepository`
- `SqliteFeedRepository`
- `SqliteFolderRepository`
- `SqliteRepositoryFactory`

### 4. Service层 (`src-electron/domain/services/ArticleService.ts`)

处理复杂的业务逻辑：
- 协调多个Repository
- 实现事务处理
- 发布领域事件
- 提供业务用例

### 5. 依赖注入容器 (`src-electron/infrastructure/Container.ts`)

统一管理依赖：
- 创建Repository实例
- 创建Service实例
- 提供便捷的获取函数

### 6. 前端Store

- `articleStore.ts`: 管理Article状态
- `feedStore.ts`: 管理Feed状态
- `folderStore.ts`: 管理Folder状态

## API变化

### 新API（推荐使用）

```typescript
// Article操作
getArticles({ filter, offset, limit })
getArticle(id)
toggleReadStatus(id)
toggleFavorite(id)
markAllAsRead({ feedId, folderName })
clearAllFavorites()
getArticleStats()

// Feed操作
getFeeds(folderName?)
getFeed(id)
addFeed(feedUrl, title?, folderName?)
removeFeed(id)
syncFeed(id)

// Folder操作
getFolders()
getFolder(name)
addFolder(name)
removeFolder(name)
renameFolder(oldName, newName)
```

### 旧API（保留以兼容）

```typescript
getRssInfoListFromDb()
addRssSubscription(obj)
removeRssSubscription(folderName, rssUrl)
addFolder(folderName)
removeFolder(folderName)
editFolder(oldName, newName)
```

## 使用示例

### 前端使用

```typescript
// 使用新的Store
import { useArticleStore } from '@/stores/articleStore';
import { useFeedStore } from '@/stores/feedStore';
import { useFolderStore } from '@/stores/folderStore';

const articleStore = useArticleStore();
const feedStore = useFeedStore();
const folderStore = useFolderStore();

// 加载文章
await articleStore.loadArticles({ read: false });

// 切换收藏
await articleStore.toggleFavorite(articleId);

// 添加RSS源
await feedStore.addFeed('https://example.com/rss', 'Example');

// 获取统计数据
const stats = articleStore.stats;
```

### 后端使用

```typescript
// 直接使用Service（如果需要）
import { getArticleService } from './infrastructure/Container';

const service = getArticleService();
const articles = await service.getArticles({ folderName: '工作' });
```

## 后续工作

### 待完成（需要进一步实现）

1. **扩展Repository接口方法**：
   - `queryArticleListWithFilter`
   - `queryUnreadPostList`
   - `queryFavoritePostList`
   - `markAllPostsAsRead`
   - 等等

2. **完善StorageUtil接口**：
   - 添加缺失的方法
   - 实现Article相关的数据库操作

3. **逐步迁移现有代码**：
   - 更新所有使用旧API的地方
   - 使用新的Store和Service

4. **清理旧代码**：
   - 删除不必要的旧文件
   - 移除重复的逻辑

### 可选改进

1. **添加缓存层**：
   - 实现本地缓存
   - 提高查询性能

2. **实现事件系统**：
   - 页面自动刷新
   - 实时通知

3. **添加数据验证**：
   - 使用Zod或Joi
   - 确保数据完整性

4. **性能优化**：
   - 分页加载
   - 懒加载

## 总结

通过本次重构，我们实现了：

✅ **职责单一**: 每个类只负责一个特定的功能
✅ **关注点分离**: 业务逻辑、数据访问、UI分离
✅ **易于测试**: 可以轻松mock和单元测试
✅ **易于扩展**: 新的功能可以轻松添加
✅ **向后兼容**: 旧API仍然可用

新的架构为未来的功能扩展和维护奠定了良好的基础。
