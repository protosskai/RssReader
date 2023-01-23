import {RssInfoItem} from "src/common/RssInfoItem";
import {PostInfoItem} from "src/common/PostInfoItem";
import {ContentInfo} from "src/common/ContentInfo";

export interface electronAPI {
  getRssInfoList: () => Promise<RssInfoItem[]>,
  getRssContent: (rssItemId: number) => Promise<string>,
  testRssPostList: () => void,
  getPostListInfo: (rssItemId: number) => Promise<PostInfoItem[]>,
  getPostContent: (rssItemId: number, postId: number) => Promise<ContentInfo>,
  openLink: (url: string) => Promise<void>
}

declare  global {
  interface Window {
    electronAPI: electronAPI
  }
}
