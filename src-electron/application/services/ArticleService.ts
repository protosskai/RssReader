/**
 * Article Service
 * 业务逻辑层 - 处理复杂的业务规则和流程
 */

import type {
	ArticleRepository,
	FeedRepository,
	FolderRepository,
} from "../../domain/repositories/Interfaces";
import type {
	FeedSource,
	Folder,
	ArticleFilter,
	ArticleStats,
} from "../../domain/models/Article";
import { EventEmitter } from "events";
import { getUrl } from "../../infrastructure/network/NetUtil";
import { buildAvatarUrl } from "../../shared/utils";
import { RssParserAdapter } from "../../infrastructure/parsing/RssParserAdapter";

export enum ArticleEventType {
	ARTICLE_ADDED = "article_added",
	ARTICLE_UPDATED = "article_updated",
	ARTICLE_DELETED = "article_deleted",
	ARTICLE_READ = "article_read",
	ARTICLE_FAVORITE = "article_favorite",
	FEED_ADDED = "feed_added",
	FEED_REMOVED = "feed_removed",
	FEED_UPDATED = "feed_updated",
	FOLDER_ADDED = "folder_added",
	FOLDER_REMOVED = "folder_removed",
	FOLDER_RENAMED = "folder_renamed",
	STATS_UPDATED = "stats_updated",
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
		folderRepo: FolderRepository,
	) {
		this.articleRepo = articleRepo;
		this.feedRepo = feedRepo;
		this.folderRepo = folderRepo;
		this.eventEmitter = new EventEmitter();
	}

	// Event handling
	on(
		eventType: ArticleEventType,
		listener: (event: ArticleEvent) => void,
	): void {
		this.eventEmitter.on(eventType, listener);
	}

	off(
		eventType: ArticleEventType,
		listener: (event: ArticleEvent) => void,
	): void {
		this.eventEmitter.off(eventType, listener);
	}

	private emitEvent(type: ArticleEventType, data: any): void {
		this.eventEmitter.emit(type, {
			type,
			data,
			timestamp: new Date(),
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
			throw new Error("Article not found");
		}
		await this.setReadStatus(id, !article.read);
	}

	/**
	 * Idempotent set of read/unread. Safe to call from multiple UI surfaces
	 * (e.g. list optimistic paint + reader open) without flip-flop races.
	 */
	async setReadStatus(id: string, read: boolean): Promise<boolean> {
		const article = await this.articleRepo.getArticleById(id);
		if (!article) {
			throw new Error("Article not found");
		}

		if (article.read === read) {
			return read;
		}

		await this.articleRepo.markAsRead(id, read);

		if (article.feedId) {
			if (read) {
				await this.feedRepo.decrementUnreadCount(article.feedId);
			} else {
				await this.feedRepo.incrementUnreadCount(article.feedId);
			}
		}

		this.emitEvent(ArticleEventType.ARTICLE_READ, {
			articleId: id,
			read,
		});
		this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
		return read;
	}

	async toggleFavorite(id: string): Promise<boolean> {
		const isFavorite = await this.articleRepo.toggleFavorite(id);
		this.emitEvent(ArticleEventType.ARTICLE_FAVORITE, {
			articleId: id,
			favorite: isFavorite,
		});
		this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
		return isFavorite;
	}

	/** Idempotent set favorite on / off */
	async setFavorite(id: string, favorite: boolean): Promise<boolean> {
		const repo = this.articleRepo as {
			setFavorite?: (id: string, favorite: boolean) => Promise<boolean>;
			toggleFavorite: (id: string) => Promise<boolean>;
		};
		const result = repo.setFavorite
			? await repo.setFavorite(id, favorite)
			: await (async () => {
					const article = await this.articleRepo.getArticleById(id);
					if (!article) throw new Error("Article not found");
					if (article.favorite === favorite) return favorite;
					return this.articleRepo.toggleFavorite(id);
				})();
		this.emitEvent(ArticleEventType.ARTICLE_FAVORITE, {
			articleId: id,
			favorite: result,
		});
		this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
		return result;
	}

	async markAllAsRead(filter?: { feedId?: string; folderName?: string }) {
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

	async getFeed(id: string) {
		return await this.feedRepo.getFeedById(id);
	}

	async addFeed(feedUrl: string, title?: string, folderName: string = "默认") {
		// Check if feed exists
		const exists = await this.feedRepo.feedExists(feedUrl);
		if (exists) {
			throw new Error("Feed already exists");
		}

		// Fetch and parse RSS feed metadata
		const feedContent = await getUrl(feedUrl);
		if (!feedContent) {
			throw new Error(`Failed to fetch feed: ${feedUrl}`);
		}
		const parser = new RssParserAdapter();
		const parsed = await parser.parseString(feedContent);

		const feedId = `feed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const feed: FeedSource = {
			id: feedId,
			title: title || parsed.title || "Untitled",
			url: feedUrl,
			feedUrl,
			htmlUrl: parsed.link || "",
			avatar: parsed.link ? buildAvatarUrl(parsed.link) : "",
			folderName,
			lastUpdateTime: parsed.lastBuildDate
				? new Date(parsed.lastBuildDate)
				: new Date(),
			unreadCount: 0,
		};

		await this.feedRepo.saveFeed(feed);
		this.emitEvent(ArticleEventType.FEED_ADDED, feed);
		this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());

		// Try to sync articles immediately
		try {
			await this.syncFeed(feedId);
		} catch (syncError) {
			console.error(
				`[ArticleService] Initial sync of ${feed.title} failed:`,
				syncError,
			);
		}
	}

	async removeFeed(id: string) {
		const feed = await this.feedRepo.getFeedById(id);
		if (!feed) {
			throw new Error("Feed not found");
		}

		await this.feedRepo.deleteFeed(id);
		this.emitEvent(ArticleEventType.FEED_REMOVED, feed);
		this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
	}

	// Folder operations
	async getFolders() {
		return await this.folderRepo.getFolders();
	}

	async getFolder(name: string) {
		return await this.folderRepo.getFolderByName(name);
	}

	async addFolder(name: string) {
		const exists = await this.folderRepo.getFolderByName(name);
		if (exists) {
			throw new Error("Folder already exists");
		}

		const folder: Folder = {
			id: name,
			name,
			feedCount: 0,
			parentId: undefined,
			order: 0,
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

	// Sync operations
	async syncFeed(feedId: string): Promise<number> {
		const feed = await this.feedRepo.getFeedById(feedId);
		if (!feed) {
			throw new Error("Feed not found");
		}

		console.log(`[ArticleService] Syncing feed: ${feed.title} (${feed.url})`);

		const parser = new RssParserAdapter();
		let parsed;
		try {
			parsed = await parser.parseUrl(feed.url);
		} catch {
			const content = await getUrl(feed.url);
			if (!content) {
				console.log(
					`[ArticleService] Feed ${feed.title} returned empty content`,
				);
				return 0;
			}
			parsed = await parser.parseString(content);
		}

		if (!parsed.items || parsed.items.length === 0) {
			console.log(`[ArticleService] Feed ${feed.title} returned no posts`);
			this.emitEvent(ArticleEventType.FEED_UPDATED, feed);
			this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());
			return 0;
		}

		const posts = parsed.items.map((item: any) => ({
			title: item.title || "",
			link: item.link || "",
			desc: item.content || item.description || "",
			read: false as boolean,
			author: item.author || "",
			updateTime: item.pubDate || new Date().toISOString(),
			guid: item.guid,
		}));

		const insertedCount = await this.articleRepo.syncArticles(feedId, posts);

		// Update feed's lastUpdateTime
		await this.feedRepo.updateFeedLastUpdateTime(feedId, new Date());

		this.emitEvent(ArticleEventType.FEED_UPDATED, feed);
		this.emitEvent(ArticleEventType.STATS_UPDATED, await this.getStats());

		return insertedCount;
	}
}
