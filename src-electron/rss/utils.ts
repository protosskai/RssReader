import {RssInfoItem} from "src/common/RssInfoItem";
import {getUrl} from "app/src-electron/net/NetUtil";
import {FeedParser} from "./parser/FeedParser";
// @ts-ignore
import {v4 as uuidv4} from 'uuid';

export const getRssId = () => {
  const rssId = uuidv4()
  return String(rssId)
}

interface CheckResult {
  success: boolean,
  errorMsg: string
}

const checkFieldExist = (obj: any, field: string): CheckResult => {
  if (!obj.hasOwnProperty(field)) {
    const errorMsg = `invalid rss format file, [${field}] valid!`
    return {
      success: false,
      errorMsg: errorMsg
    }
  }
  return {
    success: true,
    errorMsg: ''
  }
}

export const buildAvatarUrl = (htmlUrl: string): string => {
  const urlObj = new URL(htmlUrl)
  const avatarUrl = `${urlObj.protocol}//${urlObj.host}/favicon.ico`
  return avatarUrl
}

export const parseRssFromUrl = async (feedUrl: string): Promise<RssInfoItem> => {
  const content = await getUrl(feedUrl)
  if (!content) {
    throw new Error(`parse feedUrl [${feedUrl}] error!`)
  }
  
  try {
    const parsedFeed = await FeedParser.parse(content)
    
    const rssInfoItem: RssInfoItem = {
      id: getRssId(),
      title: parsedFeed.title,
      unread: 0,
      htmlUrl: parsedFeed.link,
      feedUrl,
      avatar: buildAvatarUrl(parsedFeed.link),
      lastUpdateTime: parsedFeed.lastBuildDate || new Date().toISOString()
    }
    return rssInfoItem
  } catch (error) {
    throw new Error(`Failed to parse feed from ${feedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
