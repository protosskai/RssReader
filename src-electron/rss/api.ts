import {RssFolderItem, RssInfoNew} from "src/common/RssInfoItem";
import {DEFAULT_FOLDER, Folder, Source, SourceManage} from "src-electron/rss/sourceManage";
import {getUrl} from "src-electron/net/NetUtil";
import {PostInfoObject} from "app/src-electron/rss/postListManeger";
import {PostInfoItem} from "src/common/PostInfoItem";
import {PostManager} from "app/src-electron/rss/postListManeger";
import {ContentInfo} from "src/common/ContentInfo";
import {shell, dialog} from "electron";
import {parseRssFromUrl} from "app/src-electron/rss/utils";
import {ErrorMsg} from "src/common/ErrorMsg";
import {SqliteUtil} from "app/src-electron/storage/sqlite";
import {PostIndexItem, StorageUtil} from "app/src-electron/storage/common";

type RssPostListMap = Record<string, Record<number, PostInfoObject>>
const postItemMap: RssPostListMap = {}

export const getRssInfoListFromDb = async (): Promise<RssFolderItem[]> => {
  const sourceManager = SourceManage.getInstance()
  await sourceManager.loadFromDb()
  return sourceManager.getFolderInfoList()
}

export const addRssSubscription = async (obj: RssInfoNew): Promise<void> => {
  const rssInfoItem = await parseRssFromUrl(obj.feedUrl)
  if (obj.title && obj.title.trim() !== '') {
    rssInfoItem.title = obj.title
  }
  const sourceManager = SourceManage.getInstance()
  let folder: Folder | null
  if (obj.folderName && obj.folderName !== '') {
    if (obj.folderName === '默认') {
      folder = sourceManager.folderMap[DEFAULT_FOLDER]
    } else {
      folder = sourceManager.folderMap[obj.folderName]
    }
  } else {
    folder = sourceManager.folderMap[DEFAULT_FOLDER]
  }
  if (!folder) {
    throw new Error(`folder [${obj.folderName}] not exist!`)
  }
  const source: Source = new Source(rssInfoItem.feedUrl, rssInfoItem.title, folder.name, rssInfoItem.avatar, rssInfoItem.htmlUrl)
  folder.addSource(source)
  await sourceManager.dumpToDb()
}
export const removeRssSubscription = async (folderName: string, rssUrl: string): Promise<ErrorMsg> => {
  const sourceManager = SourceManage.getInstance()
  let folder
  if (folderName === '默认') {
    folder = sourceManager.getFolder(DEFAULT_FOLDER)
  } else {
    folder = sourceManager.getFolder(folderName)
  }
  if (!folder) {
    return {
      success: false,
      msg: `文件夹[${folderName}]不存在!`
    }
  }
  const sourceIndex = folder.sourceArray.findIndex(item => item.url === rssUrl)
  if (sourceIndex === -1) {
    return {
      success: false,
      msg: `订阅不存在!`
    }
  }
  folder.sourceArray.splice(sourceIndex, 1)
  await sourceManager.dumpToDb()
  return {
    success: true,
    msg: ''
  }
}

export const getRssContent = async (rssItemId: string): Promise<string> => {
  const sourceManager = SourceManage.getInstance()
  const rssItem = sourceManager.getSourceByRssId(rssItemId)
  if (!rssItem) {
    throw new Error(`rssID: [${rssItemId}] not exist!`)
  }
  const url = rssItem.url
  const content = await getUrl(url)
  if (!content) {
    throw new Error("get content null!")
  }
  return content
}

/**
 * 通过rssId查询文章目录
 * @param rssId
 */
export const queryPostIndexByRssId = async (rssId: string): Promise<PostIndexItem[]> => {
  const storageUtil: StorageUtil = SqliteUtil.getInstance()
  const result = await storageUtil.queryPostIndexByRssId(rssId)
  if (!result.success) {
    throw new Error(result.msg)
  }
  return result.data
}
/**
 * 通过guid查询文章内容
 * @param guid
 */
export const queryPostContentByGuid = async (guid: string): Promise<ContentInfo> => {
  const sourceManager = SourceManage.getInstance()
  const storageUtil: StorageUtil = SqliteUtil.getInstance()
  const result = await storageUtil.queryPostContentByGuid(guid)
  if (!result.success) {
    throw new Error(result.msg)
  }
  const contentInfo: ContentInfo = result.data
  const {rssId} = contentInfo
  const source = sourceManager.getSourceByRssId(rssId)
  if (source) {
    contentInfo.rssSource = source
  }
  return contentInfo
}
/**
 * 同步指定rss订阅最新的文章列表
 * @param rssId
 */
export const fetchRssIndexList = async (rssId: string): Promise<ErrorMsg> => {
  const sourceManager = SourceManage.getInstance()
  const storageUtil: StorageUtil = SqliteUtil.getInstance()
  const rssItem = sourceManager.getSourceByRssId(rssId)
  if (!rssItem) {
    throw new Error(`rssID: [${rssId}] not exist!`)
  }
  const url = rssItem.url
  const postManager = new PostManager()
  const postList: PostInfoItem[] = await postManager.getPostList(url)
  const result = await storageUtil.syncRssPostList(rssId, postList)
  if (!result.success) {
    throw new Error(result.msg)
  }
  return {
    success: true,
    msg: ''
  }

}

export const openLink = async (url: string): Promise<void> => {
  return await shell.openExternal(url)
}

export const addFolder = async (folderName: string): Promise<ErrorMsg> => {
  const sourceManager = SourceManage.getInstance()
  if (sourceManager.getFolder(folderName)) {
    return {
      success: false,
      msg: `文件夹[${folderName}]已存在!`
    }
  }
  sourceManager.addFolder(new Folder(folderName))
  await sourceManager.dumpToDb()
  return {
    success: true,
    msg: ''
  }
}

export const editFolder = async (oldFolderName: string, newFolderName: string): Promise<ErrorMsg> => {
  const sourceManager = SourceManage.getInstance()
  if (!sourceManager.getFolder(oldFolderName)) {
    return {
      success: false,
      msg: `文件夹[${oldFolderName}]不存在!`
    }
  }
  if (sourceManager.getFolder(newFolderName)) {
    return {
      success: false,
      msg: `文件夹[${newFolderName}]已存在!`
    }
  }
  sourceManager.editFolder(oldFolderName, newFolderName)
  await sourceManager.dumpToDb()
  return {
    success: true,
    msg: ''
  }
}

export const removeFolder = async (folderName: string): Promise<ErrorMsg> => {
  const sourceManager = SourceManage.getInstance()
  if (!sourceManager.getFolder(folderName)) {
    return {
      success: false,
      msg: `文件夹[${folderName}]不存在!`
    }
  }
  sourceManager.deleteFolder(folderName)
  await sourceManager.dumpToDb()
  return {
    success: true,
    msg: ''
  }
}

export const importOpmlFile = async (): Promise<ErrorMsg> => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile']
    })
    if (!result.canceled) {
      if (result.filePaths.length > 0) {
        const sourceManager = SourceManage.getInstance()
        const path = result.filePaths[0]
        await sourceManager.loadFromFile(path)
        // await sourceManager.dumpToDefaultConfigFile()
        await sourceManager.dumpToDb()
      }
    }
    return {
      success: true,
      msg: ''
    }
  } catch (e: any) {
    return {
      success: false,
      msg: e
    }
  }
}

export const dumpFolderToDb = async (folderInfoListJson: string): Promise<ErrorMsg> => {
  const folderInfoList = JSON.parse(folderInfoListJson)
  const storageUtil: StorageUtil = SqliteUtil.getInstance()
  return await storageUtil.dumpFolderItemList(folderInfoList)
}
export const loadFolderFromDb = async (): Promise<string> => {
  const storageUtil: StorageUtil = SqliteUtil.getInstance()
  const folderInfoList = (await storageUtil.loadFolderItemList()).data
  return JSON.stringify(folderInfoList)
}

export const initDB = async (): Promise<void> => {
  const storageUtil: StorageUtil = SqliteUtil.getInstance()
  await storageUtil.init()
}
