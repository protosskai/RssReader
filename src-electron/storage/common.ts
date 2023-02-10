import {RssFolderItem} from "src/common/RssInfoItem";
import {ErrorData, ErrorMsg} from "src/common/ErrorMsg";
import {PostInfoItem} from "src/common/PostInfoItem";

export interface StorageUtil {
  dumpFolderItemList: (folderInfoList: RssFolderItem[]) => Promise<ErrorMsg>,
  loadFolderItemList: () => Promise<ErrorData<RssFolderItem[]>>,
  init: () => void,
  syncRssPostList: (rssId: string, postInfoItemList: PostInfoItem[]) => Promise<ErrorMsg>,
  queryPostContentByGuid: (guid: string) => Promise<ErrorData<string>>
}

export interface PostIndexItem {
  title: string,
  guid: string,
  author: string,
  updateTime: string,
  read: boolean
}
