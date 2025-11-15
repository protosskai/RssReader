/**
 * This file is used specifically for security reasons.
 * Here you can access Nodejs stuff and inject functionality into
 * the renderer thread (accessible there through the "window" object)
 *
 * WARNING!
 * If you import anything from node_modules, then make sure that the package is specified
 * in package.json > dependencies and NOT in devDependencies
 *
 * Example (injects window.myAPI.doAThing() into renderer thread):
 *
 *   import { contextBridge } from 'electron'
 *
 *   contextBridge.exposeInMainWorld('myAPI', {
 *     doAThing: () => {}
 *   })
 *
 * WARNING!
 * If accessing Node functionality (like importing @electron/remote) then in your
 * electron-main.ts you will need to set the following when you instantiate BrowserWindow:
 *
 * mainWindow = new BrowserWindow({
 *   // ...
 *   webPreferences: {
 *     // ...
 *     sandbox: false // <-- to be able to import @electron/remote in preload script
 *   }
 * }
 */
import {contextBridge, ipcRenderer} from 'electron'
import {RssInfoNew} from "src/common/RssInfoItem";
import {ContentInfo} from "src/common/ContentInfo";
import {ErrorMsg} from "src/common/ErrorMsg";
import {PostIndexItem} from "src-electron/storage/common";


contextBridge.exposeInMainWorld('electronAPI', {
  // Legacy API (for backward compatibility)
  addRssSubscription: async (obj: RssInfoNew): Promise<void> => {
    return await ipcRenderer.invoke('rss:addRssSubscription', obj)
  },
  removeRssSubscription: async (folderName: string, rssUrl: string): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('rss:removeRssSubscription', folderName, rssUrl)
  },
  openLink: async (url: string): Promise<void> => {
    return await ipcRenderer.invoke('openLink', url)
  },
  close() {
    return ipcRenderer.invoke('close')
  },
  minimize() {
    return ipcRenderer.invoke('minimize')
  },
  addFolder: async (folderName: string): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('addFolder', folderName)
  },
  editFolder: async (oldFolderName: string, newFolderName: string): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('editFolder', oldFolderName, newFolderName)
  },
  removeFolder: async (folderName: string): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('removeFolder', folderName);
  },
  importOpmlFile: async (): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('rss:importOpmlFile')
  },
  dumpFolderToDb: async (folderInfoListJson: string): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('rss:dumpFolderToDb', folderInfoListJson)
  },
  loadFolderFromDb: async (): Promise<string> => {
    return await ipcRenderer.invoke('rss:loadFolderFromDb')
  },
  getRssInfoListFromDb: async (): Promise<any[]> => {
    return await ipcRenderer.invoke('rss:getRssInfoListFromDb')
  },
  queryPostIndexByRssId: async (rssId: string): Promise<PostIndexItem[]> => {
    console.log('[electron-preload] queryPostIndexByRssId called with rssId:', rssId);
    try {
      const result = await ipcRenderer.invoke('rss:queryPostIndexByRssId', rssId);
      console.log('[electron-preload] queryPostIndexByRssId result received:', result);
      console.log('[electron-preload] Result length:', result.length);
      return result;
    } catch (error) {
      console.error('[electron-preload] queryPostIndexByRssId error:', error);
      throw error;
    }
  },
  queryPostContentByGuid: async (guid: string): Promise<ContentInfo> => {
    console.log('[electron-preload] queryPostContentByGuid called with guid:', guid);
    try {
      const result = await ipcRenderer.invoke('rss:queryPostContentByGuid', guid);
      console.log('[electron-preload] queryPostContentByGuid result received:', result);
      return result;
    } catch (error) {
      console.error('[electron-preload] queryPostContentByGuid error:', error);
      throw error;
    }
  },
  fetchRssIndexList: async (rssId: string): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('rss:fetchRssIndexList', rssId)
  },

  // New API (Article-centric architecture)
  // Article operations
  getArticles: async (params: { filter?: any, offset?: number, limit?: number }): Promise<{ articles: any[], total: number }> => {
    return await ipcRenderer.invoke('article:getArticles', params)
  },
  getArticle: async (id: string): Promise<any> => {
    return await ipcRenderer.invoke('article:getArticle', id)
  },
  toggleReadStatus: async (id: string): Promise<void> => {
    return await ipcRenderer.invoke('article:toggleReadStatus', id)
  },
  toggleFavorite: async (id: string): Promise<boolean> => {
    return await ipcRenderer.invoke('article:toggleFavorite', id)
  },
  markAllAsRead: async (params?: { feedId?: string, folderName?: string }): Promise<void> => {
    return await ipcRenderer.invoke('article:markAllAsRead', params)
  },
  clearAllFavorites: async (): Promise<void> => {
    return await ipcRenderer.invoke('article:clearAllFavorites')
  },
  getArticleStats: async (): Promise<any> => {
    return await ipcRenderer.invoke('article:getStats')
  },

  // Feed operations
  getFeeds: async (folderName?: string): Promise<any[]> => {
    return await ipcRenderer.invoke('feed:getFeeds', folderName)
  },
  getFeed: async (id: string): Promise<any> => {
    return await ipcRenderer.invoke('feed:getFeed', id)
  },
  addFeed: async (feedUrl: string, title?: string, folderName?: string): Promise<void> => {
    return await ipcRenderer.invoke('feed:addFeed', { feedUrl, title, folderName })
  },
  removeFeed: async (id: string): Promise<void> => {
    return await ipcRenderer.invoke('feed:removeFeed', id)
  },
  syncFeed: async (id: string): Promise<void> => {
    return await ipcRenderer.invoke('feed:syncFeed', id)
  },

  // Folder operations (new API v2)
  getFolders: async (): Promise<any[]> => {
    return await ipcRenderer.invoke('folder:getFolders')
  },
  getFolder: async (name: string): Promise<any> => {
    return await ipcRenderer.invoke('folder:getFolder', name)
  },
  addFolderV2: async (name: string): Promise<void> => {
    return await ipcRenderer.invoke('folder:addFolder', name)
  },
  removeFolderV2: async (name: string): Promise<void> => {
    return await ipcRenderer.invoke('folder:removeFolder', name)
  },
  renameFolder: async (oldName: string, newName: string): Promise<void> => {
    return await ipcRenderer.invoke('folder:renameFolder', oldName, newName)
  },

  // Favorite operations (legacy support)
  getFavoritePosts: async (): Promise<PostIndexItem[]> => {
    return await ipcRenderer.invoke('article:getFavoritePosts')
  },
  addFavoritePost: async (post: any): Promise<void> => {
    return await ipcRenderer.invoke('article:addFavoritePost', post)
  },
  removeFavoritePost: async (guid: string): Promise<void> => {
    return await ipcRenderer.invoke('article:removeFavoritePost', guid)
  },
  isPostFavorite: async (guid: string): Promise<boolean> => {
    return await ipcRenderer.invoke('article:isPostFavorite', guid)
  }
})
