import {RssFolderItem, RssInfoItem, RssInfoNew} from "src/common/RssInfoItem";
import {PostInfoItem} from "src/common/PostInfoItem";
import {ContentInfo} from "src/common/ContentInfo";
import {addRssSubscription} from "app/src-electron/rss/api";
import {ErrorMsg} from "src/common/ErrorMsg";
import {PostIndexItem} from "app/src-electron/storage/common";

export interface electronAPI {
  addRssSubscription: (obj: RssInfoNew) => Promise<void>,
  removeRssSubscription: (folderName: string, rssUrl: string) => Promise<ErrorMsg>
  openLink: (url: string) => Promise<void>,
  close: () => void,
  minimize: () => void,
  addFolder: (folderName: string) => Promise<ErrorMsg>,
  removeFolder: (folderName: string) => Promise<ErrorMsg>
  importOpmlFile: () => Promise<ErrorMsg>,
  dumpFolderToDb: (folderInfoListJson: string) => Promise<ErrorMsg>,
  loadFolderFromDb: () => Promise<string>,
  getRssInfoListFromDb: () => Promise<RssFolderItem[]>,
  editFolder: (oldFolderName: string, newFolderName: string) => Promise<ErrorMsg>,
  queryPostIndexByRssId: (rssId: string) => Promise<PostIndexItem[]>,
  queryPostContentByGuid: (guid: string) => Promise<ContentInfo>,
  fetchRssIndexList: (rssId: string) => Promise<ErrorMsg>
}

declare  global {
  interface Window {
    electronAPI: electronAPI
  }
}
