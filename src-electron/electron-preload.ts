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
import {PostIndexItem} from "app/src-electron/storage/common";


contextBridge.exposeInMainWorld('electronAPI', {
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
  getRssInfoListFromDb: async (): Promise<string> => {
    return await ipcRenderer.invoke('rss:getRssInfoListFromDb')
  },
  queryPostIndexByRssId: async (rssId: string): Promise<PostIndexItem[]> => {
    return await ipcRenderer.invoke('rss:queryPostIndexByRssId', rssId)
  },
  queryPostContentByGuid: async (guid: string): Promise<ContentInfo> => {
    return await ipcRenderer.invoke('rss:queryPostContentByGuid', guid)
  },
  fetchRssIndexList: async (rssId: string): Promise<ErrorMsg> => {
    return await ipcRenderer.invoke('rss:fetchRssIndexList', rssId)
  }
})
