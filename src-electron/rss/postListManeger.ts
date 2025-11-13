import {PostInfoItem} from "src/common/PostInfoItem";
import {getUrl} from "app/src-electron/net/NetUtil";
import xml2js from "xml2js";
import moment from "moment";


export interface PostInfoObject {
  title: string,
  description: string,
  link: string,
  pubDate: string,
  author: string,
  guid: string,
  contentEncoded?: string
  dcCreator?: string
}

export const convertPostObjToItem = (postInfoObj: any): any => {
  const result: any = {}
  const description: any = postInfoObj["description"] ? postInfoObj["description"] : ""
  const author: any = postInfoObj["author"] ? postInfoObj["author"] : ""
  const pubDate: any = postInfoObj["pubDate"] ? postInfoObj["pubDate"] : ""
  const guid: any = postInfoObj["guid"] ? postInfoObj["guid"] : ""
  const link: any = postInfoObj["link"] ? postInfoObj["link"] : ""
  const title: any = postInfoObj["title"] ? postInfoObj["title"] : ""
  const contentEncoded: any = postInfoObj["content:encoded"] ? postInfoObj["content:encoded"] : ""
  const dcCreator: any = postInfoObj["dc:creator"] ? postInfoObj["dc:creator"] : ""
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
    const t = moment(pubDate[0])
    result["pubDate"] = t.format('YYYY-MM-DD HH:mm:ss')
  } else {
    const t = moment(pubDate)
    result["pubDate"] = t.format('YYYY-MM-DD HH:mm:ss')
  }
  // 处理guid字段，兼容不同格式
  if (guid instanceof Array) {
    if (guid[0] && typeof guid[0] === 'object' && guid[0]._) {
      result["guid"] = guid[0]._
    } else {
      result["guid"] = guid[0]
    }
  } else {
    if (guid && typeof guid === 'object' && guid._) {
      result["guid"] = guid._
    } else {
      result["guid"] = guid
    }
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
  if (dcCreator) {
    if (dcCreator instanceof Array) {
      result["dcCreator"] = dcCreator[0]
    } else {
      result["dcCreator"] = dcCreator
    }
  }
  return result
}


export const parsePostList = (data: string): PostInfoObject[] => {
  const res: PostInfoObject[] = []
  
  // Input validation
  if (!data || typeof data !== 'string' || data.trim() === '') {
    return res
  }
  
  try {
    xml2js.parseString(data, (err, result) => {
      if (err) {
        console.error('XML解析错误:', err)
        return
      }
      
      // 安全地获取RSS结构
      try {
        // 检查result是否包含预期的RSS结构
        if (!result || !result["rss"] || !result["rss"]["channel"] || 
            !Array.isArray(result["rss"]["channel"]) || result["rss"]["channel"].length === 0) {
          console.warn('无效的RSS结构: 缺少channel元素')
          return
        }
        
        const channel = result["rss"]["channel"][0]
        
        // 检查channel是否包含item数组
        if (!channel || !channel["item"] || !Array.isArray(channel["item"])) {
          console.warn('无效的RSS结构: 缺少item数组')
          return
        }
        
        const items = channel["item"]
        
        // 处理每个item
        for (const item of items) {
          try {
            const tmpObj = convertPostObjToItem(item)
            
            // 只添加有效的文章条目（至少需要标题或链接）
            if (tmpObj.title || tmpObj.link) {
              const obj: PostInfoObject = {
                title: tmpObj["title"],
                description: tmpObj["description"],
                author: tmpObj["author"],
                pubDate: tmpObj["pubDate"],
                guid: tmpObj["guid"],
                link: tmpObj["link"],
                dcCreator: tmpObj["dcCreator"]
              }
              
              if (tmpObj.contentEncoded) {
                obj.contentEncoded = tmpObj["contentEncoded"]
              }
              
              res.push(obj)
            }
          } catch (itemError) {
            console.error('处理文章条目时出错:', itemError)
            // 跳过错误的条目，继续处理其他条目
          }
        }
      } catch (structureError) {
        console.error('处理RSS结构时出错:', structureError)
      }
    })
  } catch (parseError) {
    console.error('XML解析过程中出错:', parseError)
  }
  
  return res
}

// 定义PostManager类（单例模式）
export class PostManager {
  private readonly postItemMap: Record<number, PostInfoObject>;
  
  // 私有静态实例
  private static instance: PostManager;
  
  // 私有构造函数，防止外部直接实例化
  private constructor() {
    this.postItemMap = {}
  }
  
  // 公共静态方法获取单例实例
  static getInstance(): PostManager {
    if (!PostManager.instance) {
      PostManager.instance = new PostManager()
    }
    return PostManager.instance
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
        author: postObject.dcCreator && postObject.dcCreator.trim() !== '' ? postObject.dcCreator : postObject.author,
        updateTime: postObject.pubDate,
        guid: postObject.guid,
        link: postObject.link
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

// 导出单例实例
export const postManager = PostManager.getInstance()
