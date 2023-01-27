import {RssFolderItem, RssInfoItem, RssInfoNew} from "src/common/RssInfoItem";
import {PostInfoItem} from "src/common/PostInfoItem";
import {ContentInfo} from "src/common/ContentInfo";
import {addRssSubscription} from "app/src-electron/rss/api";

export interface electronAPI {
  getRssInfoList: () => Promise<RssInfoItem[]>,
  getRssFolderList: () => Promise<RssFolderItem[]>,
  getRssContent: (rssItemId: number) => Promise<string>,
  testRssPostList: () => void,
  getPostListInfo: (rssItemId: number) => Promise<PostInfoItem[]>,
  getPostContent: (rssItemId: number, postId: number) => Promise<ContentInfo>,
  addRssSubscription: (obj: RssInfoNew) => Promise<void>,
  openLink: (url: string) => Promise<void>,
  close: () => void,
  minimize: () => void
}

declare  global {
  interface Window {
    electronAPI: electronAPI
  }
}
