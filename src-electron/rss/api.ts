import {RssFolderItem, RssInfoItem} from "src/common/RssInfoItem";
import {Folder, Source, SourceManage} from "src-electron/rss/sourceManage";
import {getUrl} from "src-electron/net/NetUtil";
import {PostInfoObject} from "app/src-electron/rss/postListManeger";
import {PostInfoItem} from "src/common/PostInfoItem";
import {PostManager} from "app/src-electron/rss/postListManeger";
import {ContentInfo} from "src/common/ContentInfo";
import {shell} from "electron";

export const rssItemMap: Record<number, Source> = {}
type RssPostListMap = Record<number, Record<number, PostInfoObject>>
const postItemMap: RssPostListMap = {}
export const getRssInfoList = async (): Promise<RssInfoItem[]> => {
  const result: RssInfoItem[] = []
  let id = 0;
  const sourceManager = new SourceManage()
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
  let id = 0; // 给每个订阅源分配一个id
  const sourceManager = new SourceManage()
  await sourceManager.loadDefaultConfigFile()
  // await sourceManager.loadFromFile('a.opml')
  for (const folderName in sourceManager.folderMap) {
    const folderItem: RssFolderItem = {
      folderName,
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
      id++
    }
    result.push(folderItem)
  }
  return result
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
