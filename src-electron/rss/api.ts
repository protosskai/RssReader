import {RssFolderItem, RssInfoItem, RssInfoNew} from "src/common/RssInfoItem";
import {DEFAULT_FOLDER, Folder, Source, SourceManage} from "src-electron/rss/sourceManage";
import {getUrl} from "src-electron/net/NetUtil";
import {PostInfoObject} from "app/src-electron/rss/postListManeger";
import {PostInfoItem} from "src/common/PostInfoItem";
import {PostManager} from "app/src-electron/rss/postListManeger";
import {ContentInfo} from "src/common/ContentInfo";
import {shell} from "electron";
import {getRssId, parseRssFromUrl} from "app/src-electron/rss/utils";
import {ErrorMsg} from "src/common/ErrorMsg";

export const rssItemMap: Record<number, Source> = {}
type RssPostListMap = Record<number, Record<number, PostInfoObject>>
const postItemMap: RssPostListMap = {}
export const getRssInfoList = async (): Promise<RssInfoItem[]> => {
  const result: RssInfoItem[] = []
  let id = 0;
  const sourceManager = SourceManage.getInstance()
  // await sourceManager.loadFromFile('a.opml')
  await sourceManager.loadDefaultConfigFile()
  const folder: Folder | null = sourceManager.folderMap["编程"];
  if (!folder) {
    return [];
  }
  for (const source of folder.sourceArray) {
    const rssMapItem = {
      id,
      title: source.name,
      unread: 0,
      avatar: source.avatar,
      htmlUrl: source.htmlUrl,
      feedUrl: source.url
    }
    result.push(rssMapItem)
    rssItemMap[id] = source
    id++
  }
  return result
}

export const getRssFolderList = async (): Promise<RssFolderItem[]> => {
  const result = []
  const id = getRssId() // 给每个订阅源分配一个id
  const sourceManager = SourceManage.getInstance()
  await sourceManager.loadDefaultConfigFile()
  // await sourceManager.loadFromFile('a.opml')
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
    folder = sourceManager.folderMap[obj.folderName]
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

export const getRssContent = async (rssItemId: number): Promise<string> => {
  const rssItem = rssItemMap[rssItemId]
  const url = rssItem.url
  const content = await getUrl(url)
  if (!content) {
    throw new Error("get content null!")
  }
  return content
}


export const getPostListInfo = async (rssItemId: number): Promise<PostInfoItem[]> => {
  const rssItem = rssItemMap[rssItemId]
  const url = rssItem.url
  const postManager = new PostManager()
  const postList: PostInfoItem[] = await postManager.getPostList(url)
  const _postItemMap = postManager.getPostItmMap()
  for (const key in _postItemMap) {
    if (!postItemMap[rssItemId]) {
      postItemMap[rssItemId] = {}
    }
    postItemMap[rssItemId][key] = _postItemMap[key]
  }
  return postList
}

export const getPostContent = (rssItemId: number, postId: number): ContentInfo => {
  const postObj = postItemMap[rssItemId][postId]
  const source = rssItemMap[rssItemId]
  const contentInfo: ContentInfo = {
    title: postObj.title,
    content: postObj.description,
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
    console.log(sourceManager.getFolder(folderName))
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
