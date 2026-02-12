import { contextBridge, ipcRenderer } from 'electron';
import { ContentInfo } from 'src/common/ContentInfo';
import type { ElectronContract } from 'src/common/electronContract';
import { ErrorMsg } from 'src/common/ErrorMsg';
import { RssInfoNew } from 'src/common/RssInfoItem';
import { PostIndexItem } from 'src-electron/storage/common';

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;

const electronAPI: ElectronContract = {
  addRssSubscription: (obj: RssInfoNew) => invoke<void>('rss:addRssSubscription', obj),
  removeRssSubscription: (folderName: string, rssUrl: string) =>
    invoke<ErrorMsg>('rss:removeRssSubscription', folderName, rssUrl),
  openLink: (url: string) => invoke<void>('openLink', url),
  close: () => {
    void invoke('close');
  },
  minimize: () => {
    void invoke('minimize');
  },
  addFolder: (folderName: string) => invoke<ErrorMsg>('addFolder', folderName),
  editFolder: (oldFolderName: string, newFolderName: string) =>
    invoke<ErrorMsg>('editFolder', oldFolderName, newFolderName),
  removeFolder: (folderName: string) => invoke<ErrorMsg>('removeFolder', folderName),
  importOpmlFile: () => invoke<ErrorMsg>('rss:importOpmlFile'),
  dumpFolderToDb: (folderInfoListJson: string) => invoke<ErrorMsg>('rss:dumpFolderToDb', folderInfoListJson),
  loadFolderFromDb: () => invoke<string>('rss:loadFolderFromDb'),
  getRssInfoListFromDb: () => invoke('rss:getRssInfoListFromDb'),
  queryPostIndexByRssId: (rssId: string) => invoke<PostIndexItem[]>('rss:queryPostIndexByRssId', rssId),
  queryPostContentByGuid: (guid: string) => invoke<ContentInfo>('rss:queryPostContentByGuid', guid),
  fetchRssIndexList: (rssId: string) => invoke<ErrorMsg>('rss:fetchRssIndexList', rssId),

  getArticles: (params) => invoke('article:getArticles', params),
  getArticle: (id: string) => invoke('article:getArticle', id),
  toggleReadStatus: (id: string) => invoke<void>('article:toggleReadStatus', id),
  toggleFavorite: (id: string) => invoke<boolean>('article:toggleFavorite', id),
  markAllAsRead: (params) => invoke<void>('article:markAllAsRead', params),
  clearAllFavorites: () => invoke<void>('article:clearAllFavorites'),
  getArticleStats: () => invoke('article:getStats'),

  getFeeds: (folderName?: string) => invoke('feed:getFeeds', folderName),
  getFeed: (id: string) => invoke('feed:getFeed', id),
  addFeed: (feedUrl: string, title?: string, folderName?: string) =>
    invoke<void>('feed:addFeed', { feedUrl, title, folderName }),
  removeFeed: (id: string) => invoke<void>('feed:removeFeed', id),
  syncFeed: (id: string) => invoke<void>('feed:syncFeed', id),

  getFolders: () => invoke('folder:getFolders'),
  getFolder: (name: string) => invoke('folder:getFolder', name),
  addFolderV2: (name: string) => invoke<void>('folder:addFolder', name),
  removeFolderV2: (name: string) => invoke<void>('folder:removeFolder', name),
  renameFolder: (oldName: string, newName: string) => invoke<void>('folder:renameFolder', oldName, newName),

  getFavoritePosts: () => invoke('article:getFavoritePosts'),
  addFavoritePost: (post: unknown) => invoke<void>('article:addFavoritePost', post),
  removeFavoritePost: (guid: string) => invoke<void>('article:removeFavoritePost', guid),
  isPostFavorite: (guid: string) => invoke<boolean>('article:isPostFavorite', guid),

  syncGetConfig: () => invoke('sync:getConfig'),
  syncUpdateConfig: (config: unknown) => invoke('sync:updateConfig', config),
  syncStart: () => invoke('sync:start'),
  syncGetStatus: () => invoke('sync:getStatus'),
  syncStartAuto: () => invoke('sync:startAuto'),
  syncStopAuto: () => invoke('sync:stopAuto'),

  searchPosts: (query: string, options) => invoke('search:searchPosts', query, options),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
