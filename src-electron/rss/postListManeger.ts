import {PostInfoItem} from "src/common/PostInfoItem";
import {getUrl} from "app/src-electron/net/NetUtil";
import {FeedParser, ParsedPost} from "./parser/FeedParser";
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

/**
 * Convert ParsedPost to PostInfoObject with date formatting
 */
const convertParsedPostToObject = (post: ParsedPost): PostInfoObject => {
  const formattedDate = post.pubDate ? moment(post.pubDate).format('YYYY-MM-DD HH:mm:ss') : '';
  
  return {
    title: post.title || '',
    description: post.description || '',
    author: post.author || '',
    pubDate: formattedDate,
    guid: post.guid || '',
    link: post.link || '',
    contentEncoded: post.contentEncoded,
    dcCreator: post.dcCreator
  };
};

/**
 * Parse post list using the unified FeedParser
 */
export const parsePostList = async (data: string): Promise<PostInfoObject[]> => {
  try {
    const parsedPosts = await FeedParser.parsePosts(data);
    return parsedPosts.map(post => convertParsedPostToObject(post));
  } catch (error) {
    console.error('Error parsing post list:', error);
    return [];
  }
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
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [postListManeger.ts] getPostList called`);
    console.log(`[${timestamp}] [postListManeger.ts] URL:`, url);

    const result: PostInfoItem[] = [];
    let postId = 0;

    try {
      console.log(`[${timestamp}] [postListManeger.ts] Fetching URL content...`);
      console.log(`[${timestamp}] [postListManeger.ts] Timeout set to 30 seconds...`);
      const content = await getUrl(url);
      console.log(`[${timestamp}] [postListManeger.ts] Content received, length:`, content?.length);

      if (!content) {
        throw new Error("Failed to fetch content from URL");
      }

      console.log(`[${timestamp}] [postListManeger.ts] Parsing post list...`);
      const postListInfo = await parsePostList(content);
      console.log(`[${timestamp}] [postListManeger.ts] Parsed posts count:`, postListInfo.length);

      postListInfo.forEach((postObject) => {
        const postInfoItem: PostInfoItem = {
          postId,
          title: postObject.title,
          desc: postObject.contentEncoded && postObject.contentEncoded.trim() !== ''
                ? postObject.contentEncoded
                : postObject.description,
          read: false,
          author: postObject.dcCreator && postObject.dcCreator.trim() !== ''
                  ? postObject.dcCreator
                  : postObject.author,
          updateTime: postObject.pubDate,
          guid: postObject.guid,
          link: postObject.link
        };

        result.push(postInfoItem);
        this.postItemMap[postId] = postObject;
        postId++;
      });
      
      return result;
    } catch (error) {
      console.error('Error fetching post list:', error);
      return [];
    }
  }

  getPostItmMap(): Record<number, PostInfoObject> {
    return this.postItemMap
  }
}

// 导出单例实例
export const postManager = PostManager.getInstance()
