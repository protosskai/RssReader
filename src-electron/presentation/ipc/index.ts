/**
 * Unified IPC Handler Registration
 *
 * All IPC handlers are registered here via registerAllHandlers().
 * electron-main.ts calls this once after DB init, before creating the window.
 */

import type { IpcMain } from 'electron';
import { BrowserWindow, shell, dialog } from 'electron';
import fs from 'fs';
import type { ArticleService } from '../../application/services/ArticleService';
import type { SyncManager } from '../../services/SyncManager';
import type {
  RssInfoNew,
  RssFolderItem,
  RssInfoItem,
  PostIndexItem,
  Article,
  ContentInfo,
} from 'src/common/models';
import {
  createSuccessResponse,
  createVoidSuccessResponse,
} from 'src/common/ErrorMsg';
import { OpmlParserAdapter } from '../../infrastructure/parsing/OpmlParserAdapter';

// ── Security constants ──────────────────────────────────────────────────

const MAX_CONTENT_BYTES = 10 * 1024 * 1024;
const MAX_ARTICLES_PER_PAGE = 500;
const MAX_SEARCH_RESULTS = 200;
const MAX_STRING_PARAM = 4096;
const MAX_ID_PARAM = 512;
const MAX_FOLDER_NAME = 256;
const MAX_QUERY_LENGTH = 1024;

interface IpcResponse<T = unknown> {
  error?: string;
  data?: T;
}

// ── Validators ──────────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function validateString(value: unknown, label: string, maxLen = MAX_STRING_PARAM): asserts value is string {
  if (!isString(value)) throw new Error(`INVALID_PARAM: ${label} must be a string, got ${typeof value}`);
  if (value.length === 0) throw new Error(`INVALID_PARAM: ${label} must not be empty`);
  if (value.length > maxLen) throw new Error(`INVALID_PARAM: ${label} exceeds max length ${maxLen} (got ${value.length})`);
}

function validateUrl(url: unknown): asserts url is string {
  validateString(url, 'url', MAX_STRING_PARAM);
  try {
    const parsed = new URL(url as string);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`INVALID_PARAM: URL protocol must be http or https, got ${parsed.protocol}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith('INVALID_PARAM:')) throw e;
    throw new Error(`INVALID_PARAM: malformed URL — ${msg}`);
  }
}

function validateFolderName(name: unknown): asserts name is string {
  validateString(name, 'folderName', MAX_FOLDER_NAME);
  const n = name as string;
  if (/[<>:"/\\|?*\x00-\x1f]/.test(n)) throw new Error('INVALID_PARAM: folderName contains invalid characters');
  if (n.includes('..')) throw new Error('INVALID_PARAM: folderName contains path traversal sequence (..)');
  if (n.trim().length === 0) throw new Error('INVALID_PARAM: folderName must not be whitespace-only');
}

function validateId(id: unknown, label: string): asserts id is string {
  validateString(id, label, MAX_ID_PARAM);
  if (/[<>:"/\\|?*\x00-\x1f]/.test(id as string)) throw new Error(`INVALID_PARAM: ${label} contains invalid characters`);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function wrapHandler<T>(fn: (...args: unknown[]) => Promise<T> | T) {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: unknown[]): Promise<IpcResponse<T>> => {
    try {
      const data = await fn(...args);
      return { data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[IPC ERROR]', msg);
      return { error: msg };
    }
  };
}

function clampContent<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    const rec = obj as Record<string, unknown>;
    if ('data' in rec && rec.data && typeof rec.data === 'object') {
      const inner = rec.data as Record<string, unknown>;
      if ('content' in inner && typeof inner.content === 'string') {
        const c = inner.content as string;
        if (c.length > MAX_CONTENT_BYTES) inner.content = c.slice(0, MAX_CONTENT_BYTES) + '…[truncated]';
      }
    }
    if ('content' in rec && typeof rec.content === 'string') {
      const c = rec.content as string;
      if (c.length > MAX_CONTENT_BYTES) rec.content = c.slice(0, MAX_CONTENT_BYTES) + '…[truncated]';
    }
  }
  return obj;
}

function clampSummary(summary: string): string {
  return summary.length > MAX_CONTENT_BYTES ? summary.slice(0, MAX_CONTENT_BYTES) + '…[truncated]' : summary;
}

// ── Registration ────────────────────────────────────────────────────────

export function registerAllHandlers(
  ipcMain: IpcMain,
  articleService: ArticleService,
  syncManager: SyncManager,
): void {
  // ==================== Legacy RSS Handlers ====================

  ipcMain.handle('rss:addRssSubscription', wrapHandler(async (obj: unknown) => {
    if (!obj || typeof obj !== 'object' || !(obj as Record<string, unknown>).feedUrl) {
      throw new Error('INVALID_PARAM: expected object with feedUrl property');
    }
    const o = obj as Record<string, unknown>;
    validateUrl(o.feedUrl);
    if (o.title !== undefined && o.title !== null) validateString(o.title, 'title', 256);
    if (o.folderName !== undefined && o.folderName !== null) validateFolderName(o.folderName);
    const payload = obj as RssInfoNew;
    await articleService.addFeed(payload.feedUrl, payload.title, payload.folderName);
    return createVoidSuccessResponse();
  }));

  ipcMain.handle('rss:removeRssSubscription', wrapHandler(async (folderName: unknown, rssUrl: unknown) => {
    validateFolderName(folderName);
    validateUrl(rssUrl);
    const feeds = await articleService.getFeeds(folderName as string);
    const feed = feeds.find(f => f.url === rssUrl);
    if (!feed) throw new Error('Subscription not found: ' + rssUrl);
    await articleService.removeFeed(feed.id);
    return createVoidSuccessResponse();
  }));

  ipcMain.handle('rss:queryPostContentByGuid', wrapHandler(async (postId: unknown) => {
    validateId(postId, 'guid');
    const article = await articleService.getArticle(postId as string);
    if (!article) throw new Error('Article not found: ' + postId);

    const feed = article.feedId ? await articleService.getFeed(article.feedId) : null;

    const contentInfo: ContentInfo = {
      title: article.title,
      content: article.content,
      link: article.link,
      author: article.author || feed?.title || '',
      updateTime: article.updateTime instanceof Date ? article.updateTime.toISOString() : String(article.updateTime || ''),
      rssId: article.feedId,
      read: article.read ? 1 : 0,
      favorite: article.favorite ? 1 : 0,
      rssSource: {
        rssId: article.feedId,
        url: feed?.url || '',
        name: feed?.title || article.feedTitle || '',
        folder: article.folderName || feed?.folderName || '',
        avatar: feed?.avatar || article.avatar || '',
        htmlUrl: feed?.htmlUrl || '',
      },
    };
    return clampContent(createSuccessResponse(contentInfo));
  }));

  ipcMain.handle('rss:importOpmlFile', wrapHandler(async () => {
    const dialogResult = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (!dialogResult.canceled && dialogResult.filePaths.length > 0) {
      const filePath = dialogResult.filePaths[0];
      const parser = new OpmlParserAdapter();
      const outlines = await parser.parse(await fs.promises.readFile(filePath, 'utf-8'));

      for (const outline of outlines) {
        if (outline.type === 'rss' && outline.xmlUrl) {
          await articleService.addFeed(outline.xmlUrl, outline.title || outline.text);
        } else if (outline.type === 'folder') {
          const folderName = outline.title || outline.text;
          if (folderName) {
            try { await articleService.addFolder(folderName); } catch { /* may exist */ }
          }
          if (outline.children) {
            for (const child of outline.children) {
              if (child.type === 'rss' && child.xmlUrl) {
                await articleService.addFeed(child.xmlUrl, child.title || child.text, folderName);
              }
            }
          }
        }
      }
    }
    return createVoidSuccessResponse();
  }));

  // ==================== Window & System ====================

  ipcMain.handle('openLink', wrapHandler(async (url: unknown) => {
    validateUrl(url);
    await shell.openExternal(url as string);
    return undefined;
  }));

  ipcMain.handle('close', () => {
    BrowserWindow.getFocusedWindow()?.close();
  });

  ipcMain.handle('minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  // ==================== Legacy Folders ====================

  ipcMain.handle('addFolder', wrapHandler(async (folderName: unknown) => {
    validateFolderName(folderName);
    await articleService.addFolder(folderName as string);
    return createVoidSuccessResponse();
  }));

  ipcMain.handle('editFolder', wrapHandler(async (oldFolderName: unknown, newFolderName: unknown) => {
    validateFolderName(oldFolderName);
    validateFolderName(newFolderName);
    await articleService.renameFolder(oldFolderName as string, newFolderName as string);
    return createVoidSuccessResponse();
  }));

  ipcMain.handle('removeFolder', wrapHandler(async (folderName: unknown) => {
    validateFolderName(folderName);
    await articleService.removeFolder(folderName as string);
    return createVoidSuccessResponse();
  }));

  ipcMain.handle('rss:dumpFolderToDb', wrapHandler(async () => createVoidSuccessResponse()));

  ipcMain.handle('rss:loadFolderFromDb', wrapHandler(async () => {
    const folders = await articleService.getFolders();
    return createSuccessResponse(JSON.stringify(folders));
  }));

  ipcMain.handle('rss:getRssInfoListFromDb', wrapHandler(async () => {
    const folders = await articleService.getFolders();
    const result: RssFolderItem[] = [];

    for (const folder of folders) {
      const feeds = await articleService.getFeeds(folder.name);
      const rssInfoList: RssInfoItem[] = feeds.map(feed => ({
        id: feed.id,
        title: feed.title,
        unread: feed.unreadCount,
        htmlUrl: feed.htmlUrl,
        feedUrl: feed.url,
        avatar: feed.avatar || '',
        lastUpdateTime: feed.lastUpdateTime
          ? feed.lastUpdateTime instanceof Date ? feed.lastUpdateTime.toISOString() : String(feed.lastUpdateTime)
          : undefined,
        etag: undefined,
        lastModified: undefined,
      }));

      result.push({ folderName: folder.name, data: rssInfoList, children: [] });
    }
    return createSuccessResponse(result);
  }));

  ipcMain.handle('rss:queryPostIndexByRssId', wrapHandler(async (rssId: unknown) => {
    validateId(rssId, 'rssId');
    const articlesResult = await articleService.getArticles({ feedId: rssId as string }, 0, 500);
    const posts: PostIndexItem[] = articlesResult.articles.map(article => ({
      title: article.title,
      guid: article.id,
      link: article.link,
      author: article.author || '',
      updateTime: article.updateTime instanceof Date ? article.updateTime.toISOString() : String(article.updateTime || ''),
      read: article.read,
      desc: article.description || article.content || '',
      rssId: article.feedId,
    }));
    return createSuccessResponse(posts);
  }));

  ipcMain.handle('rss:fetchRssIndexList', wrapHandler(async (rssId: unknown) => {
    validateId(rssId, 'rssId');
    await articleService.syncFeed(rssId as string);
    return createSuccessResponse({ success: true, msg: '' });
  }));

  // ==================== Article Handlers ====================

  ipcMain.handle('article:getArticles', wrapHandler(async (params: unknown) => {
    const p = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
    const filter = (p.filter && typeof p.filter === 'object' ? p.filter : {}) as Record<string, unknown>;
    if (typeof filter.keyword === 'string') {
      if (filter.keyword.length > MAX_QUERY_LENGTH) throw new Error(`INVALID_PARAM: filter.keyword exceeds max length ${MAX_QUERY_LENGTH}`);
    }
    const offset = typeof p.offset === 'number' && Number.isFinite(p.offset) && p.offset >= 0 ? p.offset : 0;
    const limit = typeof p.limit === 'number' && Number.isFinite(p.limit) && p.limit > 0 ? Math.min(p.limit, MAX_ARTICLES_PER_PAGE) : 50;
    return await articleService.getArticles(filter, offset, limit);
  }));

  ipcMain.handle('article:getArticle', wrapHandler(async (id: unknown) => {
    validateId(id, 'id');
    const result = await articleService.getArticle(id);
    return result ? clampContent(result) : result;
  }));

  ipcMain.handle('article:toggleReadStatus', wrapHandler(async (id: unknown) => {
    validateId(id, 'id');
    await articleService.toggleReadStatus(id);
    return undefined;
  }));

  ipcMain.handle('article:toggleFavorite', wrapHandler(async (id: unknown) => {
    validateId(id, 'id');
    return await articleService.toggleFavorite(id);
  }));

  ipcMain.handle('article:markAllAsRead', wrapHandler(async (params: unknown) => {
    const p = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
    if (p.feedId !== undefined && p.feedId !== null) validateId(p.feedId, 'feedId');
    if (p.folderName !== undefined && p.folderName !== null) validateFolderName(p.folderName);
    await articleService.markAllAsRead(p);
    return undefined;
  }));

  ipcMain.handle('article:clearAllFavorites', wrapHandler(async () => {
    await articleService.clearAllFavorites();
    return undefined;
  }));

  ipcMain.handle('article:getStats', wrapHandler(() => articleService.getStats()));

  // ==================== Feed Handlers ====================

  ipcMain.handle('feed:getFeeds', wrapHandler(async (folderName: unknown) => {
    if (folderName !== undefined && folderName !== null) validateFolderName(folderName);
    return await articleService.getFeeds(folderName as string | undefined);
  }));

  ipcMain.handle('feed:getFeed', wrapHandler(async (id: unknown) => {
    validateId(id, 'id');
    return await articleService.getFeed(id);
  }));

  ipcMain.handle('feed:addFeed', wrapHandler(async (payload: unknown) => {
    if (!payload || typeof payload !== 'object') throw new Error('INVALID_PARAM: expected object { feedUrl, title?, folderName? }');
    const p = payload as Record<string, unknown>;
    validateUrl(p.feedUrl);
    if (p.title !== undefined && p.title !== null) validateString(p.title, 'title', 256);
    if (p.folderName !== undefined && p.folderName !== null) validateFolderName(p.folderName);
    await articleService.addFeed(p.feedUrl as string, p.title as string | undefined, p.folderName as string | undefined);
    return undefined;
  }));

  ipcMain.handle('feed:removeFeed', wrapHandler(async (id: unknown) => {
    validateId(id, 'id');
    await articleService.removeFeed(id);
    return undefined;
  }));

  ipcMain.handle('feed:syncFeed', wrapHandler(async (id: unknown) => {
    validateId(id, 'id');
    await articleService.syncFeed(id);
    return undefined;
  }));

  // ==================== Folder Handlers (v2) ====================

  ipcMain.handle('folder:getFolders', wrapHandler(() => articleService.getFolders()));

  ipcMain.handle('folder:getFolder', wrapHandler(async (name: unknown) => {
    validateFolderName(name);
    return await articleService.getFolder(name);
  }));

  ipcMain.handle('folder:addFolder', wrapHandler(async (name: unknown) => {
    validateFolderName(name);
    await articleService.addFolder(name);
    return undefined;
  }));

  ipcMain.handle('folder:removeFolder', wrapHandler(async (name: unknown) => {
    validateFolderName(name);
    await articleService.removeFolder(name);
    return undefined;
  }));

  ipcMain.handle('folder:renameFolder', wrapHandler(async (oldName: unknown, newName: unknown) => {
    validateFolderName(oldName);
    validateFolderName(newName);
    await articleService.renameFolder(oldName, newName);
    return undefined;
  }));

  // ==================== Favorite Handlers ====================

  ipcMain.handle('article:getFavoritePosts', wrapHandler(async () => {
    const result = await articleService.getArticles({ favorite: true }, 0, MAX_ARTICLES_PER_PAGE);
    return result.articles;
  }));

  ipcMain.handle('article:addFavoritePost', wrapHandler(async (post: unknown) => {
    if (!post || typeof post !== 'object') throw new Error('INVALID_PARAM: expected PostIndexItem object');
    const p = post as Record<string, unknown>;
    const id = (p.guid ?? p.id) as unknown;
    validateId(id, 'guid');
    const desc = typeof p.desc === 'string' ? p.desc : '';
    const dateStr = p.updateTime ? String(p.updateTime) : '';
    const article: Article = {
      id: String(id),
      guid: String(id),
      title: typeof p.title === 'string' ? p.title : '',
      content: typeof p.content === 'string' ? clampSummary(p.content) : '',
      description: desc,
      summary: desc,
      link: typeof p.link === 'string' ? p.link : '',
      author: typeof p.author === 'string' ? p.author : '',
      pubDate: dateStr,
      publishDate: dateStr ? new Date(dateStr) : new Date(),
      updateTime: dateStr ? new Date(dateStr) : new Date(),
      read: Boolean(p.read),
      favorite: true,
      feedId: (p.rssId as string) || '',
      feedTitle: '',
      feedUrl: '',
      folderName: '',
    };
    return await articleService.toggleFavorite(article.id);
  }));

  ipcMain.handle('article:removeFavoritePost', wrapHandler(async (guid: unknown) => {
    validateId(guid, 'guid');
    return await articleService.toggleFavorite(guid);
  }));

  ipcMain.handle('article:isPostFavorite', wrapHandler(async (guid: unknown) => {
    validateId(guid, 'guid');
    const article = await articleService.getArticle(guid);
    return article?.favorite || false;
  }));

  // ==================== Sync Handlers ====================

  ipcMain.handle('sync:getConfig', wrapHandler(() => syncManager.getConfig()));

  ipcMain.handle('sync:updateConfig', wrapHandler(async (config: unknown) => {
    if (!config || typeof config !== 'object') throw new Error('INVALID_PARAM: config must be an object');
    syncManager.updateConfig(config);
    return { success: true };
  }));

  ipcMain.handle('sync:start', wrapHandler(async () => {
    const stats = await syncManager.syncAll();
    return { success: true, stats };
  }));

  ipcMain.handle('sync:getStatus', wrapHandler(() => syncManager.getStatus()));

  ipcMain.handle('sync:startAuto', wrapHandler(async () => {
    syncManager.startAutoSync();
    return { success: true };
  }));

  ipcMain.handle('sync:stopAuto', wrapHandler(async () => {
    syncManager.stopAutoSync();
    return { success: true };
  }));

  // ==================== Search Handlers ====================

  ipcMain.handle('search:searchPosts', wrapHandler(async (query: unknown, options: unknown) => {
    validateString(query, 'query', MAX_QUERY_LENGTH);
    const opts = options && typeof options === 'object' ? (options as Record<string, unknown>) : {};
    if (opts.folderId !== undefined && opts.folderId !== null) validateId(opts.folderId, 'folderId');
    const limit = typeof opts.limit === 'number' ? Math.min(opts.limit, MAX_SEARCH_RESULTS) : MAX_SEARCH_RESULTS;

    const searchResult = await articleService.getArticles({ keyword: query as string }, 0, limit);
    const posts: PostIndexItem[] = searchResult.articles.map(article => ({
      title: article.title,
      guid: article.id,
      link: article.link,
      author: article.author || '',
      updateTime: article.updateTime instanceof Date ? article.updateTime.toISOString() : String(article.updateTime || ''),
      read: article.read,
      desc: article.description || article.content || '',
      rssId: article.feedId,
    }));
    return createSuccessResponse(posts);
  }));
}
