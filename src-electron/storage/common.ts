import {RssFolderItem} from "src/common/RssInfoItem";
import {ErrorData, ErrorMsg} from "src/common/ErrorMsg";
import {PostInfoItem} from "src/common/PostInfoItem";
import {ContentInfo} from "src/common/ContentInfo";

export interface StorageUtil {
  dumpFolderItemList: (folderInfoList: RssFolderItem[]) => Promise<ErrorMsg>,
  loadFolderItemList: () => Promise<ErrorData<RssFolderItem[]>>,
  init: () => void,
  syncRssPostList: (rssId: string, postInfoItemList: PostInfoItem[]) => Promise<ErrorMsg>,
  queryPostContentByGuid: (guid: string) => Promise<ErrorData<ContentInfo>>,
  queryPostIndexByRssId: (rssId: string) => Promise<ErrorData<PostIndexItem[]>>,
  searchPosts: (query: string, options?: SearchOptions) => Promise<ErrorData<PostIndexItem[]>>
}

export interface SearchOptions {
  folderId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}

export interface PostIndexItem {
  title: string,
  guid: string,
  link: string,
  author: string,
  updateTime: string,
  read: boolean,
  desc: string,
  rssId?: string  // RSS源ID，搜索结果中需要
}
