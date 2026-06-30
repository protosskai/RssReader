import { contextBridge, ipcRenderer } from 'electron';
import { ContentInfo, RssFolderItem } from 'src/common/models';
import type { PostIndexItem } from 'src/common/models';
import type { ElectronContract } from 'src/common/electronContract';
import type { ApiResponse } from 'src/common/ErrorMsg';

// ============================================================
// IPC Channel Whitelist — only these channels may be invoked
// from the renderer process. Any other channel is blocked.
// ============================================================

const ALLOWED_CHANNELS = new Set<string>([
  // Legacy RSS
  'rss:addRssSubscription',
  'rss:removeRssSubscription',
  'rss:queryPostContentByGuid',
  'rss:importOpmlFile',
  'rss:fetchRssIndexList',
  'rss:queryPostIndexByRssId',
  'rss:getRssInfoListFromDb',
  'rss:dumpFolderToDb',
  'rss:loadFolderFromDb',
  // Window & system
  'openLink',
  'close',
  'minimize',
  // Legacy folders
  'addFolder',
  'editFolder',
  'removeFolder',
  // Article operations
  'article:getArticles',
  'article:getArticle',
  'article:toggleReadStatus',
  'article:toggleFavorite',
  'article:markAllAsRead',
  'article:clearAllFavorites',
  'article:getStats',
  'article:getFavoritePosts',
  'article:addFavoritePost',
  'article:removeFavoritePost',
  'article:isPostFavorite',
  // Feed operations
  'feed:getFeeds',
  'feed:getFeed',
  'feed:addFeed',
  'feed:removeFeed',
  'feed:syncFeed',
  // Folder operations (v2)
  'folder:getFolders',
  'folder:getFolder',
  'folder:addFolder',
  'folder:removeFolder',
  'folder:renameFolder',
  // Sync
  'sync:getConfig',
  'sync:updateConfig',
  'sync:start',
  'sync:getStatus',
  'sync:startAuto',
  'sync:stopAuto',
  // Search
  'search:searchPosts',
]);

type IpcEnvelope<T = unknown> = { error?: string; data?: T };

/**
 * Securely invoke an IPC channel.
 * - Blocks unlisted channels (whitelist enforcement)
 * - Unwraps structured { error?, data? } responses from main process
 * - Throws the error message if `error` is present
 */
async function secureInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`IPC channel "${channel}" is not in the allowed whitelist`);
  }

  const raw = (await ipcRenderer.invoke(channel, ...args)) as IpcEnvelope<T> | null | undefined;

  // Handle the structured { error?, data? } envelope from main process
  if (raw && typeof raw === 'object' && 'error' in raw) {
    if (raw.error) {
      // Forward the sanitized error (stack traces already stripped on the main side)
      throw new Error(raw.error);
    }
    return raw.data as T;
  }

  // Fallback: handlers that predate the envelope (e.g. close/minimize return void)
  return raw as T;
}

// ============================================================
// Exposed API — mirrors ElectronContract exactly
// ============================================================

const electronAPI: ElectronContract = {
  // ---- Legacy RSS (wrapped in ApiResponse by api.ts) ----
  addRssSubscription: (obj) =>
    secureInvoke<ApiResponse<void>>('rss:addRssSubscription', obj),
  removeRssSubscription: (folderName, rssUrl) =>
    secureInvoke<ApiResponse<void>>('rss:removeRssSubscription', folderName, rssUrl),
  queryPostContentByGuid: (guid) =>
    secureInvoke<ApiResponse<ContentInfo>>('rss:queryPostContentByGuid', guid),
  importOpmlFile: () =>
    secureInvoke<ApiResponse<void>>('rss:importOpmlFile'),
  fetchRssIndexList: (rssId) =>
    secureInvoke<ApiResponse<void>>('rss:fetchRssIndexList', rssId),
  queryPostIndexByRssId: (rssId) =>
    secureInvoke<ApiResponse<PostIndexItem[]>>('rss:queryPostIndexByRssId', rssId),
  getRssInfoListFromDb: () =>
    secureInvoke<ApiResponse<RssFolderItem[]>>('rss:getRssInfoListFromDb'),
  dumpFolderToDb: (json) => secureInvoke('rss:dumpFolderToDb', json),
  loadFolderFromDb: () =>
    secureInvoke<ApiResponse<string>>('rss:loadFolderFromDb'),

  // ---- Window & system ----
  openLink: (url) => secureInvoke<void>('openLink', url),
  close: () => {
    // Fire-and-forget for window controls (no return value needed)
    void secureInvoke('close');
  },
  minimize: () => {
    void secureInvoke('minimize');
  },

  // ---- Legacy folders (wrapped in ApiResponse by api.ts) ----
  addFolder: (folderName) =>
    secureInvoke<ApiResponse<void>>('addFolder', folderName),
  editFolder: (oldName, newName) =>
    secureInvoke<ApiResponse<void>>('editFolder', oldName, newName),
  removeFolder: (folderName) =>
    secureInvoke<ApiResponse<void>>('removeFolder', folderName),

  // ---- Article operations ----
  getArticles: (params) => secureInvoke('article:getArticles', params),
  getArticle: (id) => secureInvoke('article:getArticle', id),
  toggleReadStatus: (id) => secureInvoke<void>('article:toggleReadStatus', id),
  toggleFavorite: (id) => secureInvoke<boolean>('article:toggleFavorite', id),
  markAllAsRead: (params) => secureInvoke<void>('article:markAllAsRead', params),
  clearAllFavorites: () => secureInvoke<void>('article:clearAllFavorites'),
  getArticleStats: () => secureInvoke('article:getStats'),

  // ---- Feed operations ----
  getFeeds: (folderName) => secureInvoke('feed:getFeeds', folderName),
  getFeed: (id) => secureInvoke('feed:getFeed', id),
  addFeed: (feedUrl, title, folderName) =>
    secureInvoke<void>('feed:addFeed', { feedUrl, title, folderName }),
  removeFeed: (id) => secureInvoke<void>('feed:removeFeed', id),
  syncFeed: (id) => secureInvoke<void>('feed:syncFeed', id),

  // ---- Folder operations (v2) ----
  getFolders: () => secureInvoke('folder:getFolders'),
  getFolder: (name) => secureInvoke('folder:getFolder', name),
  addFolderV2: (name) => secureInvoke<void>('folder:addFolder', name),
  removeFolderV2: (name) => secureInvoke<void>('folder:removeFolder', name),
  renameFolder: (oldName, newName) =>
    secureInvoke<void>('folder:renameFolder', oldName, newName),

  // ---- Legacy favorites ----
  getFavoritePosts: () => secureInvoke('article:getFavoritePosts'),
  addFavoritePost: (post) => secureInvoke<void>('article:addFavoritePost', post),
  removeFavoritePost: (guid) =>
    secureInvoke<void>('article:removeFavoritePost', guid),
  isPostFavorite: (guid) =>
    secureInvoke<boolean>('article:isPostFavorite', guid),

  // ---- Sync ----
  syncGetConfig: () => secureInvoke('sync:getConfig'),
  syncUpdateConfig: (config) => secureInvoke('sync:updateConfig', config),
  syncStart: () => secureInvoke('sync:start'),
  syncGetStatus: () => secureInvoke('sync:getStatus'),
  syncStartAuto: () => secureInvoke('sync:startAuto'),
  syncStopAuto: () => secureInvoke('sync:stopAuto'),

  // ---- Search (wrapped in ApiResponse by api.ts) ----
  searchPosts: (query, options) =>
    secureInvoke<ApiResponse<PostIndexItem[]>>('search:searchPosts', query, options),
};

// ============================================================
// Expose to renderer via contextBridge
// ============================================================

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
