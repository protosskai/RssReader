import {RssInfoItem} from "src/common/RssInfoItem";
import {PostInfoItem} from "src/common/PostInfoItem";

export interface electronAPI {
  getRssInfoList: () => Promise<RssInfoItem[]>,
  getRssContent: (rssItemId: number) => Promise<string>,
  testRssPostList: () => void,
  getPostListInfo: (rssItemId: number) => Promise<PostInfoItem[]>
}

declare  global {
  interface Window {
    electronAPI: electronAPI
  }
}
