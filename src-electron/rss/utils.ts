import {RssInfoItem} from "src/common/RssInfoItem";
import {getUrl} from "app/src-electron/net/NetUtil";
import xml2js from "xml2js";
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
  return new Promise<RssInfoItem>((resolve, reject) => {
    xml2js.parseString(content, (err, result) => {
      if (err) {
        reject(err)
      }
      let checkResult = checkFieldExist(result, 'rss')
      if (!checkResult.success) {
        throw new Error(checkResult.errorMsg)
      }
      const rss = result["rss"];
      checkResult = checkFieldExist(rss, 'channel')
      if (!checkResult.success) {
        throw new Error(checkResult.errorMsg)
      }
      const channel = rss["channel"][0]
      checkResult = checkFieldExist(channel, 'link')
      if (!checkResult.success) {
        throw new Error(checkResult.errorMsg)
      }
      checkResult = checkFieldExist(channel, 'title')
      if (!checkResult.success) {
        throw new Error(checkResult.errorMsg)
      }
      checkResult = checkFieldExist(channel, 'lastBuildDate')
      if (!checkResult.success) {
        throw new Error(checkResult.errorMsg)
      }
      const rssInfoItem: RssInfoItem = {
        id: getRssId(),
        title: channel["title"],
        unread: 0,
        htmlUrl: channel["link"],
        feedUrl,
        avatar: buildAvatarUrl(channel["link"]),
        lastUpdateTime: channel["lastBuildDate"]
      }
      resolve(rssInfoItem)
    })
  })
}
