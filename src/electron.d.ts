import {RssFolderItem, RssInfoItem, RssInfoNew} from "src/common/RssInfoItem";
import {PostInfoItem} from "src/common/PostInfoItem";
import {ContentInfo} from "src/common/ContentInfo";
import {addRssSubscription} from "app/src-electron/rss/api";
import {ErrorMsg} from "src/common/ErrorMsg";

export interface electronAPI {
  getRssFolderList: () => Promise<RssFolderItem[]>,
  getRssContent: (rssItemId: string) => Promise<string>,
  testRssPostList: () => void,
  getPostListInfo: (rssItemId: string) => Promise<PostInfoItem[]>,
  getPostContent: (rssItemId: string, postId: number) => Promise<ContentInfo>,
  addRssSubscription: (obj: RssInfoNew) => Promise<void>,
  removeRssSubscription: (folderName: string, rssUrl: string) => Promise<ErrorMsg>
  openLink: (url: string) => Promise<void>,
  close: () => void,
  minimize: () => void,
  addFolder: (folderName: string) => Promise<ErrorMsg>,
  removeFolder: (folderName: string) => Promise<ErrorMsg>
  importOpmlFile: () => Promise<ErrorMsg>,
  dumpFolderToDb: (folderInfoList: RssFolderItem[]) => Promise<ErrorMsg>
}

declare  global {
  interface Window {
    electronAPI: electronAPI
  }
}
