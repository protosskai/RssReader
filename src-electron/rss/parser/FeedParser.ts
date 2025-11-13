/**
 * 统一的Feed解析器
 * 支持RSS 2.0, Atom, RSS 1.0等多种格式
 */
import xml2js from 'xml2js';
import moment from 'moment';

export enum FeedType {
  RSS_2_0 = 'RSS_2_0',
  ATOM = 'ATOM',
  RSS_1_0 = 'RSS_1_0',
  UNKNOWN = 'UNKNOWN'
}

export interface ParsedFeed {
  type: FeedType;
  title: string;
  description?: string;
  link: string;
  lastBuildDate?: string;
  items: ParsedFeedItem[];
}

export interface ParsedFeedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  author?: string;
  guid: string;
  content?: string;
}

export interface ParsedPost {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  author: string;
  guid: string;
  contentEncoded?: string;
  dcCreator?: string;
}

export class FeedParser {
  /**
   * 检测Feed类型
   */
  static detectFeedType(xmlData: string): FeedType {
    if (xmlData.includes('<rss') && xmlData.includes('version="2.0"')) {
      return FeedType.RSS_2_0;
    }
    if (xmlData.includes('<feed') && xmlData.includes('xmlns="http://www.w3.org/2005/Atom"')) {
      return FeedType.ATOM;
    }
    if (xmlData.includes('<rdf:RDF') || xmlData.includes('xmlns:rss="http://purl.org/rss/1.0/"')) {
      return FeedType.RSS_1_0;
    }
    return FeedType.UNKNOWN;
  }

  /**
   * 统一解析入口
   */
  static async parse(xmlData: string): Promise<ParsedFeed> {
    if (!xmlData || typeof xmlData !== 'string' || xmlData.trim() === '') {
      throw new Error('Invalid feed data: empty or non-string input');
    }

    const feedType = this.detectFeedType(xmlData);

    try {
      const result = await xml2js.parseStringPromise(xmlData);

      switch (feedType) {
        case FeedType.RSS_2_0:
          return this.parseRSS2(result);
        case FeedType.ATOM:
          return this.parseAtom(result);
        case FeedType.RSS_1_0:
          return this.parseRSS1(result);
        default:
          throw new Error('Unsupported feed format');
      }
    } catch (error) {
      throw new Error(`Failed to parse feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse posts from feed content
   */
  static async parsePosts(content: string): Promise<ParsedPost[]> {
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return [];
    }

    const feedType = this.detectFeedType(content);
    
    try {
      const result = await xml2js.parseStringPromise(content);
      
      let posts: ParsedPost[];
      
      switch (feedType) {
        case FeedType.RSS_2_0:
          posts = this.parseRSS2Posts(result);
          break;
        case FeedType.ATOM:
          posts = this.parseAtomPosts(result);
          break;
        case FeedType.RSS_1_0:
          posts = this.parseRSS1Posts(result);
          break;
        default:
          posts = [];
      }
      
      return posts;
    } catch (error) {
      console.error('Error parsing posts:', error);
      return [];
    }
  }

  /**
   * 解析RSS 2.0格式
   */
  private static parseRSS2(data: any): ParsedFeed {
    const channel = data?.rss?.channel?.[0];
    if (!channel) {
      throw new Error('Invalid RSS 2.0 format: missing channel');
    }

    const items: ParsedFeedItem[] = [];
    const rawItems = channel.item || [];

    for (const item of rawItems) {
      try {
        const parsedItem = this.parseRSS2Item(item);
        if (parsedItem.title || parsedItem.link) {
          items.push(parsedItem);
        }
      } catch (error) {
        console.warn('Failed to parse RSS 2.0 item:', error);
      }
    }

    return {
      type: FeedType.RSS_2_0,
      title: this.extractValue(channel.title) || 'Untitled Feed',
      description: this.extractValue(channel.description),
      link: this.extractValue(channel.link) || '',
      lastBuildDate: this.extractValue(channel.lastBuildDate),
      items
    };
  }

  /**
   * 解析RSS 2.0条目
   */
  private static parseRSS2Item(item: any): ParsedFeedItem {
    const guid = this.extractGuid(item.guid);
    const link = this.extractValue(item.link);
    const pubDate = this.extractValue(item.pubDate);
    
    return {
      title: this.extractValue(item.title) || 'Untitled',
      description: this.extractValue(item.description) || '',
      link: link || guid || '',
      pubDate: this.normalizeDate(pubDate),
      author: this.extractValue(item['dc:creator']) || this.extractValue(item.author),
      guid: guid || link || this.generateGuid(),
      content: this.extractValue(item['content:encoded'])
    };
  }

  /**
   * 解析Atom格式
   */
  private static parseAtom(data: any): ParsedFeed {
    const feed = data?.feed;
    if (!feed) {
      throw new Error('Invalid Atom format: missing feed element');
    }

    const items: ParsedFeedItem[] = [];
    const rawItems = feed.entry || [];

    for (const entry of rawItems) {
      try {
        const parsedItem = this.parseAtomEntry(entry);
        if (parsedItem.title || parsedItem.link) {
          items.push(parsedItem);
        }
      } catch (error) {
        console.warn('Failed to parse Atom entry:', error);
      }
    }

    return {
      type: FeedType.ATOM,
      title: this.extractValue(feed.title) || 'Untitled Feed',
      description: this.extractValue(feed.subtitle),
      link: this.extractAtomLink(feed.link),
      lastBuildDate: this.extractValue(feed.updated),
      items
    };
  }

  /**
   * 解析Atom条目
   */
  private static parseAtomEntry(entry: any): ParsedFeedItem {
    const id = this.extractValue(entry.id);
    const link = this.extractAtomLink(entry.link);
    const content = this.extractValue(entry.content) || this.extractValue(entry.summary);
    
    return {
      title: this.extractValue(entry.title) || 'Untitled',
      description: this.extractValue(entry.summary) || '',
      link: link || id || '',
      pubDate: this.normalizeDate(this.extractValue(entry.updated) || this.extractValue(entry.published)),
      author: this.extractAtomAuthor(entry.author),
      guid: id || link || this.generateGuid(),
      content: content
    };
  }

  /**
   * 解析RSS 1.0格式
   */
  private static parseRSS1(data: any): ParsedFeed {
    const rdf = data['rdf:RDF'] || data.RDF;
    if (!rdf) {
      throw new Error('Invalid RSS 1.0 format: missing RDF element');
    }

    const channel = rdf.channel?.[0] || {};
    const items: ParsedFeedItem[] = [];
    const rawItems = rdf.item || [];

    for (const item of rawItems) {
      try {
        const parsedItem = this.parseRSS1Item(item);
        if (parsedItem.title || parsedItem.link) {
          items.push(parsedItem);
        }
      } catch (error) {
        console.warn('Failed to parse RSS 1.0 item:', error);
      }
    }

    return {
      type: FeedType.RSS_1_0,
      title: this.extractValue(channel.title) || 'Untitled Feed',
      description: this.extractValue(channel.description),
      link: this.extractValue(channel.link) || '',
      items
    };
  }

  /**
   * Parse RSS 2.0 posts
   */
  private static parseRSS2Posts(result: any): ParsedPost[] {
    const posts: ParsedPost[] = [];
    
    try {
      const channel = result?.rss?.channel?.[0];
      if (!channel?.item || !Array.isArray(channel.item)) {
        return posts;
      }

      for (const item of channel.item) {
        try {
          const post = this.convertToPost(item);
          if (post.title || post.link) {
            posts.push(post);
          }
        } catch (error) {
          console.error('Error parsing post item:', error);
        }
      }
    } catch (error) {
      console.error('Error parsing RSS 2.0 posts:', error);
    }

    return posts;
  }

  /**
   * Parse Atom posts
   */
  private static parseAtomPosts(result: any): ParsedPost[] {
    const posts: ParsedPost[] = [];
    
    try {
      const feed = result?.feed;
      if (!feed?.entry || !Array.isArray(feed.entry)) {
        return posts;
      }

      for (const entry of feed.entry) {
        try {
          const link = entry.link?.[0];
          const linkHref = typeof link === 'object' ? link.$?.href : link;
          
          const post: ParsedPost = {
            title: this.extractValue(entry.title),
            description: this.extractValue(entry.summary || entry.content),
            link: linkHref || '',
            pubDate: this.extractValue(entry.published || entry.updated),
            author: this.extractValue(entry.author?.[0]?.name),
            guid: this.extractValue(entry.id),
            contentEncoded: this.extractValue(entry.content)
          };
          
          if (post.title || post.link) {
            posts.push(post);
          }
        } catch (error) {
          console.error('Error parsing Atom entry:', error);
        }
      }
    } catch (error) {
      console.error('Error parsing Atom posts:', error);
    }

    return posts;
  }

  /**
   * Parse RSS 1.0 posts
   */
  private static parseRSS1Posts(result: any): ParsedPost[] {
    const posts: ParsedPost[] = [];
    
    try {
      const rdf = result['rdf:RDF'];
      if (!rdf?.item || !Array.isArray(rdf.item)) {
        return posts;
      }

      for (const item of rdf.item) {
        try {
          const post: ParsedPost = {
            title: this.extractValue(item.title),
            description: this.extractValue(item.description || item['content:encoded']),
            link: this.extractValue(item.link),
            pubDate: this.extractValue(item['dc:date']),
            author: this.extractValue(item['dc:creator']),
            guid: this.extractValue(item.link),
            contentEncoded: this.extractValue(item['content:encoded']),
            dcCreator: this.extractValue(item['dc:creator'])
          };
          
          if (post.title || post.link) {
            posts.push(post);
          }
        } catch (error) {
          console.error('Error parsing RSS 1.0 item:', error);
        }
      }
    } catch (error) {
      console.error('Error parsing RSS 1.0 posts:', error);
    }

    return posts;
  }

  /**
   * Convert RSS item to ParsedPost
   */
  private static convertToPost(item: any): ParsedPost {
    const guid = item.guid?.[0];
    const guidValue = typeof guid === 'object' ? guid._ || guid : guid;

    return {
      title: this.extractValue(item.title),
      description: this.extractValue(item.description),
      link: this.extractValue(item.link),
      pubDate: this.extractValue(item.pubDate),
      author: this.extractValue(item.author),
      guid: guidValue || '',
      contentEncoded: this.extractValue(item['content:encoded']),
      dcCreator: this.extractValue(item['dc:creator'])
    };
  }

  /**
   * 解析RSS 1.0条目
   */
  private static parseRSS1Item(item: any): ParsedFeedItem {
    const link = this.extractValue(item.link);
    const pubDate = this.extractValue(item['dc:date']) || this.extractValue(item.pubDate);
    
    return {
      title: this.extractValue(item.title) || 'Untitled',
      description: this.extractValue(item.description) || '',
      link: link || '',
      pubDate: this.normalizeDate(pubDate),
      author: this.extractValue(item['dc:creator']),
      guid: link || this.generateGuid(),
      content: this.extractValue(item['content:encoded'])
    };
  }

  /**
   * 提取值（处理数组和对象）
   */
  private static extractValue(field: any): string {
    if (!field) return '';
    if (typeof field === 'string') return field.trim();
    if (Array.isArray(field) && field.length > 0) {
      const first = field[0];
      if (typeof first === 'string') return first.trim();
      if (typeof first === 'object' && first._) return String(first._).trim();
      return String(first).trim();
    }
    if (typeof field === 'object' && field._) return String(field._).trim();
    return String(field).trim();
  }

  /**
   * 提取GUID（处理对象格式）
   */
  private static extractGuid(guid: any): string {
    if (!guid) return '';
    if (typeof guid === 'string') return guid.trim();
    if (Array.isArray(guid) && guid.length > 0) {
      const first = guid[0];
      if (typeof first === 'string') return first.trim();
      if (typeof first === 'object' && first._) return String(first._).trim();
    }
    if (typeof guid === 'object' && guid._) return String(guid._).trim();
    return '';
  }

  /**
   * 提取Atom链接
   */
  private static extractAtomLink(links: any): string {
    if (!links) return '';
    const linkArray = Array.isArray(links) ? links : [links];
    
    // 优先选择alternate类型的链接
    const alternateLink = linkArray.find(l => l.$?.rel === 'alternate' || !l.$?.rel);
    if (alternateLink?.$?.href) return alternateLink.$.href;
    
    // 否则返回第一个链接
    if (linkArray[0]?.$?.href) return linkArray[0].$.href;
    return '';
  }

  /**
   * 提取Atom作者
   */
  private static extractAtomAuthor(author: any): string {
    if (!author) return '';
    const authorArray = Array.isArray(author) ? author : [author];
    if (authorArray.length > 0) {
      const first = authorArray[0];
      return this.extractValue(first.name) || this.extractValue(first.email) || '';
    }
    return '';
  }

  /**
   * 标准化日期格式
   */
  private static normalizeDate(dateStr: string): string {
    if (!dateStr) return moment().format('YYYY-MM-DD HH:mm:ss');
    
    try {
      const date = moment(dateStr);
      return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : moment().format('YYYY-MM-DD HH:mm:ss');
    } catch (error) {
      return moment().format('YYYY-MM-DD HH:mm:ss');
    }
  }

  /**
   * 生成GUID
   */
  private static generateGuid(): string {
    return `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}