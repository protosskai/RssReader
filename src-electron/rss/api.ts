import {RssInfoItem} from "src/common/RssInfoItem";
import {Folder, Source, SourceManage} from "src-electron/rss/sourceManage";
import {getUrl} from "src-electron/net/NetUtil";
import {PostInfoObject} from "app/src-electron/rss/postListManeger";
import {PostInfoItem} from "src/common/PostInfoItem";
import {PostManager} from "app/src-electron/rss/postListManeger";
import {ContentInfo} from "src/common/ContentInfo";

export const rssItemMap: Record<number, Source> = {}
type RssPostListMap = Record<number, Record<number, PostInfoObject>>
const postItemMap: RssPostListMap = {}
export const getRssInfoList = async (): Promise<RssInfoItem[]> => {
  const result: RssInfoItem[] = []
  let id = 0;
  const sourceManager = new SourceManage()
  await sourceManager.loadFromFile('a.opml')
  const folder: Folder | null = sourceManager.folderMap["新闻"];
  if (!folder) {
    return [];
  }
  for (const source of folder.sourceArray) {
    const rssMapItem = {
      id,
      title: source.name,
      unread: 0
    }
    result.push(rssMapItem)
    rssItemMap[id] = source
    id++
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
  const contentInfo: ContentInfo = {
    title: postObj.title,
    content: postObj.description,
    author: postObj.author,
    updateTime: postObj.pubDate
  }
  return contentInfo
}
