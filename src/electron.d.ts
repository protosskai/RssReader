import {RssFolderItem, RssInfoItem, RssInfoNew} from "src/common/RssInfoItem";
import {PostInfoItem} from "src/common/PostInfoItem";
import {ContentInfo} from "src/common/ContentInfo";
import {addRssSubscription} from "app/src-electron/rss/api";
import {ErrorMsg} from "src/common/ErrorMsg";

export interface electronAPI {
  getRssInfoList: () => Promise<RssInfoItem[]>,
  getRssFolderList: () => Promise<RssFolderItem[]>,
  getRssContent: (rssItemId: number) => Promise<string>,
  testRssPostList: () => void,
  getPostListInfo: (rssItemId: number) => Promise<PostInfoItem[]>,
  getPostContent: (rssItemId: number, postId: number) => Promise<ContentInfo>,
  addRssSubscription: (obj: RssInfoNew) => Promise<void>,
  removeRssSubscription: (folderName: string, rssUrl: string) => Promise<ErrorMsg>
  openLink: (url: string) => Promise<void>,
  close: () => void,
  minimize: () => void,
  addFolder: (folderName: string) => Promise<ErrorMsg>,
  removeFolder: (folderName: string) => Promise<ErrorMsg>
}

declare  global {
  interface Window {
    electronAPI: electronAPI
  }
}
