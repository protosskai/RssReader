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
import {RssFolderItem, RssInfoItem, RssInfoNew} from "src/common/RssInfoItem";
import {PostInfoItem} from "src/common/PostInfoItem";
import {ContentInfo} from "src/common/ContentInfo";
import {addRssSubscription, dumpFolderToDb, getRssInfoListFromDb, loadFolderFromDb} from "app/src-electron/rss/api";
import {ErrorMsg} from "src/common/ErrorMsg";


contextBridge.exposeInMainWorld('electronAPI', {
  getRssContent: async (rssItemId: string): Promise<string> => {
    return await ipcRenderer.invoke('rss:rssContent', rssItemId)
  },
  getPostListInfo: async (rssItemId: string): Promise<PostInfoItem[]> => {
    return await ipcRenderer.invoke('rss:getPostList', rssItemId)
  },
  getPostContent: async (rssItemId: string, postId: number): Promise<ContentInfo> => {
    return await ipcRenderer.invoke('rss:getPostContent', rssItemId, postId)
  },
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
  removeFolder: async (folderName: string): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('removeFolder', folderName)
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
  getRssInfoListFromDb: async (): Promise<string> => {
    return await ipcRenderer.invoke('rss:getRssInfoListFromDb')
  },
  editFolder: async (oldFolderName: string, newFolderName: string): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('rss:editFolder', oldFolderName, newFolderName)
  }
})
