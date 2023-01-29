import {PostInfoItem} from "src/common/PostInfoItem";
import {getUrl} from "app/src-electron/net/NetUtil";
import xml2js from "xml2js";


export interface PostInfoObject {
  title: string,
  description: string,
  link: string,
  pubDate: string,
  author: string,
  guid?: string,
  contentEncoded?: string
}

export const convertPostObjToItem = (postInfoObj: any): any => {
  const result: any = {}
  const description: any = postInfoObj["description"]
  const author: any = postInfoObj["author"]
  const pubDate: any = postInfoObj["pubDate"]
  const guid: any = postInfoObj["guid"]
  const link: any = postInfoObj["link"]
  const title: any = postInfoObj["title"]
  const contentEncoded: any = postInfoObj["content:encoded"]
  if (title instanceof Array) {
    result["title"] = title[0]
  } else {
    result["title"] = title
  }
  if (description instanceof Array) {
    result["description"] = description[0]
  } else {
    result["description"] = description
  }
  if (author instanceof Array) {
    result["author"] = author[0]
  } else {
    result["author"] = author
  }
  if (pubDate instanceof Array) {
    result["pubDate"] = pubDate[0]
  } else {
    result["pubDate"] = pubDate
  }
  if (guid instanceof Array) {
    result["guid"] = guid[0]
  } else {
    result["guid"] = guid
  }
  if (link instanceof Array) {
    result["link"] = link[0]
  } else {
    result["link"] = link
  }
  if (contentEncoded) {
    if (contentEncoded instanceof Array) {
      result["contentEncoded"] = contentEncoded[0]
    } else {
      result["contentEncoded"] = contentEncoded
    }
  }
  return result
}


export const parsePostList = (data: string): PostInfoObject[] => {
  const res: PostInfoObject[] = []
  xml2js.parseString(data, (err, result) => {
    if (err) {
      throw err
    }
    const items = result["rss"]["channel"][0]["item"]
    for (const item of items) {
      const tmpObj = convertPostObjToItem(item)
      const obj: PostInfoObject = {
        title: tmpObj["title"],
        description: tmpObj["description"],
        author: tmpObj["author"],
        pubDate: tmpObj["pubDate"],
        guid: tmpObj["guid"],
        link: tmpObj["link"]
      }
      if (tmpObj.contentEncoded) {
        obj.contentEncoded = tmpObj["contentEncoded"]
      }
      res.push(obj)
    }
  })
  return res
}

export class PostManager {
  private readonly postItemMap: Record<number, PostInfoObject>;

  constructor() {
    this.postItemMap = {}
  }

  async getPostList(url: string): Promise<PostInfoItem[]> {
    const result: PostInfoItem[] = []
    let postId = 0
    const content = await getUrl(url)
    if (!content) {
      throw new Error("get content null!")
    }
    let postListInfo: PostInfoObject[] = []
    try {
      postListInfo = parsePostList(content)
    } catch (e) {
      return []
    }
    postListInfo.forEach((postObject) => {
      const postInfoItem: PostInfoItem = {
        postId,
        title: postObject.title,
        desc: postObject.contentEncoded && postObject.contentEncoded.trim() !== '' ? postObject.contentEncoded : postObject.description,
        read: false,
        author: postObject.author,
        updateTime: postObject.pubDate,
      }
      result.push(postInfoItem)
      this.postItemMap[postId] = postObject
      postId++
    })
    return result;
  }

  getPostItmMap(): Record<number, PostInfoObject> {
    return this.postItemMap
  }
}
