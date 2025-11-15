/**
 * Article Domain Model
 * 以文章（Article）为核心的资源模型
 */

export interface Article {
  id: string;                    // 唯一标识（GUID）
  title: string;                 // 标题
  content: string;              // 内容（HTML）
  description: string;          // 描述
  link: string;                 // 原文链接
  author: string;               // 作者
  publishDate: Date;            // 发布时间
  updateTime: Date;             // 更新时间
  read: boolean;                // 是否已读
  favorite: boolean;            // 是否收藏
  feedId: string;               // 所属RSS源ID
  feedTitle: string;            // RSS源标题
  feedUrl: string;              // RSS源URL
  folderName: string;           // 文件夹名称
  avatar?: string;              // RSS源头像
}

export interface FeedSource {
  id: string;                   // RSS源ID
  title: string;                // RSS源标题
  url: string;                  // RSS源URL
  htmlUrl: string;              // 网站URL
  avatar: string;               // 头像
  folderName: string;           // 所属文件夹
  lastUpdateTime?: Date;        // 最后更新时间
  unreadCount: number;          // 未读数量
}

export interface Folder {
  id: string;                   // 文件夹ID
  name: string;                 // 文件夹名称
  parentId?: string;            // 父文件夹ID（支持嵌套）
  order: number;                // 排序
}

export interface ArticleFilter {
  folderName?: string;          // 文件夹过滤
  feedId?: string;              // RSS源过滤
  read?: boolean;               // 已读/未读过滤
  favorite?: boolean;           // 收藏过滤
  author?: string;              // 作者过滤
  keyword?: string;             // 关键词搜索
  startDate?: Date;             // 开始日期
  endDate?: Date;               // 结束日期
  sortBy?: 'publishDate' | 'updateTime' | 'title'; // 排序字段
  sortOrder?: 'asc' | 'desc';   // 排序方向
}

export interface ArticleStats {
  totalArticles: number;        // 总文章数
  unreadCount: number;          // 未读数
  favoriteCount: number;        // 收藏数
  feedCount: number;            // RSS源数
  folderCount: number;          // 文件夹数
}
