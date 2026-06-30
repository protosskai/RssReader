# RSS Reader 渐进式重构实现计划

> **面向 AI 代理的工作者：** 使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 逐任务实现此计划。
> 步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Quasar + Electron RSS Reader 从双路径架构重构为 Clean Architecture + Composables，替换自研解析器为标准库。

**架构：** Clean Architecture 四层分离（domain/application/infrastructure/presentation），前端 14 Pinia Stores → 8 Composables，rss-parser + opml-to-json + fast-xml-parser 替代自研代码。

**技术栈：** Quasar v2.6 + Vue 3 + TypeScript + Electron 22 + SQLite + Vitest + Playwright

---

## 文档引用

- 设计文档：`docs/superpowers/specs/2026-06-30-rss-reader-refactor-design.md`
- 项目根：`/Users/kai/project/RssReader`

---

## Phase 1: 依赖替换

### 任务 1.1：安装新依赖，移除旧依赖

**文件：**

- 修改：`package.json`

- [ ] **步骤 1：安装新库**

```bash
cd /Users/kai/project/RssReader
npm install --save-dev rss-parser opml-to-json fast-xml-parser --legacy-peer-deps
npm install --save-dev @types/rss-parser 2>/dev/null || true
```

- [ ] **步骤 2：移除旧依赖**

```bash
npm uninstall xml2js @types/xml2js --legacy-peer-deps
```

- [ ] **步骤 3：验证**

```bash
node -e "require('rss-parser'); console.log('rss-parser OK')"
node -e "require('opml-to-json'); console.log('opml-to-json OK')"
node -e "require('fast-xml-parser'); console.log('fast-xml-parser OK')"
node -e "try{require('xml2js');process.exit(1)}catch(e){console.log('xml2js removed OK')}"
```

预期：三个新库加载成功，xml2js 报 MODULE_NOT_FOUND

---

## Phase 2: 解析器适配

### 任务 2.1：创建 RssParserAdapter

**文件：**

- 创建：`src-electron/infrastructure/parsing/RssParserAdapter.ts`
- 创建：`src-electron/infrastructure/parsing/types.ts`

- [ ] **步骤 1：创建共享类型**

```typescript
// src-electron/infrastructure/parsing/types.ts
export interface ParsedFeedItem {
  guid: string;
  title: string;
  link: string;
  content: string;
  description: string;
  author?: string;
  pubDate?: string;
  categories?: string[];
}

export interface ParsedFeed {
  title: string;
  link: string;           // website URL (htmlUrl)
  description?: string;
  items: ParsedFeedItem[];
  lastBuildDate?: string;
  language?: string;
}

export interface IRssParser {
  parseUrl(url: string): Promise<ParsedFeed>;
  parseString(xml: string): Promise<ParsedFeed>;
}
```

- [ ] **步骤 2：实现适配器**

```typescript
// src-electron/infrastructure/parsing/RssParserAdapter.ts
import RssParser from 'rss-parser';
import type { IRssParser, ParsedFeed, ParsedFeedItem } from './types';

const parser = new RssParser({
  timeout: 30000,
  headers: { 'User-Agent': 'RssReader/1.0' },
});

function mapItem(item: RssParser.Item & { [key: string]: any }): ParsedFeedItem {
  return {
    guid: item.guid || item.link || '',
    title: item.title || '(no title)',
    link: item.link || '',
    content: item['content:encoded'] || item.content || '',
    description: item.contentSnippet || item.summary || '',
    author: item.creator || item.author,
    pubDate: item.isoDate || item.pubDate,
    categories: item.categories || [],
  };
}

export class RssParserAdapter implements IRssParser {
  async parseUrl(url: string): Promise<ParsedFeed> {
    const feed = await parser.parseURL(url);
    return {
      title: feed.title || 'Untitled Feed',
      link: feed.link || '',
      description: feed.description || feed.title || '',
      items: (feed.items || []).map(mapItem),
      lastBuildDate: feed.lastBuildDate,
      language: feed.language,
    };
  }

  async parseString(xml: string): Promise<ParsedFeed> {
    const feed = await parser.parseString(xml);
    return {
      title: feed.title || 'Untitled Feed',
      link: feed.link || '',
      description: feed.description || feed.title || '',
      items: (feed.items || []).map(mapItem),
      lastBuildDate: feed.lastBuildDate,
    };
  }
}
```

- [ ] **步骤 3：编写测试**

```typescript
// test/unit/RssParserAdapter.test.ts
import { describe, it, expect } from 'vitest';
import { RssParserAdapter } from '../../src-electron/infrastructure/parsing/RssParserAdapter';
import type { ParsedFeed } from '../../src-electron/infrastructure/parsing/types';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>A test feed</description>
    <item>
      <title>Test Article</title>
      <link>https://example.com/1</link>
      <guid>https://example.com/1</guid>
      <description>Article body text</description>
      <author>Test Author</author>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe('RssParserAdapter', () => {
  it('正向：解析有效的 RSS XML 返回 ParsedFeed', async () => {
    const adapter = new RssParserAdapter();
    const result = await adapter.parseString(SAMPLE_RSS);
    expect(result.title).toBe('Test Feed');
    expect(result.link).toBe('https://example.com');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Test Article');
    expect(result.items[0].link).toBe('https://example.com/1');
    expect(result.items[0].author).toBe('Test Author');
  });

  it('边界：空 items 列表返回空数组', async () => {
    const emptyRss = `<?xml version="1.0"?><rss version="2.0"><channel><title>E</title><link>https://x.com</link></channel></rss>`;
    const adapter = new RssParserAdapter();
    const result = await adapter.parseString(emptyRss);
    expect(result.items).toEqual([]);
  });

  it('异常：无效 XML 抛出错误', async () => {
    const adapter = new RssParserAdapter();
    await expect(adapter.parseString('not valid xml')).rejects.toThrow();
  });

  it('等价类：Atom feed 格式也能正确解析', async () => {
    const atomFeed = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Feed</title>
      <link href="https://example.com"/>
      <entry>
        <title>Atom Entry</title>
        <link href="https://example.com/entry"/>
        <id>urn:uuid:123</id>
        <summary>Summary text</summary>
      </entry>
    </feed>`;
    const adapter = new RssParserAdapter();
    const result = await adapter.parseString(atomFeed);
    expect(result.title).toBe('Atom Feed');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Atom Entry');
  });
});
```

- [ ] **步骤 4：运行测试**

```bash
npx vitest run test/unit/RssParserAdapter.test.ts
```

预期：4 tests PASS

### 任务 2.2：创建 OpmlParserAdapter

**文件：**

- 创建：`src-electron/infrastructure/parsing/OpmlParserAdapter.ts`

- [ ] **步骤 1：实现适配器**

```typescript
// src-electron/infrastructure/parsing/OpmlParserAdapter.ts
import opmlToJSON from 'opml-to-json';

export interface OpmlOutline {
  text: string;
  title: string;
  type: 'rss' | 'folder';
  xmlUrl?: string;
  htmlUrl?: string;
  children?: OpmlOutline[];
}

export interface IOpmlParser {
  parse(xml: string): Promise<OpmlOutline[]>;
}

function flatten(outlines: any[]): OpmlOutline[] {
  const result: OpmlOutline[] = [];
  for (const o of outlines) {
    const item: OpmlOutline = {
      text: o.text || '',
      title: o.title || o.text || '',
      type: o.xmlUrl ? 'rss' : 'folder',
      xmlUrl: o.xmlUrl,
      htmlUrl: o.htmlUrl,
    };
    if (o.children && o.children.length > 0) {
      item.children = flatten(o.children);
    }
    result.push(item);
  }
  return result;
}

export class OpmlParserAdapter implements IOpmlParser {
  async parse(xml: string): Promise<OpmlOutline[]> {
    const parsed = await opmlToJSON(xml);
    const body = parsed?.children?.find((c: any) => c.type === 'body');
    if (!body) return [];
    return flatten(body.children || []);
  }
}
```

- [ ] **步骤 2：编写测试**

```typescript
// test/unit/OpmlParserAdapter.test.ts
import { describe, it, expect } from 'vitest';
import { OpmlParserAdapter } from '../../src-electron/infrastructure/parsing/OpmlParserAdapter';

const SAMPLE_OPML = `<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Test OPML</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline text="Hacker News" title="Hacker News" type="rss"
               xmlUrl="https://hnrss.org/frontpage" htmlUrl="https://news.ycombinator.com"/>
    </outline>
    <outline text="xkcd" title="xkcd" type="rss"
             xmlUrl="https://xkcd.com/atom.xml"/>
  </body>
</opml>`;

describe('OpmlParserAdapter', () => {
  it('正向：解析有效 OPML 返回正确的文件夹和源结构', async () => {
    const adapter = new OpmlParserAdapter();
    const result = await adapter.parse(SAMPLE_OPML);
    expect(result).toHaveLength(2);
    // Tech folder with one child
    expect(result[0].text).toBe('Tech');
    expect(result[0].type).toBe('folder');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].text).toBe('Hacker News');
    expect(result[0].children![0].xmlUrl).toBe('https://hnrss.org/frontpage');
    // Standalone feed
    expect(result[1].text).toBe('xkcd');
    expect(result[1].type).toBe('rss');
    expect(result[1].xmlUrl).toBe('https://xkcd.com/atom.xml');
  });

  it('边界：空 body 返回空数组', async () => {
    const empty = '<?xml version="1.0"?><opml version="2.0"><head/><body/></opml>';
    const adapter = new OpmlParserAdapter();
    const result = await adapter.parse(empty);
    expect(result).toEqual([]);
  });

  it('异常：无效 XML 抛出错误', async () => {
    const adapter = new OpmlParserAdapter();
    await expect(adapter.parse('garbage')).rejects.toThrow();
  });
});
```

- [ ] **步骤 3：运行测试**

```bash
npx vitest run test/unit/OpmlParserAdapter.test.ts
```

预期：3 tests PASS

---

## Phase 3: 后端目录重组

### 任务 3.1：建立目录结构 + 迁移文件

**文件：**

- 创建：`src-electron/domain/models/`（移动 Article.ts 相关）
- 创建：`src-electron/domain/repositories/`（移动 Interfaces.ts）
- 创建：`src-electron/application/services/`（移动 ArticleService.ts）
- 创建：`src-electron/infrastructure/persistence/`（移动 RepositoryImpl, SqliteHelper）
- 创建：`src-electron/infrastructure/network/`（移动 NetUtil, CacheManager）
- 创建：`src-electron/infrastructure/parsing/`（已有）
- 创建：`src-electron/infrastructure/di/`（移动 Container.ts）
- 创建：`src-electron/presentation/ipc/`
- 创建：`src-electron/shared/errors/`

- [ ] **步骤 1：创建所有新目录**

```bash
cd /Users/kai/project/RssReader
mkdir -p src-electron/domain/models
mkdir -p src-electron/domain/repositories
mkdir -p src-electron/domain/value-objects
mkdir -p src-electron/application/services
mkdir -p src-electron/application/ports
mkdir -p src-electron/infrastructure/persistence/migrations
mkdir -p src-electron/infrastructure/network
mkdir -p src-electron/infrastructure/parsing
mkdir -p src-electron/infrastructure/di
mkdir -p src-electron/presentation/ipc
mkdir -p src-electron/shared/errors
mkdir -p src-electron/shared/logger
```

- [ ] **步骤 2：读取并重写迁移文件**

读取每个文件，更新 import 路径，写入新位置。逐个处理：

```bash
# 1. domain/models/Article.ts → 保持不变（已是 re-export）
cp src-electron/domain/models/Article.ts src-electron/domain/models/index.ts 2>/dev/null || true

# 2. domain/repositories/Interfaces.ts → 写入新位置
# 3. domain/services/ArticleService.ts → application/services/
# 4. infrastructure/repositories/ArticleRepositoryImpl.ts → infrastructure/persistence/
# 5. infrastructure/Container.ts → infrastructure/di/
# 6. storage/SqliteHelper.ts → infrastructure/persistence/
# 7. storage/SqliteUtilV2.ts → infrastructure/persistence/
# 8. net/NetUtil.ts → infrastructure/network/
# 9. net/CacheManager.ts → infrastructure/network/
# 10. electron-main.ts → presentation/main.ts
# 11. electron-preload.ts → presentation/preload.ts
```

- [ ] **步骤 3：更新所有 import 路径**

```bash
# 全局替换 import 路径
cd /Users/kai/project/RssReader
# 更新引用 domain/models 的路径
find src-electron -name "*.ts" -exec sed -i '' 's|from "../../domain/models/Article"|from "../domain/models/index"|g' {} \;
find src-electron -name "*.ts" -exec sed -i '' 's|from "../../domain/repositories/Interfaces"|from "../domain/repositories/Interfaces"|g' {} \;
# 清理 rss/ 目录中已经没人引用的文件
```

- [ ] **步骤 4：验证 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | grep -v "test/" | grep -v "dist/" | grep "error TS" | head -20
```

预期：0 errors（source 文件）

### 任务 3.2：创建 Result<T> 和 AppError 类型

**文件：**

- 创建：`src-electron/shared/errors/AppError.ts`
- 创建：`src-electron/shared/errors/Result.ts`

- [ ] **步骤 1：实现 AppError**

```typescript
// src-electron/shared/errors/AppError.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(entity: string, id: string): AppError {
    return new AppError(`${entity} not found: ${id}`, 'NOT_FOUND', 404);
  }

  static validationError(message: string): AppError {
    return new AppError(message, 'VALIDATION_ERROR', 400);
  }

  static internal(message: string, original?: unknown): AppError {
    return new AppError(message, 'INTERNAL_ERROR', 500, original);
  }
}
```

- [ ] **步骤 2：实现 Result<T>**

```typescript
// src-electron/shared/errors/Result.ts
export type Result<T, E = Error> = Success<T> | Failure<E>;

export class Success<T> {
  readonly ok = true as const;
  constructor(public readonly value: T) {}
}

export class Failure<E = Error> {
  readonly ok = false as const;
  constructor(public readonly error: E) {}
}

export function success<T>(value: T): Success<T> {
  return new Success(value);
}

export function failure<E = Error>(error: E): Failure<E> {
  return new Failure(error);
}
```

- [ ] **步骤 3：测试**

```typescript
// test/unit/Result.test.ts
import { describe, it, expect } from 'vitest';
import { success, failure } from '../../src-electron/shared/errors/Result';
import { AppError } from '../../src-electron/shared/errors/AppError';

describe('Result', () => {
  it('正向：success 返回 ok=true', () => {
    const r = success('hello');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('hello');
  });

  it('正向：failure 返回 ok=false', () => {
    const r = failure(new AppError('bad', 'ERR', 400));
    expect(r.ok).toBe(false);
    expect(r.error.message).toBe('bad');
  });
});
```

```bash
npx vitest run test/unit/Result.test.ts
```

---

## Phase 4: 删除旧代码

### 任务 4.1：删除 src-electron/rss/ 目录

**文件：**

- 删除：`src-electron/rss/api.ts`
- 删除：`src-electron/rss/sourceManage.ts`
- 删除：`src-electron/rss/parser/FeedParser.ts`
- 删除：`src-electron/rss/opmlUtil.ts`
- 删除：`src-electron/rss/feedFetcher.ts`
- 删除：`src-electron/rss/subscriptionManager.ts`
- 删除：`src-electron/rss/folderManager.ts`
- 删除：`src-electron/rss/postListManeger.ts`
- 删除：`src-electron/rss/postQueries.ts`
- 删除：`src-electron/rss/utils.ts`

- [ ] **步骤 1：确认无引用**

```bash
cd /Users/kai/project/RssReader
# 检查是否还有代码引用这些文件
rg -l "from.*rss/api\|from.*rss/sourceManage\|from.*rss/FeedParser\|from.*rss/opmlUtil\|from.*rss/feedFetcher" src/ src-electron/ --type ts 2>/dev/null
```

预期：无输出（或只有 import 残留需要清理）

- [ ] **步骤 2：删除文件**

```bash
rm -rf src-electron/rss/api.ts
rm -rf src-electron/rss/sourceManage.ts
rm -rf src-electron/rss/parser/FeedParser.ts
rm -rf src-electron/rss/opmlUtil.ts
rm -rf src-electron/rss/feedFetcher.ts
rm -rf src-electron/rss/subscriptionManager.ts
rm -rf src-electron/rss/folderManager.ts
rm -rf src-electron/rss/postListManeger.ts
rm -rf src-electron/rss/postQueries.ts
rm -rf src-electron/rss/utils.ts
```

- [ ] **步骤 3：清理残留 import**

```bash
# 全局搜索还有引用旧路径的 import
rg -n "rss/api\|rss/sourceManage\|rss/FeedParser\|rss/opmlUtil" src/ src-electron/ --type ts
```

任何残留的 import 都需要替换为新的导入路径。

- [ ] **步骤 4：验证编译 + 测试**

```bash
npx tsc --noEmit 2>&1 | grep -v "test/\|dist/" | grep "error TS" | wc -l
npx vitest run 2>&1 | tail -5
```

预期：source 0 errors，所有现有测试仍通过

---

## Phase 5: IPC 重写

### 任务 5.1：按领域拆分 IPC handler

**文件：**

- 创建：`src-electron/presentation/ipc/article.handler.ts`
- 创建：`src-electron/presentation/ipc/feed.handler.ts`
- 创建：`src-electron/presentation/ipc/folder.handler.ts`
- 创建：`src-electron/presentation/ipc/opml.handler.ts`
- 修改：`src-electron/presentation/main.ts`（原 electron-main.ts）

- [ ] **步骤 1：创建 article.handler.ts**

将所有文章相关的 IPC handler（rss:queryPostIndexByRssId, rss:queryPostContentByGuid, rss:searchPosts, article:*, favorite:* 等）迁移到一个文件：

```typescript
// src-electron/presentation/ipc/article.handler.ts
import { ipcMain } from 'electron';
import { getArticleService } from '../../infrastructure/di/Container';
import { AppError } from '../../shared/errors/AppError';

export function registerArticleHandlers(): void {
  const service = getArticleService();

  ipcMain.handle('article:getArticles', async (_event, filter, offset, limit) => {
    try {
      return { success: true, data: await service.getArticles(filter, offset, limit) };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('article:getById', async (_event, id: string) => {
    try {
      const article = await service.getArticle(id);
      return { success: true, data: article };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('article:toggleRead', async (_event, id: string) => {
    try {
      await service.toggleReadStatus(id);
      return { success: true };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('article:toggleFavorite', async (_event, id: string) => {
    try {
      const state = await service.toggleFavorite(id);
      return { success: true, data: state };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('article:markAllRead', async (_event, feedId?: string, folderName?: string) => {
    try {
      await service.markAllRead(feedId, folderName);
      return { success: true };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('article:search', async (_event, query: string, options?: Record<string, unknown>) => {
    try {
      const result = await service.search(query, options);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('article:getStats', async () => {
    try {
      const stats = await service.getStats();
      return { success: true, data: stats };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });
}
```

- [ ] **步骤 2：创建 feed.handler.ts**

```typescript
// src-electron/presentation/ipc/feed.handler.ts
import { ipcMain } from 'electron';
import { getArticleService } from '../../infrastructure/di/Container';

export function registerFeedHandlers(): void {
  const service = getArticleService();

  ipcMain.handle('feed:add', async (_event, feedUrl: string, title?: string, folderName?: string) => {
    try {
      const feed = await service.addFeed(feedUrl, title, folderName);
      return { success: true, data: feed };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('feed:getAll', async (_event, folderName?: string) => {
    try {
      const feeds = await service.getFeeds(folderName);
      return { success: true, data: feeds };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('feed:remove', async (_event, id: string) => {
    try {
      await service.deleteFeed(id);
      return { success: true };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('feed:sync', async (_event, id: string) => {
    try {
      const result = await service.syncFeed(id);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });
}
```

- [ ] **步骤 3：创建 folder.handler.ts**

```typescript
// src-electron/presentation/ipc/folder.handler.ts
import { ipcMain } from 'electron';
import { getArticleService } from '../../infrastructure/di/Container';

export function registerFolderHandlers(): void {
  const service = getArticleService();

  ipcMain.handle('folder:getAll', async () => {
    try {
      const folders = await service.getFolders();
      return { success: true, data: folders };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('folder:add', async (_event, name: string) => {
    try {
      const folder = await service.addFolder(name);
      return { success: true, data: folder };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('folder:remove', async (_event, name: string) => {
    try {
      await service.deleteFolder(name);
      return { success: true };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('folder:rename', async (_event, oldName: string, newName: string) => {
    try {
      await service.renameFolder(oldName, newName);
      return { success: true };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });
}
```

- [ ] **步骤 4：更新 main.ts 注册 handler**

```typescript
// src-electron/presentation/main.ts (原 electron-main.ts)
import { registerArticleHandlers } from './ipc/article.handler';
import { registerFeedHandlers } from './ipc/feed.handler';
import { registerFolderHandlers } from './ipc/folder.handler';

// 在 app.whenReady() 中替换旧 IPC handler 注册：
registerArticleHandlers();
registerFeedHandlers();
registerFolderHandlers();
```

- [ ] **步骤 5：更新 preload.ts 的 channel 名称**

```typescript
// src-electron/presentation/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // Articles
  getArticles: (filter: object, offset: number, limit: number) =>
    ipcRenderer.invoke('article:getArticles', filter, offset, limit),
  getArticleById: (id: string) =>
    ipcRenderer.invoke('article:getById', id),
  toggleRead: (id: string) =>
    ipcRenderer.invoke('article:toggleRead', id),
  toggleFavorite: (id: string) =>
    ipcRenderer.invoke('article:toggleFavorite', id),
  markAllRead: (feedId?: string, folderName?: string) =>
    ipcRenderer.invoke('article:markAllRead', feedId, folderName),
  searchPosts: (query: string, options?: object) =>
    ipcRenderer.invoke('article:search', query, options),
  getStats: () =>
    ipcRenderer.invoke('article:getStats'),
  // Feeds
  addFeed: (url: string, title?: string, folderName?: string) =>
    ipcRenderer.invoke('feed:add', url, title, folderName),
  getAllFeeds: (folderName?: string) =>
    ipcRenderer.invoke('feed:getAll', folderName),
  removeFeed: (id: string) =>
    ipcRenderer.invoke('feed:remove', id),
  syncFeed: (id: string) =>
    ipcRenderer.invoke('feed:sync', id),
  // Folders
  getFolders: () =>
    ipcRenderer.invoke('folder:getAll'),
  addFolder: (name: string) =>
    ipcRenderer.invoke('folder:add', name),
  removeFolder: (name: string) =>
    ipcRenderer.invoke('folder:remove', name),
  renameFolder: (oldName: string, newName: string) =>
    ipcRenderer.invoke('folder:rename', oldName, newName),
  // Old channels for backward compat (marked @deprecated)
  getRssInfoListFromDb: () =>
    ipcRenderer.invoke('feed:getAll'),
  queryPostIndexByRssId: (rssId: string, offset: number, limit: number) =>
    ipcRenderer.invoke('article:getArticles', { feedId: rssId }, offset, limit),
  queryPostContentByGuid: (guid: string) =>
    ipcRenderer.invoke('article:getById', guid),
  // ... keep other old names for transition
});
```

- [ ] **步骤 6：验证**

```bash
npx tsc --noEmit 2>&1 | grep -v "test/\|dist/" | grep "error TS" | wc -l
npx vitest run 2>&1 | tail -3
```

预期：source 0 errors，测试通过

---

## Phase 6: 前端 Composables 重构

### 任务 6.1：创建 8 个 Composables

**文件（创建）：**

- `src/composables/useArticles.ts`
- `src/composables/useSubscriptions.ts`
- `src/composables/useFolders.ts`
- `src/composables/useFavorites.ts`
- `src/composables/useSync.ts`
- `src/composables/useTheme.ts`
- `src/composables/useKeyboard.ts`
- `src/composables/useUI.ts`

- [ ] **步骤 1：useArticles.ts — 文章列表 + 搜索 + 已读/收藏**

```typescript
// src/composables/useArticles.ts
import { ref, computed } from 'vue';
import type { Article, ArticleFilter } from 'src/common/models';

export function useArticles() {
  const articles = ref<Article[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const searchQuery = ref('');
  const searchResults = ref<Article[]>([]);

  const unreadCount = computed(() => articles.value.filter(a => !a.read).length);
  const favoriteArticles = computed(() => articles.value.filter(a => a.favorite));

  async function fetchArticles(filter?: ArticleFilter, offset = 0, limit = 50) {
    loading.value = true;
    error.value = null;
    try {
      const result = await window.electronAPI.getArticles(filter, offset, limit);
      if (result.success) {
        articles.value = result.data;
        return result.data;
      } else {
        throw new Error(result.msg);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load articles';
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function toggleRead(id: string) {
    const result = await window.electronAPI.toggleRead(id);
    if (result.success) {
      const article = articles.value.find(a => a.id === id);
      if (article) article.read = !article.read;
    }
  }

  async function toggleFavorite(id: string) {
    const result = await window.electronAPI.toggleFavorite(id);
    if (result.success) {
      const article = articles.value.find(a => a.id === id);
      if (article) article.favorite = result.data;
    }
  }

  async function search(query: string) {
    searchQuery.value = query;
    loading.value = true;
    try {
      const result = await window.electronAPI.searchPosts(query);
      searchResults.value = result.success ? result.data : [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Search failed';
    } finally {
      loading.value = false;
    }
  }

  async function markAllRead(feedId?: string, folderName?: string) {
    await window.electronAPI.markAllRead(feedId, folderName);
    articles.value.forEach(a => {
      if (!feedId || a.feedId === feedId) a.read = true;
    });
  }

  return {
    articles, loading, error, searchQuery, searchResults,
    unreadCount, favoriteArticles,
    fetchArticles, toggleRead, toggleFavorite, search, markAllRead,
  };
}
```

- [ ] **步骤 2-8：以类似模式创建其他 7 个 composables**

`useSubscriptions.ts` — 订阅源 CRUD
`useFolders.ts` — 文件夹 CRUD
`useFavorites.ts` — 收藏列表
`useSync.ts` — 同步状态+进度
`useTheme.ts` — 暗色/亮色切换
`useKeyboard.ts` — 快捷键注册
`useUI.ts` — loading overlay、dialog 全局状态

每个 composable 遵循相同模式：

1. reactive state (ref/reactive)
2. computed properties
3. async CRUD functions (with loading/error state)
4. return state + methods

### 任务 6.2：迁移组件引用

**文件（修改）：** 所有引用 Pinia Store 的 .vue 文件

- [ ] **步骤 1：更新组件**

将所有 `import { useXxxStore } from 'stores/xxxStore'` 替换为 `import { useXxx } from 'src/composables/useXxx'`

将所有 `const store = useXxxStore()` 替换为 `const { state, methods } = useXxx()`

- [ ] **步骤 2：更新 provide/inject（可选）**

如需跨组件共享 composable 实例：

```typescript
// src/composables/useArticles.ts — 添加 provide/inject 支持
import { inject, provide } from 'vue';

const ARTICLES_KEY = Symbol('articles');

export function provideArticles() {
  const articles = useArticles();
  provide(ARTICLES_KEY, articles);
  return articles;
}

export function injectArticles() {
  return inject<ReturnType<typeof useArticles>>(ARTICLES_KEY)!;
}
```

### 任务 6.3：删除旧 Store 文件

**文件（删除）：** 已迁移到 composables 的 Pinia store 文件

- [ ] **步骤 1：确认无引用后删除**

```bash
cd /Users/kai/project/RssReader
# 确认每个旧 store 不再被引用
rg -l "rssInfoStore\|articleStore\|feedStore\|favoriteStore\|folderStore\|searchStore\|readingStore\|syncProgressStore\|loadingStore\|themeStore\|keyboardStore\|systemDialogStore" src/ --type ts --type vue
```

预期：无输出

```bash
# 删除旧的 store 文件
rm -f src/stores/rssInfoStore.ts
rm -f src/stores/articleStore.ts
rm -f src/stores/feedStore.ts
# ... 删除全部 14 个
```

- [ ] **步骤 2：验证**

```bash
npx tsc --noEmit 2>&1 | grep -v "test/\|dist/" | grep "error TS" | wc -l
```

预期：0

---

## Phase 7: 性能优化 + 端到端验证

### 任务 7.1：虚拟滚动

**文件：**

- 修改：`src/pages/PostList.vue`

- [ ] **步骤 1：安装 q-virtual-scroll**

```bash
# Quasar 内置 QVirtualScroll 组件
```

- [ ] **步骤 2：改造 PostList 使用虚拟滚动**

```vue
<template>
  <q-virtual-scroll
    :items="articles"
    :virtual-scroll-item-size="72"
    @virtual-scroll="onScroll"
  >
    <template v-slot="{ item, index }">
      <PostListItem :article="item" :key="item.id" />
    </template>
  </q-virtual-scroll>
</template>
```

### 任务 7.2：数据库查询优化

**文件：**

- 修改：`src-electron/infrastructure/persistence/SqliteHelper.ts`

- [ ] **步骤 1：确认索引存在**

```sql
-- 检查并创建必要的索引
CREATE INDEX IF NOT EXISTS idx_post_read ON post_info(read);
CREATE INDEX IF NOT EXISTS idx_post_rss_id ON post_info(rss_id);
CREATE INDEX IF NOT EXISTS idx_post_update_time ON post_info(update_time);
CREATE INDEX IF NOT EXISTS idx_post_favorite ON post_info(favorite);
```

### 任务 7.3：端到端 Playwright 验证

**文件：**

- 更新：`playwright-e2e.ts`

- [ ] **步骤 1：运行完整的 Playwright 测试**

```bash
cd /Users/kai/project/RssReader
npx quasar dev -m electron &
# Wait for dev server
npx tsx playwright-e2e.ts
```

预期：所有 E2E 测试通过，app 加载、RSS 内容渲染正常。

### 任务 7.4：全量测试运行

```bash
cd /Users/kai/project/RssReader
npx vitest run
```

预期：所有 510+ 测试通过。

---

## 自检

完成所有 7 个 Phase 后，进行以下自检：

1. `npx tsc --noEmit` — source files 0 errors
2. `npx vitest run` — all tests pass
3. Playwright E2E — app loads, feeds visible, content renders
4. `find src-electron/rss -type f` — directory empty or deleted
5. `rg "xml2js" package.json` — no match
6. `rg "from.*stores/" src/` — no Pinia store imports remain
