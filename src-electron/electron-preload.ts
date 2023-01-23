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
import {RssInfoItem} from "src/common/RssInfoItem";
import {PostInfoItem} from "src/common/PostInfoItem";
import {ContentInfo} from "src/common/ContentInfo";

contextBridge.exposeInMainWorld('electronAPI', {
  getRssInfoList: async (): Promise<RssInfoItem[]> => {
    return await ipcRenderer.invoke('rss:infoList')
  },
  getRssContent: async (rssItemId: number): Promise<string> => {
    return await ipcRenderer.invoke('rss:rssContent', rssItemId)
  },
  getPostListInfo: async (rssItemId: number): Promise<PostInfoItem[]> => {
    return await ipcRenderer.invoke('rss:getPostList', rssItemId)
  },
  getPostContent: async (rssItemId: number, postId: number): Promise<ContentInfo> => {
    return await ipcRenderer.invoke('rss:getPostContent', rssItemId, postId)
  },
  openLink: async (url: string): Promise<void> => {
    return await ipcRenderer.invoke('openLink', url)
  }
})
