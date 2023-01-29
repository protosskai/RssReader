import {RssFolderItem, RssInfoNew} from "src/common/RssInfoItem";
import {DEFAULT_FOLDER, Folder, Source, SourceManage} from "src-electron/rss/sourceManage";
import {getUrl} from "src-electron/net/NetUtil";
import {PostInfoObject} from "app/src-electron/rss/postListManeger";
import {PostInfoItem} from "src/common/PostInfoItem";
import {PostManager} from "app/src-electron/rss/postListManeger";
import {ContentInfo} from "src/common/ContentInfo";
import {shell, dialog} from "electron";
import {getRssId, parseRssFromUrl} from "app/src-electron/rss/utils";
import {ErrorMsg} from "src/common/ErrorMsg";

export const rssItemMap: Record<string, Source> = {}
type RssPostListMap = Record<string, Record<number, PostInfoObject>>
const postItemMap: RssPostListMap = {}

export const getRssFolderList = async (): Promise<RssFolderItem[]> => {
  const result = []
  const sourceManager = SourceManage.getInstance()
  await sourceManager.loadDefaultConfigFile()
  for (const folderName in sourceManager.folderMap) {
    const folderItem: RssFolderItem = {
      folderName: folderName === DEFAULT_FOLDER ? '默认' : folderName,
      data: [],
      children: [] // 暂时不支持嵌套目录
    }
    const folder = sourceManager.folderMap[folderName]
    if (!folder) {
      continue
    }
    for (const source of folder.sourceArray) {
      const id = String(getRssId())
      const rssMapItem = {
        id,
        title: source.name,
        unread: 0,
        avatar: source.avatar,
        htmlUrl: source.htmlUrl,
        feedUrl: source.url
      }
      folderItem.data.push(rssMapItem)
      rssItemMap[id] = source
    }
    result.push(folderItem)
  }
  return result
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
  await sourceManager.dumpToDefaultConfigFile()
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
  await sourceManager.dumpToDefaultConfigFile()
  return {
    success: true,
    msg: ''
  }
}

export const getRssContent = async (rssItemId: string): Promise<string> => {
  const rssItem = rssItemMap[rssItemId]
  const url = rssItem.url
  const content = await getUrl(url)
  if (!content) {
    throw new Error("get content null!")
  }
  return content
}


export const getPostListInfo = async (rssItemId: string): Promise<PostInfoItem[]> => {
  const rssItem = rssItemMap[rssItemId]
  const url = rssItem.url
  const postManager = new PostManager()
  const postList: PostInfoItem[] = await postManager.getPostList(url)
  const _postItemMap = postManager.getPostItmMap()
  for (const postId in _postItemMap) {
    if (!postItemMap[rssItemId]) {
      postItemMap[rssItemId] = {}
    }
    postItemMap[rssItemId][postId] = _postItemMap[postId]
  }
  return postList
}

export const getPostContent = (rssItemId: string, postId: number): ContentInfo => {
  const postObj = postItemMap[rssItemId][postId]
  const source = rssItemMap[rssItemId]
  const contentInfo: ContentInfo = {
    title: postObj.title,
    content: postObj.contentEncoded && postObj.contentEncoded.trim() !== '' ? postObj.contentEncoded : postObj.description,
    author: postObj.author,
    updateTime: postObj.pubDate,
    rssSource: source,
    link: postObj.link
  }
  return contentInfo
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
  await sourceManager.dumpToDefaultConfigFile()
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
  await sourceManager.dumpToDefaultConfigFile()
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
        await sourceManager.dumpToDefaultConfigFile()
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
