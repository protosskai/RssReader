/**
 * Article Repository Implementation
 * 基于SQLite的Article数据访问实现
 */

import type {
	ArticleRepository,
	FeedRepository,
	FolderRepository,
} from "../../domain/repositories/Interfaces";
import type {
	Article,
	FeedSource,
	Folder,
	ArticleFilter,
	ArticleStats,
} from "../../domain/models/Article";
import { SqliteUtil } from "./sqlite";
import type { PostIndexItem, PostInfoItem } from "./common";
import {
	beautyStr,
	extractTextFromHtml,
	parseBase64ToString,
} from "src-electron/util/string";

export class SqliteArticleRepository implements ArticleRepository {
	private storage: SqliteUtil;

	constructor() {
		this.storage = SqliteUtil.getInstance();
	}

	private mapPostIndexToArticle(
		post: PostIndexItem & { favorite?: boolean },
	): Article {
		return {
			id: post.guid,
			guid: post.guid,
			title: post.title,
			content: post.desc,
			description: post.desc,
			summary: post.desc,
			link: post.link,
			author: post.author || "",
			pubDate: post.updateTime,
			publishDate: new Date(post.updateTime),
			updateTime: new Date(post.updateTime),
			read: post.read,
			favorite: !!post.favorite,
			feedId: post.rssId || "",
			feedTitle: "",
			feedUrl: "",
			folderName: "默认",
		};
	}

	private mapContentToArticle(
		id: string,
		content: {
			title: string;
			content: string;
			link: string;
			author?: string;
			updateTime?: string;
			rssId: string;
			read?: number;
			favorite?: number;
		},
	): Article {
		const updateTime = content.updateTime
			? new Date(content.updateTime)
			: new Date();
		const updateTimeStr = content.updateTime || updateTime.toISOString();

		return {
			id,
			guid: id,
			title: content.title,
			content: content.content,
			description: content.content,
			summary: content.content,
			link: content.link,
			author: content.author || "",
			pubDate: updateTimeStr,
			publishDate: updateTime,
			updateTime,
			read: content.read === 1,
			favorite: content.favorite === 1,
			feedId: content.rssId,
			feedTitle: "",
			feedUrl: "",
			folderName: "默认",
		};
	}

	/**
	 * List articles with optional filters.
	 * - With keyword: full-text search (FTS5)
	 * - Without keyword: direct SQL (never call FTS with empty query — FTS5 errors)
	 */
	async getArticles(
		filter?: ArticleFilter,
		offset = 0,
		limit = 50,
	): Promise<{ articles: Article[]; total: number }> {
		const keyword = (filter?.keyword || "").trim();

		// Keyword search path — FTS only when query is non-empty
		if (keyword) {
			const result = await this.storage.searchPosts(keyword, {
				limit: Math.max(offset + limit, limit),
				dateFrom: filter?.startDate ?? undefined,
				dateTo: filter?.endDate ?? undefined,
			});

			if (!result.success) {
				throw new Error(result.msg || "搜索失败");
			}

			let articles = result.data.map((post) => this.mapPostIndexToArticle(post));

			if (filter?.read !== undefined) {
				articles = articles.filter((a) => a.read === filter.read);
			}
			if (filter?.favorite !== undefined) {
				articles = articles.filter((a) => a.favorite === filter.favorite);
			}
			if (filter?.feedId) {
				articles = articles.filter((a) => a.feedId === filter.feedId);
			}
			if (filter?.folderName) {
				// searchPosts already joins folder; folderName filter applied if present on post
			}

			const total = articles.length;
			return {
				articles: articles.slice(offset, offset + limit),
				total,
			};
		}

		// Direct SQL path — list by feed / favorite / read / folder
		const helper = this.storage.getHelper();
		const where: string[] = [];
		const params: unknown[] = [];

		if (filter?.feedId) {
			where.push("p.rss_id = ?");
			params.push(filter.feedId);
		}
		if (filter?.read !== undefined) {
			where.push("p.read = ?");
			params.push(filter.read ? 1 : 0);
		}
		if (filter?.favorite !== undefined) {
			where.push("p.favorite = ?");
			params.push(filter.favorite ? 1 : 0);
		}
		if (filter?.folderName) {
			where.push("f.name = ?");
			params.push(filter.folderName);
		}
		if (filter?.startDate) {
			where.push("p.update_time >= ?");
			params.push(filter.startDate);
		}
		if (filter?.endDate) {
			where.push("p.update_time <= ?");
			params.push(filter.endDate);
		}

		const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

		const countRow = await helper.get<{ c: number }>(
			`
			SELECT COUNT(*) as c
			FROM post_info p
			LEFT JOIN rss_info r ON p.rss_id = r.rss_id
			LEFT JOIN folder_info f ON r.folder_id = f.id
			${whereSql}
			`,
			params,
		);
		const total = countRow?.c ?? 0;

		const rows = await helper.all<{
			title: string;
			guid: string;
			link: string;
			content: string;
			author: string;
			update_time: string;
			read: number;
			favorite: number;
			rss_id: string;
		}>(
			`
			SELECT p.title, p.guid, p.link, p.content, p.author, p.update_time,
			       p.read, p.favorite, p.rss_id
			FROM post_info p
			LEFT JOIN rss_info r ON p.rss_id = r.rss_id
			LEFT JOIN folder_info f ON r.folder_id = f.id
			${whereSql}
			ORDER BY p.update_time DESC
			LIMIT ? OFFSET ?
			`,
			[...params, limit, offset],
		);

		const articles: Article[] = (rows || []).map((row) => {
			let desc = "";
			try {
				desc = parseBase64ToString(row.content || "");
				desc = beautyStr(extractTextFromHtml(desc), 100);
			} catch {
				desc = (row.content || "").slice(0, 100);
			}
			return this.mapPostIndexToArticle({
				title: row.title,
				guid: row.guid,
				link: row.link,
				author: row.author || "",
				updateTime: row.update_time || "",
				read: row.read === 1,
				desc,
				rssId: row.rss_id,
				favorite: row.favorite === 1,
			});
		});

		return { articles, total };
	}

	async getArticleById(id: string): Promise<Article | null> {
		const result = await this.storage.queryPostContentByGuid(id);

		if (!result.success) {
			return null;
		}

		return this.mapContentToArticle(id, result.data);
	}

	async saveArticle(article: Article): Promise<void> {
		const result = await this.storage.insertPostInfo(
			article.feedId,
			article.title,
			article.author ?? "",
			article.link,
			article.content,
			article.id ?? article.guid,
			article.updateTime.toISOString(),
		);

		if (!result.success) {
			throw new Error(result.msg);
		}
	}

	async deleteArticle(id: string): Promise<void> {
		const helper = this.storage.getHelper();
		try {
			await helper.run("DELETE FROM post_info WHERE guid = ?", [id]);
		} catch (error) {
			console.error("[ArticleRepository] Failed to delete article:", id, error);
			throw new Error(
				`删除文章失败: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async markAsRead(id: string, read: boolean): Promise<void> {
		const helper = this.storage.getHelper();
		try {
			await helper.run("UPDATE post_info SET read = ? WHERE guid = ?", [
				read ? 1 : 0,
				id,
			]);
		} catch (error) {
			console.error(
				"[ArticleRepository] Failed to mark article as read:",
				id,
				error,
			);
			throw new Error(
				`标记已读失败: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async toggleFavorite(id: string): Promise<boolean> {
		const article = await this.getArticleById(id);
		if (!article) {
			throw new Error(`文章不存在: ${id}`);
		}
		return this.setFavorite(id, !article.favorite);
	}

	/** Explicitly set favorite flag (idempotent). */
	async setFavorite(id: string, favorite: boolean): Promise<boolean> {
		const helper = this.storage.getHelper();
		try {
			await helper.run("UPDATE post_info SET favorite = ? WHERE guid = ?", [
				favorite ? 1 : 0,
				id,
			]);
		} catch (error) {
			console.error(
				"[ArticleRepository] Failed to set favorite:",
				id,
				error,
			);
			throw new Error(
				`设置收藏状态失败: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		return favorite;
	}

	async getUnreadArticles(feedId?: string): Promise<Article[]> {
		const result = await this.getArticles({ feedId, read: false }, 0, 1000);
		return result.articles;
	}

	async getFavoriteArticles(): Promise<Article[]> {
		const result = await this.getArticles(undefined, 0, 1000);
		return result.articles.filter((article) => article.favorite);
	}

	async markAllAsRead(feedId?: string, folderName?: string): Promise<void> {
		const helper = this.storage.getHelper();

		try {
			if (feedId) {
				await helper.run("UPDATE post_info SET read = 1 WHERE rss_id = ?", [
					feedId,
				]);
			} else if (folderName) {
				await helper.run(
					`
          UPDATE post_info SET read = 1
          WHERE rss_id IN (
            SELECT rss_id FROM rss_info
            WHERE folder_id = (SELECT id FROM folder_info WHERE name = ?)
          )
        `,
					[folderName],
				);
			} else {
				await helper.run("UPDATE post_info SET read = 1");
			}
		} catch (error) {
			console.error(
				"[ArticleRepository] Failed to mark all as read:",
				{ feedId, folderName },
				error,
			);
			throw new Error(
				`全部标为已读失败: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async clearAllFavorites(): Promise<void> {
		const helper = this.storage.getHelper();
		try {
			await helper.run("UPDATE post_info SET favorite = 0 WHERE favorite = 1");
		} catch (error) {
			console.error(
				"[ArticleRepository] Failed to clear all favorites:",
				error,
			);
			throw new Error(
				`清除所有收藏失败: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async syncArticles(feedId: string, posts: PostInfoItem[]): Promise<number> {
		const result = await this.storage.syncRssPostList(feedId, posts);
		if (!result.success) {
			throw new Error(result.msg);
		}
		return result.data ?? 0;
	}

	async getArticleStats(): Promise<ArticleStats> {
		// Use efficient SQL aggregate queries instead of fetching all articles in memory
		const stats = await this.storage.getAggregatedStats();

		return {
			totalArticles: stats.totalArticles,
			unreadCount: stats.unreadCount,
			favoriteCount: stats.favoriteCount,
			feedCount: stats.feedCount,
			folderCount: stats.folderCount,
		};
	}
}

export class SqliteFeedRepository implements FeedRepository {
	private storage: SqliteUtil;

	constructor() {
		this.storage = SqliteUtil.getInstance();
	}

	async getFeeds(folderName?: string): Promise<FeedSource[]> {
		const result = await this.storage.loadFolderItemList();
		if (!result.success) {
			return [];
		}

		return result.data.flatMap((folder) => {
			if (folderName && folder.folderName !== folderName) {
				return [];
			}

			return folder.data.map((feed) => ({
				id: feed.id,
				title: feed.title,
				url: feed.feedUrl,
				feedUrl: feed.feedUrl,
				htmlUrl: feed.htmlUrl,
				avatar: feed.avatar || "",
				folderName: folder.folderName,
				lastUpdateTime: feed.lastUpdateTime
					? new Date(feed.lastUpdateTime)
					: undefined,
				unreadCount: feed.unread,
			}));
		});
	}

	async getFeedById(id: string): Promise<FeedSource | null> {
		const feeds = await this.getFeeds();
		return feeds.find((feed) => feed.id === id) || null;
	}

	async saveFeed(feed: FeedSource): Promise<void> {
		const helper = this.storage.getHelper();

		try {
			// 获取或创建默认文件夹ID
			const folders = await this.storage.queryFolderByFolderName(
				feed.folderName,
			);
			let folderId: number;

			if (folders.success && folders.data.length > 0) {
				folderId = folders.data[0].id;
			} else {
				// 创建文件夹
				const result = await this.storage.insertFolderInfo(feed.folderName);
				if (!result.success) {
					throw new Error(`创建文件夹失败: ${result.msg}`);
				}
				const newFolders = await this.storage.queryFolderByFolderName(
					feed.folderName,
				);
				if (!newFolders.success || newFolders.data.length === 0) {
					throw new Error("无法找到新创建的文件夹");
				}
				folderId = newFolders.data[0].id;
			}

			await helper.run(
				"INSERT INTO rss_info (rss_id, folder_id, title, html_url, feed_url, avatar, update_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
				[
					feed.id,
					folderId,
					feed.title,
					feed.htmlUrl || "",
					feed.url,
					feed.avatar || "",
					feed.lastUpdateTime?.toISOString() || new Date().toISOString(),
				],
			);
		} catch (error) {
			console.error(
				"[FeedRepository] Failed to save feed:",
				feed.folderName,
				feed.title,
				error,
			);
			if (
				error instanceof Error &&
				(error.message.startsWith("创建文件夹失败") ||
					error.message.startsWith("无法找到新创建的文件夹"))
			) {
				throw error;
			}
			throw new Error(
				`保存订阅源失败: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async deleteFeed(id: string): Promise<void> {
		const helper = this.storage.getHelper();

		try {
			// 在一个事务中删除关联的文章和RSS源，保证原子性
			await helper.transaction(async () => {
				await helper.run("DELETE FROM post_info WHERE rss_id = ?", [id]);
				await helper.run("DELETE FROM rss_info WHERE rss_id = ?", [id]);
			});
		} catch (error) {
			console.error("[FeedRepository] Failed to delete feed:", id, error);
			throw new Error(
				`删除订阅源失败: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async updateFeedLastUpdateTime(id: string, time: Date): Promise<void> {
		const helper = this.storage.getHelper();
		await helper.run("UPDATE rss_info SET update_time = ? WHERE rss_id = ?", [
			time.toISOString(),
			id,
		]);
	}

	async incrementUnreadCount(_id: string): Promise<void> {
		// rss_info 表没有独立的 unread 字段；未读数通过查询 post_info.read=0 实时计算
		// 此方法保留为空操作以兼容接口
	}

	async decrementUnreadCount(_id: string): Promise<void> {
		// 同 incrementUnreadCount
	}

	async resetUnreadCount(_id: string): Promise<void> {
		// 同 incrementUnreadCount
	}

	async feedExists(url: string): Promise<boolean> {
		const feed = await this.getFeedByUrl(url);
		return Boolean(feed);
	}

	async getFeedByUrl(url: string): Promise<FeedSource | null> {
		const feeds = await this.getFeeds();
		return feeds.find((feed) => feed.url === url) || null;
	}
}

export class SqliteFolderRepository implements FolderRepository {
	private storage: SqliteUtil;

	constructor() {
		this.storage = SqliteUtil.getInstance();
	}

	async getFolders(): Promise<Folder[]> {
		const folderResult = await this.storage.queryFolderByFolderName();
		if (!folderResult.success) {
			throw new Error(folderResult.msg);
		}

		return folderResult.data.map((folder: { id: number; name: string }) => ({
			id: String(folder.id),
			name: folder.name,
			order: 0,
		}));
	}

	async getFolderByName(name: string): Promise<Folder | null> {
		const folders = await this.getFolders();
		return folders.find((folder) => folder.name === name) || null;
	}

	async saveFolder(folder: Folder): Promise<void> {
		const result = await this.storage.insertFolderInfo(folder.name);
		if (!result.success) {
			throw new Error(result.msg);
		}
	}

	async deleteFolder(name: string): Promise<void> {
		const result = await this.storage.deleteFolderInfo(name);
		if (!result.success) {
			throw new Error(result.msg);
		}
	}

	async renameFolder(oldName: string, newName: string): Promise<void> {
		const helper = this.storage.getHelper();
		await helper.run("UPDATE folder_info SET name = ? WHERE name = ?", [
			newName,
			oldName,
		]);
	}

	async getFolderNames(): Promise<string[]> {
		const folders = await this.getFolders();
		return folders.map((folder) => folder.name);
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
