/**
 * Article Repository Implementation
 * 基于SQLite的Article数据访问实现
 */

import { ArticleRepository, FeedRepository, FolderRepository } from '../../domain/repositories/Interfaces';
import { Article, FeedSource, Folder, ArticleFilter, ArticleStats } from '../../domain/models/Article';
import { SqliteUtil } from '../../storage/sqlite';
import { ErrorData, ErrorMsg } from '../../../src/common/ErrorMsg';
import { StorageUtil } from '../../storage/common';

export class SqliteArticleRepository implements ArticleRepository {
  private storage: StorageUtil;

  constructor() {
    this.storage = SqliteUtil.getInstance();
  }

  async getArticles(filter?: ArticleFilter, offset = 0, limit = 50): Promise<{ articles: Article[], total: number }> {
    const result = await this.storage.queryArticleListWithFilter({
      filter,
      offset,
      limit
    });

    if (!result.success) {
      throw new Error(result.msg);
    }

    return {
      articles: result.data.articles,
      total: result.data.total
    };
  }

  async getArticleById(id: string): Promise<Article | null> {
    const result = await this.storage.queryPostContentByGuid(id);

    if (!result.success) {
      return null;
    }

    return result.data;
  }

  async saveArticle(article: Article): Promise<void> {
    await this.storage.saveArticle(article);
  }

  async deleteArticle(id: string): Promise<void> {
    await this.storage.deletePostByGuid(id);
  }

  async markAsRead(id: string, read: boolean): Promise<void> {
    await this.storage.markPostAsRead(id, read);
  }

  async toggleFavorite(id: string): Promise<boolean> {
    const article = await this.getArticleById(id);
    if (!article) {
      throw new Error('Article not found');
    }

    const newFavoriteState = !article.favorite;

    if (newFavoriteState) {
      await this.storage.addFavoritePost(id);
    } else {
      await this.storage.removeFavoritePost(id);
    }

    return newFavoriteState;
  }

  async getUnreadArticles(feedId?: string): Promise<Article[]> {
    const result = await this.storage.queryUnreadPostList(feedId);

    if (!result.success) {
      throw new Error(result.msg);
    }

    return result.data;
  }

  async getFavoriteArticles(): Promise<Article[]> {
    const result = await this.storage.queryFavoritePostList();

    if (!result.success) {
      throw new Error(result.msg);
    }

    return result.data;
  }

  async markAllAsRead(feedId?: string, folderName?: string): Promise<void> {
    await this.storage.markAllPostsAsRead(feedId, folderName);
  }

  async clearAllFavorites(): Promise<void> {
    await this.storage.clearAllFavorites();
  }

  async getArticleStats(): Promise<ArticleStats> {
    const result = await this.storage.getArticleStats();

    if (!result.success) {
      throw new Error(result.msg);
    }

    return result.data;
  }
}

export class SqliteFeedRepository implements FeedRepository {
  private storage: StorageUtil;

  constructor() {
    this.storage = SqliteUtil.getInstance();
  }

  async getFeeds(folderName?: string): Promise<FeedSource[]> {
    const result = await this.storage.getRssInfoListFromDb();

    if (!Array.isArray(result)) {
      return [];
    }

    return result.flatMap(folder => {
      if (folderName && folder.folderName !== folderName) {
        return [];
      }

      return folder.data.map(feed => ({
        id: feed.id,
        title: feed.title,
        url: feed.feedUrl,
        htmlUrl: feed.htmlUrl,
        avatar: feed.avatar,
        folderName: folder.folderName,
        lastUpdateTime: feed.lastUpdateTime,
        unreadCount: feed.unread
      }));
    });
  }

  async getFeedById(id: string): Promise<FeedSource | null> {
    const feeds = await this.getFeeds();
    return feeds.find(feed => feed.id === id) || null;
  }

  async saveFeed(feed: FeedSource): Promise<void> {
    // 这里需要实现具体的存储逻辑
    // 可以调用现有的addRssSubscription逻辑
    await this.storage.saveRssInfo(feed);
  }

  async deleteFeed(id: string): Promise<void> {
    const feed = await this.getFeedById(id);
    if (!feed) {
      throw new Error('Feed not found');
    }

    await this.storage.removeRssInfo(feed.folderName, feed.url);
  }

  async updateFeedLastUpdateTime(id: string, time: Date): Promise<void> {
    await this.storage.updateRssInfoUpdateTime(id, time);
  }

  async incrementUnreadCount(id: string): Promise<void> {
    await this.storage.incrementRssUnreadCount(id);
  }

  async decrementUnreadCount(id: string): Promise<void> {
    await this.storage.decrementRssUnreadCount(id);
  }

  async resetUnreadCount(id: string): Promise<void> {
    await this.storage.resetRssUnreadCount(id);
  }

  async feedExists(url: string): Promise<boolean> {
    const result = await this.storage.checkRssExists(url);
    return result.success && result.data.exists;
  }

  async getFeedByUrl(url: string): Promise<FeedSource | null> {
    const feeds = await this.getFeeds();
    return feeds.find(feed => feed.url === url) || null;
  }
}

export class SqliteFolderRepository implements FolderRepository {
  private storage: StorageUtil;

  constructor() {
    this.storage = SqliteUtil.getInstance();
  }

  async getFolders(): Promise<Folder[]> {
    const folderList = await this.storage.getFolderInfoListFromDb();

    return folderList.map(folder => ({
      id: folder.folderName,
      name: folder.folderName,
      order: 0
    }));
  }

  async getFolderByName(name: string): Promise<Folder | null> {
    const folders = await this.getFolders();
    return folders.find(folder => folder.name === name) || null;
  }

  async saveFolder(folder: Folder): Promise<void> {
    await this.storage.saveFolder(folder.name);
  }

  async deleteFolder(name: string): Promise<void> {
    await this.storage.removeFolder(name);
  }

  async renameFolder(oldName: string, newName: string): Promise<void> {
    await this.storage.renameFolder(oldName, newName);
  }

  async getFolderNames(): Promise<string[]> {
    const folders = await this.getFolders();
    return folders.map(folder => folder.name);
  }
}

export class SqliteRepositoryFactory {
  createArticleRepository(): ArticleRepository {
    return new SqliteArticleRepository();
  }

  createFeedRepository(): FeedRepository {
    return new SqliteFeedRepository();
  }

  createFolderRepository(): FolderRepository {
    return new SqliteFolderRepository();
  }
}
