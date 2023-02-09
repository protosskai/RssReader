import {RssFolderItem} from "src/common/RssInfoItem";
import {ErrorData, ErrorMsg} from "src/common/ErrorMsg";

export interface StorageUtil {
  dumpFolderItemList: (folderInfoList: RssFolderItem[]) => Promise<ErrorMsg>,
  loadFolderItemList: () => Promise<ErrorData<RssFolderItem[]>>,
  init: () => void,
}
