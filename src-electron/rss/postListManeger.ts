import {PostInfoItem} from "src/common/PostInfoItem";
import {getUrl} from "app/src-electron/net/NetUtil";
import xml2js from "xml2js";


export interface PostInfoObject {
  title: string,
  description: string,
  pubDate: string,
  author: string,
  guid?: string,
  link?: string
}

export const parsePostList = (data: string): PostInfoObject[] => {
  const res: PostInfoObject[] = []
  xml2js.parseString(data, (err, result) => {
    if (err) {
      throw err
    }
    const items = result["rss"]["channel"][0]["item"]
    for (const item of items) {
      const obj: PostInfoObject = {
        title: item["title"],
        description: item["description"],
        author: item["author"],
        pubDate: item["pubDate"],
        guid: item["guid"],
        link: item["link"]
      }
      res.push(obj)
    }
  })
  return res
}
export const testPostList = () => {
  getUrl("http://43.128.7.84:1200/juejin/category/frontend").then((data) => {
    if (!data) {
      return
    }
    console.log(parsePostList(data))
  })
}

export class PostManager {
  constructor() {
  }

  async getPostList(url: string): Promise<PostInfoItem[]> {
    const result: PostInfoItem[] = []
    let postId = 0
    const content = await getUrl(url)
    if (!content) {
      throw new Error("get content null!")
    }
    const postListInfo: PostInfoObject[] = parsePostList(content)
    postListInfo.forEach((postObject) => {
      const postInfoItem: PostInfoItem = {
        postId,
        title: postObject.title,
        desc: postObject.description,
        read: false,
        author: postObject.author,
        updateTime: postObject.pubDate
      }
      postId++
      result.push(postInfoItem)
    })
    return result;
  }
}
