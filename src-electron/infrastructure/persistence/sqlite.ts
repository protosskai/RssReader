import type { PostIndexItem, StorageUtil } from "./common";
import type {
	RssFolderItem,
	PostInfoItem,
	ContentInfo,
} from "src/common/models";
import type { ErrorData, ErrorMsg } from "src/common/ErrorMsg";
import {
	extractTextFromHtml,
	beautyStr,
	convertStringToBase64,
	parseBase64ToString,
} from "src-electron/util/string";
import { SqliteHelper } from "./SqliteHelper";
import type { Database } from "sqlite3";

export class SqliteUtil implements StorageUtil {
	private dbHelper: SqliteHelper;
	private db: Database | null = null;
	private static instance: SqliteUtil | null = null;

	static getInstance(): SqliteUtil {
		if (SqliteUtil.instance === null) {
			SqliteUtil.instance = new SqliteUtil();
		}
		return SqliteUtil.instance;
	}

	private constructor() {
		this.dbHelper = SqliteHelper.getInstance();
	}

	/**
	 * 获取 SqliteHelper 实例，供仓库层执行额外的参数化查询
	 */
	getHelper(): SqliteHelper {
		return this.dbHelper;
	}

	async init() {
		await this.dbHelper.init();

		// Run a quick health check to verify DB is responsive
		const healthy = await this.dbHelper.healthCheck();
		if (!healthy) {
			console.error("[sqlite.ts] Database health check failed after init");
		}
	}

	/**
	 * Execute a callback within a database transaction.
	 * Delegates to SqliteHelper.transaction().
	 */
	async transaction<T>(fn: () => Promise<T>): Promise<T> {
		return this.dbHelper.transaction(fn);
	}

	/**
	 * Check database connection health.
	 * Delegates to SqliteHelper.healthCheck().
	 */
	async healthCheck(): Promise<boolean> {
		return this.dbHelper.healthCheck();
	}

	// 允许的表名白名单
	private static readonly ALLOWED_TABLE_NAMES = [
		"folder_info",
		"rss_info",
		"post_info",
		"post_info_fts",
	];

	private async checkTableExist(tableName: string): Promise<boolean> {
		if (!SqliteUtil.ALLOWED_TABLE_NAMES.includes(tableName)) {
			throw new Error(`Table name not allowed: ${tableName}`);
		}
		try {
			const rows = await this.dbHelper.all<any>(
				"SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
				["table", tableName],
			);
			return rows.length > 0;
		} catch (err) {
			console.error("checkTableExist error:", err);
			return false;
		}
	}

	/**
	 * Ensure FTS table exists (no-op; SqliteHelper handles FTS creation during init).
	 * Kept for backward compatibility with searchPosts.
	 */
	private async ensureFtsTable(): Promise<void> {
		// SqliteHelper.init() handles FTS table creation and migration.
		// This is a no-op to avoid duplicate/direct DB access.
	}

	/**
	 * 向folder_info表插入一条记录
	 * @param folderName
	 * @param parentId
	 */
	async insertFolderInfo(
		folderName: string,
		parentId?: string,
	): Promise<ErrorMsg> {
		try {
			if (parentId) {
				await this.dbHelper.run(
					"INSERT INTO folder_info (name, parent_id) VALUES (?, ?)",
					[folderName, parentId],
				);
			} else {
				await this.dbHelper.run("INSERT INTO folder_info (name) VALUES (?)", [
					folderName,
				]);
			}
			return { success: true, msg: "" };
		} catch (err: any) {
			return { success: false, msg: err.message };
		}
	}

	/**
	 * 向rss_info表插入一条记录
	 * @param rssId
	 * @param folderId
	 * @param title
	 * @param htmlUrl
	 * @param feedUrl
	 * @param avatar
	 * @param updateTime
	 */
	async insertRssInfo(
		rssId: string,
		folderId: number,
		title: string,
		htmlUrl: string,
		feedUrl: string,
		avatar: string,
		updateTime: string,
	): Promise<ErrorMsg> {
		try {
			await this.dbHelper.run(
				"INSERT INTO rss_info (rss_id, folder_id, title, html_url, feed_url, avatar, update_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
				[rssId, folderId, title, htmlUrl, feedUrl, avatar, updateTime],
			);
			return { success: true, msg: "" };
		} catch (err: any) {
			return { success: false, msg: err.message };
		}
	}

	async insertPostInfo(
		rssId: string,
		title: string,
		author: string,
		link: string,
		content: string,
		guid: string,
		updateTime: string,
	): Promise<ErrorMsg> {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [sqlite.ts] insertPostInfo called`);
		console.log(`[${timestamp}] [sqlite.ts] rssId:`, rssId);
		console.log(`[${timestamp}] [sqlite.ts] title:`, title);
		console.log(`[${timestamp}] [sqlite.ts] guid:`, guid);

		const sql = `insert into post_info (rss_id, title, author, link, content, guid, update_time, read)
                    values(?, ?, ?, ?, ?, ?, ?, ?)`;
		const params = [
			rssId,
			title,
			author,
			link,
			convertStringToBase64(content),
			guid,
			updateTime,
			0,
		];

		try {
			console.log(`[${timestamp}] [sqlite.ts] Executing INSERT...`);
			await this.dbHelper.run(sql, params);
			console.log(`[${timestamp}] [sqlite.ts] INSERT successful`);
			return {
				success: true,
				msg: "",
			};
		} catch (err: any) {
			console.error(`[${timestamp}] [sqlite.ts] INSERT failed:`, err);
			console.error(`[${timestamp}] [sqlite.ts] Error stack:`, err.stack);
			return {
				success: false,
				msg: err.message,
			};
		}
	}

	/**
	 * 通过rssId更新rss_info的内容
	 * @param rssId
	 * @param folderId
	 * @param title
	 * @param htmlUrl
	 * @param feedUrl
	 * @param avatar
	 * @param updateTime
	 */
	async updateRssInfo(
		rssId: string,
		folderId: number,
		title: string,
		htmlUrl: string,
		feedUrl: string,
		avatar: string,
		updateTime: string,
	): Promise<ErrorMsg> {
		try {
			await this.dbHelper.run(
				"UPDATE rss_info SET folder_id = ?, title = ?, html_url = ?, feed_url = ?, avatar = ?, update_time = ? WHERE rss_id = ?",
				[folderId, title, htmlUrl, feedUrl, avatar, updateTime, rssId],
			);
			return { success: true, msg: "" };
		} catch (err: any) {
			return { success: false, msg: err.message };
		}
	}

	async updatePostInfo(
		postId: number,
		rssId: string,
		title: string,
		author: string,
		link: string,
		content: string,
		updateTime: string,
		read: boolean,
	): Promise<ErrorMsg> {
		try {
			await this.dbHelper.run(
				"UPDATE post_info SET rss_id = ?, title = ?, author = ?, link = ?, content = ?, update_time = ?, read = ? WHERE id = ?",
				[
					rssId,
					title,
					author,
					link,
					convertStringToBase64(content),
					updateTime,
					read ? 1 : 0,
					postId,
				],
			);
			return { success: true, msg: "" };
		} catch (err: any) {
			return { success: false, msg: err.message };
		}
	}

	/**
	 * 通过目录名称查询folder_info表,不传入参数则返回所有folder_info
	 * @param folderName
	 */
	async queryFolderByFolderId(folderId?: number): Promise<ErrorData<any>> {
		try {
			const rows = folderId
				? await this.dbHelper.all<any>(
						"SELECT * FROM folder_info WHERE id = ?",
						[folderId],
					)
				: await this.dbHelper.all<any>("SELECT * FROM folder_info");
			return { success: true, msg: "", data: rows };
		} catch (err: any) {
			return { success: false, msg: err.message, data: [] };
		}
	}

	async queryFolderByFolderName(folderName?: string): Promise<ErrorData<any>> {
		try {
			const rows = folderName
				? await this.dbHelper.all<any>(
						"SELECT * FROM folder_info WHERE name = ?",
						[folderName],
					)
				: await this.dbHelper.all<any>("SELECT * FROM folder_info");
			return { success: true, msg: "", data: rows };
		} catch (err: any) {
			return { success: false, msg: err.message, data: [] };
		}
	}

	/**
	 * 通过订阅链接查询rss_info表,不传入参数则返回所有rss_info
	 * @param feedUrl
	 */
	async queryRssByRssId(rssId?: string): Promise<ErrorData<any>> {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [sqlite.ts] queryRssByRssId called`);
		console.log(`[${timestamp}] [sqlite.ts] rssId:`, rssId);

		let sql: string | null;
		if (rssId) {
			sql = `select * from rss_info where rss_id=?`;
		} else {
			sql = `select * from rss_info`;
		}

		try {
			console.log(`[${timestamp}] [sqlite.ts] Executing query...`);
			console.log(`[${timestamp}] [sqlite.ts] SQL:`, sql);
			console.log(
				`[${timestamp}] [sqlite.ts] Parameters:`,
				rssId ? [rssId] : [],
			);

			const rows = await this.dbHelper.all<any>(sql, rssId ? [rssId] : []);
			console.log(`[${timestamp}] [sqlite.ts] Query result rows:`, rows.length);

			return {
				success: true,
				msg: "",
				data: rows,
			};
		} catch (err: any) {
			console.error(`[${timestamp}] [sqlite.ts] Query failed:`, err);
			console.error(`[${timestamp}] [sqlite.ts] Error stack:`, err.stack);
			return {
				success: false,
				msg: err.message,
				data: [],
			};
		}
	}

	async queryPostIndexByRssId(
		rssId: string,
	): Promise<ErrorData<PostIndexItem[]>> {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [sqlite.ts] queryPostIndexByRssId called`);
		console.log(`[${timestamp}] [sqlite.ts] rssId:`, rssId);

		try {
			const sql = `SELECT title, guid, link, content, author, update_time, read FROM post_info WHERE rss_id = ? ORDER BY update_time DESC`;
			console.log(`[${timestamp}] [sqlite.ts] Executing SQL:`, sql);
			console.log(`[${timestamp}] [sqlite.ts] Query parameter:`, rssId);

			const rows = await this.dbHelper.all<any>(sql, [rssId]);
			console.log(`[${timestamp}] [sqlite.ts] Query result rows:`, rows);
			console.log(`[${timestamp}] [sqlite.ts] Row count:`, rows.length);

			const result: PostIndexItem[] = [];
			for (const row of rows) {
				let desc: string = parseBase64ToString(row.content);
				desc = beautyStr(extractTextFromHtml(desc), 100);
				result.push({
					title: row.title,
					guid: row.guid,
					link: row.link,
					author: row.author,
					updateTime: row.update_time,
					read: row.read === 1,
					desc,
				});
			}

			console.log(
				`[${timestamp}] [sqlite.ts] Processed ${result.length} articles`,
			);
			console.log(
				`[${timestamp}] [sqlite.ts] queryPostIndexByRssId completed successfully`,
			);

			return {
				success: true,
				msg: "",
				data: result,
			};
		} catch (error) {
			console.error(
				`[${timestamp}] [sqlite.ts] queryPostIndexByRssId ERROR:`,
				error,
			);
			console.error(
				`[${timestamp}] [sqlite.ts] Error stack:`,
				error instanceof Error ? error.stack : "No stack trace",
			);

			return {
				success: false,
				msg: error instanceof Error ? error.message : String(error),
				data: [],
			};
		}
	}

	async queryPostContentByGuid(guid: string): Promise<ErrorData<ContentInfo>> {
		const timestamp = new Date().toISOString();
		console.log(
			`[${timestamp}] [sqlite.ts] queryPostContentByGuid called with guid:`,
			guid,
		);

		try {
			// 首先尝试通过guid查询
			const sql = `select rss_id,title,content,link,author,update_time,read,favorite from post_info where guid = ?`;
			console.log(
				`[${timestamp}] [sqlite.ts] Executing query by guid:`,
				sql,
				"params:",
				[guid],
			);
			let rows = await this.dbHelper.all<any>(sql, [guid]);
			console.log(
				`[${timestamp}] [sqlite.ts] Query by guid result:`,
				rows.length,
				"rows",
			);

			// 如果没有结果，尝试通过link查询（降级处理）
			if (rows.length === 0) {
				console.log(
					`[${timestamp}] [sqlite.ts] No results by guid, trying fallback query by link...`,
				);
				const fallbackSql = `select rss_id,title,content,link,author,update_time,read,favorite from post_info where link = ?`;
				console.log(
					`[${timestamp}] [sqlite.ts] Executing fallback query:`,
					fallbackSql,
					"params:",
					[guid],
				);
				rows = await this.dbHelper.all<any>(fallbackSql, [guid]);
				console.log(
					`[${timestamp}] [sqlite.ts] Fallback query result:`,
					rows.length,
					"rows",
				);
			}

			if (rows.length === 0) {
				console.warn(
					`[${timestamp}] [sqlite.ts] No data found for guid/link:`,
					guid,
				);
				return {
					success: false,
					msg: `guid/link【${guid}】不存在!`,
					data: {} as ContentInfo,
				};
			}

			const [row] = rows;
			console.log(`[${timestamp}] [sqlite.ts] Processing row data:`, row);

			const contentInfo: ContentInfo = {
				title: row["title"],
				content: parseBase64ToString(row.content),
				link: row["link"],
				author: row["author"],
				updateTime: row["update_time"],
				rssId: row["rss_id"],
				read: row["read"],
				favorite: row["favorite"],
			};

			console.log(
				`[${timestamp}] [sqlite.ts] Created contentInfo:`,
				contentInfo,
			);
			console.log(
				`[${timestamp}] [sqlite.ts] queryPostContentByGuid completed successfully`,
			);

			return {
				success: true,
				msg: "",
				data: contentInfo,
			};
		} catch (error) {
			console.error(
				`[${timestamp}] [sqlite.ts] queryPostContentByGuid ERROR:`,
				error,
			);
			console.error(
				`[${timestamp}] [sqlite.ts] Error stack:`,
				error instanceof Error ? error.stack : "No stack trace",
			);

			return {
				success: false,
				msg: error instanceof Error ? error.message : String(error),
				data: {} as ContentInfo,
			};
		}
	}

	async cleanFolderInfoTable(): Promise<ErrorMsg> {
		try {
			await this.dbHelper.run("DELETE FROM folder_info");
			return { success: true, msg: "" };
		} catch (err: any) {
			return { success: false, msg: err.message };
		}
	}

	async cleanRssInfoTable(): Promise<ErrorMsg> {
		try {
			await this.dbHelper.run("DELETE FROM rss_info");
			return { success: true, msg: "" };
		} catch (err: any) {
			return { success: false, msg: err.message };
		}
	}

	async deleteRssInfoByFolderName(folderName: string): Promise<ErrorMsg> {
		try {
			if (!(await this.checkFolderExist(folderName))) {
				return { success: false, msg: `${folderName}不存在!` };
			}
			const folderInfo = (await this.queryFolderByFolderName(folderName))
				.data[0];
			await this.dbHelper.run("DELETE FROM rss_info WHERE folder_id = ?", [
				folderInfo.id,
			]);
			return { success: true, msg: "" };
		} catch (err: any) {
			return { success: false, msg: err.message };
		}
	}

	async deleteFolderInfo(folderName: string): Promise<ErrorMsg> {
		try {
			await this.dbHelper.run("DELETE FROM folder_info WHERE name = ?", [
				folderName,
			]);
			return { success: true, msg: "" };
		} catch (err: any) {
			return { success: false, msg: err.message };
		}
	}

	async checkFolderExist(folderName: string): Promise<boolean> {
		const folderData = await this.queryFolderByFolderName(folderName);
		if (!folderData.success) {
			throw new Error(folderData.msg);
		}
		return folderData.data.length > 0;
	}

	async checkRssExist(rssId: string): Promise<boolean> {
		const rssData = await this.queryRssByRssId(rssId);
		if (!rssData.success) {
			throw new Error(rssData.msg);
		}
		return rssData.data.length > 0;
	}

	/**
	 * 将folder信息同步到数据库表中,同时同步folder关联的rss信息。
	 * Called from dumpFolderItemList which provides the outer transaction.
	 * @param folderInfo
	 */
	async syncFolderInfo(folderInfo: RssFolderItem) {
		if (!(await this.checkFolderExist(folderInfo.folderName))) {
			const result = await this.insertFolderInfo(folderInfo.folderName);
			if (!result.success) {
				throw new Error(result.msg);
			}
		}
		const [folderData] = (
			await this.queryFolderByFolderName(folderInfo.folderName)
		).data;
		const folderId = folderData["id"] as number;
		for (const rssInfo of folderInfo.data) {
			if (!(await this.checkRssExist(rssInfo.id))) {
				const result = await this.insertRssInfo(
					rssInfo.id,
					folderId,
					rssInfo.title,
					rssInfo.htmlUrl,
					rssInfo.feedUrl,
					rssInfo.avatar ? rssInfo.avatar : "",
					rssInfo.lastUpdateTime ? rssInfo.lastUpdateTime : "",
				);
				if (!result.success) {
					throw new Error(result.msg);
				}
			}
			const [rssData] = (await this.queryRssByRssId(rssInfo.id)).data;
			const result = await this.updateRssInfo(
				rssData.rss_id,
				folderId,
				rssInfo.title,
				rssInfo.htmlUrl,
				rssInfo.feedUrl,
				rssInfo.avatar ? rssInfo.avatar : "",
				rssInfo.lastUpdateTime ? rssInfo.lastUpdateTime : "",
			);
			if (!result.success) {
				throw new Error(result.msg);
			}
		}
	}

	async dumpFolderItemList(folderInfoList: RssFolderItem[]): Promise<ErrorMsg> {
		// Wrap the entire dump in a transaction for atomicity
		await this.dbHelper.transaction(async () => {
			for (const folderItem of folderInfoList) {
				// Note: syncFolderInfo already wraps its own work in a transaction.
				// When called within this outer transaction, SQLite creates a savepoint
				// automatically for the inner BEGIN, so this is safe.
				await this.syncFolderInfo(folderItem);
			}
			// 开始清理多余的folder和rss
			const allFolderInfo = (await this.queryFolderByFolderName()).data;
			const folderNameList = folderInfoList.map((item) => item.folderName);
			for (const folderInfo of allFolderInfo) {
				if (!folderNameList.includes(folderInfo.name)) {
					// folder关联的rss信息也要一起删除
					await this.deleteRssInfoByFolderName(folderInfo.name);
					// 不存在的folder要从db中删除
					await this.deleteFolderInfo(folderInfo.name);
				}
			}
		});
		return {
			success: true,
			msg: "",
		};
	}

	async loadFolderItemList(): Promise<ErrorData<RssFolderItem[]>> {
		const timestamp = new Date().toISOString();
		console.log(
			`[${timestamp}] [sqlite.ts] SqliteUtil.loadFolderItemList called`,
		);

		try {
			// 使用新的dbHelper查询数据
			console.log(
				`[${timestamp}] [sqlite.ts] Querying folders from database...`,
			);
			const folderData = await this.dbHelper.all<any>(
				"SELECT * FROM folder_info ORDER BY name",
			);
			console.log(
				`[${timestamp}] [sqlite.ts] Folder query result:`,
				folderData,
			);

			console.log(
				`[${timestamp}] [sqlite.ts] Querying RSS sources from database...`,
			);
			const rssData = await this.dbHelper.all<any>("SELECT * FROM rss_info");
			console.log(`[${timestamp}] [sqlite.ts] RSS query result:`, rssData);

			// Query unread counts for all feeds
			const unreadResult = await this.getUnreadCounts();
			const unreadMap = new Map<string, number>();
			if (unreadResult.success) {
				for (const row of unreadResult.data) {
					unreadMap.set(row.rss_id, row.unread_count);
				}
			}

			console.log(`[${timestamp}] [sqlite.ts] Processing data...`);
			const folderInfoList: RssFolderItem[] = [];

			for (const item of folderData) {
				const folderName = item.name;
				const folderId = item.id;
				const folderInfo: RssFolderItem = {
					folderName,
					data: [],
					children: [],
				};

				for (const item1 of rssData) {
					const rssId = item1.rss_id;
					const rssFolderId = item1.folder_id;
					if (rssFolderId === folderId) {
						folderInfo.data.push({
							id: rssId,
							title: item1.title,
							unread: unreadMap.get(rssId) || 0,
							htmlUrl: item1.html_url,
							feedUrl: item1.feed_url,
							avatar: item1.avatar,
							lastUpdateTime: item1.update_time,
						});
					}
				}

				folderInfoList.push(folderInfo);
			}

			console.log(
				`[${timestamp}] [sqlite.ts] loadFolderItemList completed, returning ${folderInfoList.length} folders`,
			);

			return {
				success: true,
				msg: "",
				data: folderInfoList,
			};
		} catch (error) {
			console.error(
				`[${timestamp}] [sqlite.ts] loadFolderItemList ERROR:`,
				error,
			);
			console.error(
				`[${timestamp}] [sqlite.ts] Error stack:`,
				error instanceof Error ? error.stack : "No stack trace",
			);

			return {
				success: false,
				msg: error instanceof Error ? error.message : String(error),
				data: [],
			};
		}
	}

	async getRssInfoListFromDb(): Promise<
		Array<{ rss_id: string; title: string }>
	> {
		try {
			return await this.dbHelper.all<{ rss_id: string; title: string }>(
				"SELECT rss_id, title FROM rss_info ORDER BY title",
			);
		} catch (error) {
			console.error("getRssInfoListFromDb error:", error);
			return [];
		}
	}

	async checkPostInfoExist(guid: string): Promise<boolean> {
		try {
			const rows = await this.dbHelper.all<any>(
				"SELECT * FROM post_info WHERE guid = ?",
				[guid],
			);
			return rows.length > 0;
		} catch (err) {
			console.error("checkPostInfoExist error:", err);
			return false;
		}
	}

	async syncRssPostList(
		rssId: string,
		postInfoItemList: PostInfoItem[],
	): Promise<ErrorData<number>> {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [sqlite.ts] syncRssPostList called`);
		console.log(`[${timestamp}] [sqlite.ts] rssId:`, rssId);
		console.log(
			`[${timestamp}] [sqlite.ts] postInfoItemList count:`,
			postInfoItemList.length,
		);

		// Wrap in a transaction so all inserts are atomic and faster (single WAL write)
		return this.dbHelper.transaction(async () => {
			const rssInfoResult = await this.queryRssByRssId(rssId);
			if (!rssInfoResult.success) {
				throw new Error(rssInfoResult.msg);
			}

			console.log(
				`[${timestamp}] [sqlite.ts] Getting existing article guids...`,
			);
			// 获取现有文章的guid列表，用于增量更新判断
			const existingRows = await this.dbHelper.all<{ guid: string }>(
				`SELECT guid FROM post_info WHERE rss_id = ?`,
				[rssId],
			);
			const existingGuids = existingRows.map((row) => row.guid);
			console.log(
				`[${timestamp}] [sqlite.ts] Existing guids count:`,
				existingGuids.length,
			);

			// 使用Set提高查找效率
			const existingGuidSet = new Set(existingGuids);
			let newArticleCount = 0;
			console.log(
				`[${timestamp}] [sqlite.ts] Processing ${postInfoItemList.length} articles...`,
			);

			// 只插入新的文章（guid不存在于现有列表中）
			for (let i = 0; i < postInfoItemList.length; i++) {
				const item = postInfoItemList[i];
				// 检查是否已存在相同guid的文章
				if (!existingGuidSet.has(item.guid)) {
					console.log(
						`[${timestamp}] [sqlite.ts] Inserting new article: ${item.title}`,
					);
					const result = await this.insertPostInfo(
						rssId,
						item.title,
						item.author,
						item.link,
						item.desc,
						item.guid,
						item.updateTime,
					);
					if (!result.success) {
						console.error(
							`[${timestamp}] [sqlite.ts] Insert failed: ${result.msg}`,
						);
						// 继续处理其他文章，不中断整个同步过程
						continue;
					}
					newArticleCount++;
				} else {
					console.log(
						`[${timestamp}] [sqlite.ts] Article already exists, skipping: ${item.title}`,
					);
				}
			}

			console.log(
				`[${timestamp}] [sqlite.ts] Sync completed: RSS源 ${rssId} 添加了 ${newArticleCount} 篇新文章`,
			);
			return {
				success: true,
				msg: "",
				data: newArticleCount,
			};
		});
	}

	/**
	 * 全文搜索文章
	 * @param query 搜索关键词
	 * @param options 搜索选项
	 */
	/**
	 * Toggle read/unread status for a post by guid
	 * @param guid - post GUID
	 * @param read - new read status (true = read, false = unread)
	 */
	async togglePostReadStatus(guid: string, read: boolean): Promise<ErrorMsg> {
		const timestamp = new Date().toISOString();
		console.log(
			`[${timestamp}] [sqlite.ts] togglePostReadStatus: guid=${guid}, read=${read}`,
		);

		try {
			const sql = `UPDATE post_info SET read = ? WHERE guid = ?`;
			await this.dbHelper.run(sql, [read ? 1 : 0, guid]);
			console.log(`[${timestamp}] [sqlite.ts] togglePostReadStatus successful`);
			return { success: true, msg: "" };
		} catch (err: any) {
			console.error(
				`[${timestamp}] [sqlite.ts] togglePostReadStatus failed:`,
				err,
			);
			return { success: false, msg: err.message };
		}
	}

	/**
	 * Get unread counts per RSS feed
	 * @param rssId - optional RSS ID filter
	 */
	async getUnreadCounts(
		rssId?: string,
	): Promise<ErrorData<Array<{ rss_id: string; unread_count: number }>>> {
		const timestamp = new Date().toISOString();
		console.log(
			`[${timestamp}] [sqlite.ts] getUnreadCounts: rssId=${rssId || "all"}`,
		);

		try {
			let sql: string;
			let params: string[] = [];

			if (rssId) {
				sql = `SELECT rss_id, COUNT(*) as unread_count FROM post_info WHERE read = 0 AND rss_id = ? GROUP BY rss_id`;
				params = [rssId];
			} else {
				sql = `SELECT rss_id, COUNT(*) as unread_count FROM post_info WHERE read = 0 GROUP BY rss_id`;
			}

			const rows = await this.dbHelper.all<{
				rss_id: string;
				unread_count: number;
			}>(sql, params);
			console.log(
				`[${timestamp}] [sqlite.ts] getUnreadCounts: ${rows.length} feeds with unread posts`,
			);
			return { success: true, msg: "", data: rows };
		} catch (err: any) {
			console.error(`[${timestamp}] [sqlite.ts] getUnreadCounts failed:`, err);
			return { success: false, msg: err.message, data: [] };
		}
	}

	/**
	 * Mark all posts as read for a feed or folder
	 * @param rssId - optional RSS feed ID
	 * @param folderName - optional folder name
	 */
	async markAllPostsAsRead(
		rssId?: string,
		folderName?: string,
	): Promise<ErrorMsg> {
		const timestamp = new Date().toISOString();
		console.log(
			`[${timestamp}] [sqlite.ts] markAllPostsAsRead: rssId=${rssId}, folderName=${folderName}`,
		);

		try {
			if (rssId) {
				await this.dbHelper.run(
					`UPDATE post_info SET read = 1 WHERE rss_id = ?`,
					[rssId],
				);
			} else if (folderName) {
				await this.dbHelper.run(
					`UPDATE post_info SET read = 1 WHERE rss_id IN (SELECT rss_id FROM rss_info WHERE folder_id = (SELECT id FROM folder_info WHERE name = ?))`,
					[folderName],
				);
			} else {
				await this.dbHelper.run(`UPDATE post_info SET read = 1`, []);
			}

			console.log(`[${timestamp}] [sqlite.ts] markAllPostsAsRead successful`);
			return { success: true, msg: "" };
		} catch (err: any) {
			console.error(
				`[${timestamp}] [sqlite.ts] markAllPostsAsRead failed:`,
				err,
			);
			return { success: false, msg: err.message };
		}
	}

	/**
	 * Get aggregated statistics from the database using efficient COUNT queries.
	 * This replaces the old in-memory approach that fetched 10,000 articles.
	 */
	async getAggregatedStats(): Promise<{
		totalArticles: number;
		unreadCount: number;
		favoriteCount: number;
		feedCount: number;
		folderCount: number;
	}> {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [sqlite.ts] getAggregatedStats called`);

		try {
			const [totalRow, unreadRow, favRow, feedCountRow, folderCountRow] =
				await Promise.all([
					this.dbHelper.get<any>("SELECT COUNT(*) as count FROM post_info"),
					this.dbHelper.get<any>(
						"SELECT COUNT(*) as count FROM post_info WHERE read = 0",
					),
					this.dbHelper.get<any>(
						"SELECT COUNT(*) as count FROM post_info WHERE favorite = 1",
					),
					this.dbHelper.get<any>(
						"SELECT COUNT(DISTINCT rss_id) as count FROM post_info",
					),
					this.dbHelper.get<any>("SELECT COUNT(*) as count FROM folder_info"),
				]);

			const result = {
				totalArticles: totalRow?.count || 0,
				unreadCount: unreadRow?.count || 0,
				favoriteCount: favRow?.count || 0,
				feedCount: feedCountRow?.count || 0,
				folderCount: folderCountRow?.count || 0,
			};

			console.log(
				`[${timestamp}] [sqlite.ts] getAggregatedStats result:`,
				result,
			);
			return result;
		} catch (error) {
			console.error(
				`[${timestamp}] [sqlite.ts] getAggregatedStats ERROR:`,
				error,
			);
			throw error;
		}
	}

	async searchPosts(
		query: string,
		options?: {
			folderId?: string;
			dateFrom?: string;
			dateTo?: string;
			limit?: number;
		},
	): Promise<ErrorData<PostIndexItem[]>> {
		const timestamp = new Date().toISOString();
		console.log(
			`[${timestamp}] [sqlite.ts] searchPosts called with query:`,
			query,
		);

		try {
			const trimmed = (query || "").trim();
			// Empty query must NOT hit FTS MATCH — FTS5 throws: syntax error near ""
			if (!trimmed) {
				return { success: true, msg: "", data: [] };
			}

			// 检查并创建FTS表（如果不存在）
			await this.ensureFtsTable();

			const { folderId, dateFrom, dateTo, limit = 100 } = options || {};

			// 构建FTS查询
			let sql = `
        SELECT
          p.rowid,
          p.title,
          p.author,
          p.link,
          p.guid,
          p.rss_id,
          p.content,
          p.update_time,
          p.read,
          r.title as rss_title,
          r.avatar as rss_avatar,
          f.name as folder_name,
          f.id as folder_id
        FROM post_info_fts fts
        JOIN post_info p ON fts.rowid = p.id
        JOIN rss_info r ON p.rss_id = r.rss_id
        JOIN folder_info f ON r.folder_id = f.id
        WHERE post_info_fts MATCH ?
      `;
			const normalizedQuery = trimmed
				.split(/\s+/)
				.map((token) => token.replace(/["']/g, "").trim())
				.filter((token) => token.length > 0)
				.map((token) => `"${token}"`)
				.join(" AND ");

			if (!normalizedQuery) {
				return { success: true, msg: "", data: [] };
			}

			const params: any[] = [normalizedQuery];

			// 添加文件夹过滤
			if (folderId) {
				sql += ` AND r.folder_id = ?`;
				params.push(folderId);
			}

			// 添加日期过滤
			if (dateFrom) {
				sql += ` AND p.update_time >= ?`;
				params.push(dateFrom);
			}

			if (dateTo) {
				sql += ` AND p.update_time <= ?`;
				params.push(dateTo);
			}

			// 排序和限制
			sql += ` ORDER BY p.update_time DESC LIMIT ?`;
			params.push(limit);

			console.log(`[${timestamp}] [sqlite.ts] Executing search SQL:`, sql);
			console.log(`[${timestamp}] [sqlite.ts] Search params:`, params);

			let rows = await this.dbHelper.all<any>(sql, params);
			console.log(
				`[${timestamp}] [sqlite.ts] Search result count:`,
				rows.length,
			);

			if (rows.length === 0) {
				let fallbackSql = `
          SELECT
            p.rowid,
            p.title,
            p.author,
            p.link,
            p.guid,
            p.rss_id,
            p.content,
            p.update_time,
            p.read,
            r.title as rss_title,
            r.avatar as rss_avatar,
            f.name as folder_name,
            f.id as folder_id
          FROM post_info p
          JOIN rss_info r ON p.rss_id = r.rss_id
          JOIN folder_info f ON r.folder_id = f.id
          WHERE (p.title LIKE ? OR p.author LIKE ?)
        `;

				const fallbackParams: any[] = [`%${query}%`, `%${query}%`];

				if (folderId) {
					fallbackSql += ` AND r.folder_id = ?`;
					fallbackParams.push(folderId);
				}

				if (dateFrom) {
					fallbackSql += ` AND p.update_time >= ?`;
					fallbackParams.push(dateFrom);
				}

				if (dateTo) {
					fallbackSql += ` AND p.update_time <= ?`;
					fallbackParams.push(dateTo);
				}

				fallbackSql += ` ORDER BY p.update_time DESC LIMIT ?`;
				fallbackParams.push(limit);

				rows = await this.dbHelper.all<any>(fallbackSql, fallbackParams);
				console.log(
					`[${timestamp}] [sqlite.ts] Fallback search result count:`,
					rows.length,
				);
			}

			// 处理结果，转换格式
			const result: PostIndexItem[] = rows.map((row) => {
				let desc: string = parseBase64ToString(row.content);
				desc = beautyStr(extractTextFromHtml(desc), 100);
				return {
					title: row.title,
					guid: row.guid,
					link: row.link,
					author: row.author,
					updateTime: row.update_time,
					read: row.read === 1,
					desc,
					rssId: row.rss_id,
				};
			});

			console.log(
				`[${timestamp}] [sqlite.ts] searchPosts completed successfully`,
			);

			return {
				success: true,
				msg: "",
				data: result,
			};
		} catch (error) {
			console.error(`[${timestamp}] [sqlite.ts] searchPosts ERROR:`, error);
			console.error(
				`[${timestamp}] [sqlite.ts] Error stack:`,
				error instanceof Error ? error.stack : "No stack trace",
			);

			return {
				success: false,
				msg: error instanceof Error ? error.message : String(error),
				data: [],
			};
		}
	}
}
