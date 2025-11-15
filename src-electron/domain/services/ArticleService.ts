/**
 * Article Service
 * 业务逻辑层 - 处理复杂的业务规则和流程
 */

import { ArticleRepository, FeedRepository, FolderRepository } from '../repositories/Interfaces';
import { Article, FeedSource, Folder, ArticleFilter, ArticleStats } from '../models/Article';
import { EventEmitter } from 'events';

export enum ArticleEventType {
  ARTICLE_ADDED = 'article_added',
  ARTICLE_UPDATED = 'article_updated',
  ARTICLE_DELETED = 'article_deleted',
  ARTICLE_READ = 'article_read',
  ARTICLE_FAVORITE = 'article_favorite',
  FEED_ADDED = 'feed_added',
  FEED_REMOVED = 'feed_removed',
  FEED_UPDATED = 'feed_updated',
  FOLDER_ADDED = 'folder_added',
  FOLDER_REMOVED = 'folder_removed',
  FOLDER_RENAMED = 'folder_renamed',
  STATS_UPDATED = 'stats_updated'
}

export interface ArticleEvent {
  type: ArticleEventType;
  data: any;
  timestamp: Date;
}

export class ArticleService {
  private articleRepo: ArticleRepository;
  private feedRepo: FeedRepository;
  private folderRepo: FolderRepository;
  private eventEmitter: EventEmitter;

  constructor(
    articleRepo: ArticleRepository,
    feedRepo: FeedRepository,
    folderRepo: FolderRepository
  ) {
    this.articleRepo = articleRepo;
    this.feedRepo = feedRepo;
    this.folderRepo = folderRepo;
    this.eventEmitter = new EventEmitter();
  }

  // Event handling
  on(eventType: ArticleEventType, listener: (event: ArticleEvent) => void): void {
    this.eventEmitter.on(eventType, listener);
  }

  off(eventType: ArticleEventType, listener: (event: ArticleEvent) => void): void {
    this.eventEmitter.off(eventType, listener);
  }

  private emitEvent(type: ArticleEventType, data: any): void {
    this.eventEmitter.emit(type, {
      type,
      data,
      timestamp: new Date()
    });
  }

  // Article operations
  async getArticles(filter?: ArticleFilter, offset?: number, limit?: number) {
    const result = await this.articleRepo.getArticles(filter, offset, limit);
    return result;
  }

  async getArticle(id: string) {
    return await this.articleRepo.getArticleById(id);
  }

  async toggleReadStatus(id: string) {
    const article = await this.articleRepo.getArticleById(id);
    if (!article) {
      throw new Error('Article not found');
    }

    const newReadStatus = !article.read;
    await this.articleRepo.markAsRead(id, newReadStatus);

    // Update feed unread count
    if (article.feedId) {
      if (newReadStatus) {
        await this.feedRepo.decrementUnreadCount(article.feedId);
      } else {
        await this.feedRepo.incrementUnreadCount(article.feedId);
      }
    }

    this.emitEvent(ArticleEventType.ARTICLE_READ, { articleId: id, read: newReadStatus });
    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }

  async toggleFavorite(id: string) {
    const isFavorite = await this.articleRepo.toggleFavorite(id);
    this.emitEvent(ArticleEventType.ARTICLE_FAVORITE, { articleId: id, favorite: isFavorite });
    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }

  async markAllAsRead(filter?: { feedId?: string, folderName?: string }) {
    await this.articleRepo.markAllAsRead(filter?.feedId, filter?.folderName);

    if (filter?.feedId) {
      await this.feedRepo.resetUnreadCount(filter.feedId);
    }

    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }

  async clearAllFavorites() {
    await this.articleRepo.clearAllFavorites();
    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }

  // Feed operations
  async getFeeds(folderName?: string) {
    return await this.feedRepo.getFeeds(folderName);
  }

  async addFeed(feedUrl: string, title?: string, folderName: string = '默认') {
    // Check if feed exists
    const exists = await this.feedRepo.feedExists(feedUrl);
    if (exists) {
      throw new Error('Feed already exists');
    }

    // Here we would parse the feed and create a FeedSource object
    // For now, we'll use a placeholder
    const feed: FeedSource = {
      id: this.generateId(),
      title: title || 'Untitled',
      url: feedUrl,
      htmlUrl: '',
      avatar: '',
      folderName,
      unreadCount: 0
    };

    await this.feedRepo.saveFeed(feed);
    this.emitEvent(ArticleEventType.FEED_ADDED, feed);
    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }

  async removeFeed(id: string) {
    const feed = await this.feedRepo.getFeedById(id);
    if (!feed) {
      throw new Error('Feed not found');
    }

    await this.feedRepo.deleteFeed(id);
    this.emitEvent(ArticleEventType.FEED_REMOVED, feed);
    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }

  // Folder operations
  async getFolders() {
    return await this.folderRepo.getFolders();
  }

  async addFolder(name: string) {
    const exists = await this.folderRepo.getFolderByName(name);
    if (exists) {
      throw new Error('Folder already exists');
    }

    const folder: Folder = {
      id: name,
      name,
      order: 0
    };

    await this.folderRepo.saveFolder(folder);
    this.emitEvent(ArticleEventType.FOLDER_ADDED, folder);
    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }

  async removeFolder(name: string) {
    await this.folderRepo.deleteFolder(name);
    this.emitEvent(ArticleEventType.FOLDER_REMOVED, { name });
    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }

  async renameFolder(oldName: string, newName: string) {
    await this.folderRepo.renameFolder(oldName, newName);
    this.emitEvent(ArticleEventType.FOLDER_RENAMED, { oldName, newName });
    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }

  // Statistics
  async getStats(): Promise<ArticleStats> {
    return await this.articleRepo.getArticleStats();
  }

  // Utility
  private generateId(): string {
    return `feed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Sync operations
  async syncFeed(feedId: string) {
    // Implementation for syncing a specific feed
    // This would fetch new articles from the RSS source
    const feed = await this.feedRepo.getFeedById(feedId);
    if (!feed) {
      throw new Error('Feed not found');
    }

    // TODO: Implement actual sync logic
    // - Fetch RSS feed
    // - Parse articles
    // - Save to database
    // - Update statistics

    this.emitEvent(ArticleEventType.FEED_UPDATED, feed);
    this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
  }
}
