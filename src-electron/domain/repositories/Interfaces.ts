/**
 * Repository Interface
 * 数据访问层抽象 - 隔离业务逻辑与数据存储
 */

import { Article, FeedSource, Folder, ArticleFilter, ArticleStats } from './Article';

export interface ArticleRepository {
  // Article操作
  getArticles(filter?: ArticleFilter, offset?: number, limit?: number): Promise<{ articles: Article[], total: number }>;
  getArticleById(id: string): Promise<Article | null>;
  saveArticle(article: Article): Promise<void>;
  deleteArticle(id: string): Promise<void>;
  markAsRead(id: string, read: boolean): Promise<void>;
  toggleFavorite(id: string): Promise<boolean>;

  // 批量操作
  getUnreadArticles(feedId?: string): Promise<Article[]>;
  getFavoriteArticles(): Promise<Article[]>;
  markAllAsRead(feedId?: string, folderName?: string): Promise<void>;
  clearAllFavorites(): Promise<void>;

  // 统计信息
  getArticleStats(): Promise<ArticleStats>;
}

export interface FeedRepository {
  // Feed操作
  getFeeds(folderName?: string): Promise<FeedSource[]>;
  getFeedById(id: string): Promise<FeedSource | null>;
  saveFeed(feed: FeedSource): Promise<void>;
  deleteFeed(id: string): Promise<void>;
  updateFeedLastUpdateTime(id: string, time: Date): Promise<void>;
  incrementUnreadCount(id: string): Promise<void>;
  decrementUnreadCount(id: string): Promise<void>;
  resetUnreadCount(id: string): Promise<void>;

  // 检查订阅是否存在
  feedExists(url: string): Promise<boolean>;
  getFeedByUrl(url: string): Promise<FeedSource | null>;
}

export interface FolderRepository {
  // Folder操作
  getFolders(): Promise<Folder[]>;
  getFolderByName(name: string): Promise<Folder | null>;
  saveFolder(folder: Folder): Promise<void>;
  deleteFolder(name: string): Promise<void>;
  renameFolder(oldName: string, newName: string): Promise<void>;

  // 获取所有文件夹名称
  getFolderNames(): Promise<string[]>;
}

export interface RepositoryFactory {
  createArticleRepository(): ArticleRepository;
  createFeedRepository(): FeedRepository;
  createFolderRepository(): FolderRepository;
}
