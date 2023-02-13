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
  queryPostIndexByRssId: (rssId: string) => Promise<ErrorData<PostIndexItem[]>>
}

export interface PostIndexItem {
  title: string,
  guid: string,
  author: string,
  updateTime: string,
  read: boolean,
  desc: string
}
