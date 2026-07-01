import {
	app,
	BrowserWindow,
	ipcMain,
	nativeTheme,
	shell,
	dialog,
} from "electron";
import path from "path";
import os from "os";
import fs from "fs";
import http from "http";
import { SqliteUtil } from "./infrastructure/persistence/sqlite";
import { getArticleService } from "./infrastructure/di/Container";
import { SyncManager } from "./services/SyncManager";
import type {
	RssInfoNew,
	RssFolderItem,
	RssInfoItem,
	PostIndexItem,
	Article,
} from "src/common/models";
import type { ContentInfo } from "src/common/models";
import {
	createSuccessResponse,
	createVoidSuccessResponse,
} from "src/common/ErrorMsg";
import { OpmlParserAdapter } from "./infrastructure/parsing/OpmlParserAdapter";

// ============================================================
// Global Error Handlers — prevent silent crashes
// ============================================================

process.on("unhandledRejection", (reason: unknown) => {
	const msg = reason instanceof Error ? reason.message : String(reason);
	console.error("[FATAL] Unhandled promise rejection:", msg);
	try {
		dialog.showErrorBox(
			"应用程序发生错误",
			`发生了一个未处理的错误：\n${msg}\n\n应用可能不稳定，建议重启。`,
		);
	} catch {
		// dialog may not be available during shutdown
	}
});

process.on("uncaughtException", (err: Error) => {
	console.error("[FATAL] Uncaught exception:", err.message, err.stack);
	try {
		dialog.showErrorBox(
			"应用程序崩溃",
			`发生了一个致命错误：\n${err.message}\n\n应用即将退出。`,
		);
	} catch {
		// ignore
	}
	// Give dialog time to show, then exit
	setTimeout(() => app.quit(), 1000);
});

/** Shorthand DB init — forwards to SqliteUtil singleton */
async function initDB(): Promise<void> {
	await SqliteUtil.getInstance().init();
}

// ============================================================
// IPC Security Layer — input validation, error wrapping,
// URL/folder sanitization, content size limits
// ============================================================

/** Max content bytes allowed through IPC (single article body) */
const MAX_CONTENT_BYTES = 10 * 1024 * 1024; // 10 MB

/** Max articles per page to prevent memory-exhaustion DoS */
const MAX_ARTICLES_PER_PAGE = 500;

/** Max search results returned in a single call */
const MAX_SEARCH_RESULTS = 200;

/** Max string parameter length (protection against buffer-bloat) */
const MAX_STRING_PARAM = 4096;
const MAX_ID_PARAM = 512;
const MAX_FOLDER_NAME = 256;
const MAX_QUERY_LENGTH = 1024;

/** Structured IPC response envelope */
interface IpcResponse<T = unknown> {
	error?: string;
	data?: T;
}

// ---- Validators ----

function isString(v: unknown): v is string {
	return typeof v === "string";
}

function validateString(
	value: unknown,
	label: string,
	maxLen = MAX_STRING_PARAM,
): asserts value is string {
	if (!isString(value)) {
		throw new Error(
			`INVALID_PARAM: ${label} must be a string, got ${typeof value}`,
		);
	}
	if (value.length === 0) {
		throw new Error(`INVALID_PARAM: ${label} must not be empty`);
	}
	if (value.length > maxLen) {
		throw new Error(
			`INVALID_PARAM: ${label} exceeds max length ${maxLen} (got ${value.length})`,
		);
	}
}

/** Validate a URL is http/https and structurally valid */
function validateUrl(url: unknown): asserts url is string {
	validateString(url, "url", MAX_STRING_PARAM);
	const raw = url as string;
	try {
		const parsed = new URL(raw);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			throw new Error(
				`INVALID_PARAM: URL protocol must be http or https, got ${parsed.protocol}`,
			);
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.startsWith("INVALID_PARAM:")) throw e;
		throw new Error(`INVALID_PARAM: malformed URL — ${msg}`);
	}
}

/** Validate folder name — no path traversal, no control chars */
function validateFolderName(name: unknown): asserts name is string {
	validateString(name, "folderName", MAX_FOLDER_NAME);
	const n = name as string;
	if (/[<>:"/\\|?*\x00-\x1f]/.test(n)) {
		throw new Error("INVALID_PARAM: folderName contains invalid characters");
	}
	if (n.includes("..")) {
		throw new Error(
			"INVALID_PARAM: folderName contains path traversal sequence (..)",
		);
	}
	// Reject names that are purely whitespace
	if (n.trim().length === 0) {
		throw new Error("INVALID_PARAM: folderName must not be whitespace-only");
	}
}

/** Validate a generic id — alphanumeric-safe, no traversal */
function validateId(id: unknown, label: string): asserts id is string {
	validateString(id, label, MAX_ID_PARAM);
	const n = id as string;
	if (/[<>:"/\\|?*\x00-\x1f]/.test(n)) {
		throw new Error(`INVALID_PARAM: ${label} contains invalid characters`);
	}
}

/** Wrap every IPC handler: catches errors → structured { error?, data? } */
function wrapHandler<T>(fn: (...args: unknown[]) => Promise<T> | T) {
	return async (
		_event: Electron.IpcMainInvokeEvent,
		...args: unknown[]
	): Promise<IpcResponse<T>> => {
		try {
			const data = await fn(...args);
			return { data };
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("[IPC ERROR]", msg);
			// Never leak stack traces over IPC
			return { error: msg };
		}
	};
}

/** Clamp the content field inside an object or ApiResponse wrapper to MAX_CONTENT_BYTES */
function clampContent<T>(obj: T): T {
	if (obj && typeof obj === "object") {
		const rec = obj as Record<string, unknown>;
		// Handle ApiResponse<{ content }> pattern: clamp data.content
		if ("data" in rec && rec.data && typeof rec.data === "object") {
			const inner = rec.data as Record<string, unknown>;
			if ("content" in inner && typeof inner.content === "string") {
				const c = inner.content as string;
				if (c.length > MAX_CONTENT_BYTES) {
					inner.content = c.slice(0, MAX_CONTENT_BYTES) + "…[truncated]";
				}
			}
		}
		// Handle direct { content } pattern
		if ("content" in rec && typeof rec.content === "string") {
			const c = rec.content as string;
			if (c.length > MAX_CONTENT_BYTES) {
				rec.content = c.slice(0, MAX_CONTENT_BYTES) + "…[truncated]";
			}
		}
	}
	return obj;
}

function clampSummary(summary: string): string {
	return summary.length > MAX_CONTENT_BYTES
		? summary.slice(0, MAX_CONTENT_BYTES) + "…[truncated]"
		: summary;
}

// ============================================================

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

// Initialize Article Service
const articleService = getArticleService();

// SyncManager instance — init() called in app.whenReady() after DB is ready
const syncManager = SyncManager.getInstance();

try {
	if (platform === "win32" && nativeTheme.shouldUseDarkColors) {
		require("fs").unlinkSync(
			path.join(app.getPath("userData"), "DevTools Extensions"),
		);
	}
} catch (_) {
	/* intentionally empty */
}

let mainWindow: BrowserWindow | undefined;

/**
 * Wait for dev server to be ready
 */
async function waitForDevServer(
	maxRetries = 30,
	retryDelay = 1000,
): Promise<void> {
	const appUrl = process.env.APP_URL || "http://localhost:9000";
	let serverUrl: URL;
	try {
		serverUrl = new URL(appUrl);
	} catch {
		console.error(`[electron-main] Invalid APP_URL: ${appUrl}`);
		throw new Error(`Invalid APP_URL: ${appUrl}`);
	}
	const hostname = serverUrl.hostname;
	const port =
		serverUrl.port || (serverUrl.protocol === "https:" ? "443" : "80");

	console.log(`[electron-main] Waiting for dev server at ${hostname}:${port}…`);

	for (let i = 0; i < maxRetries; i++) {
		try {
			await new Promise<void>((resolve, reject) => {
				const req = http.get(
					{ hostname, port, path: "/", timeout: 1000 },
					(res) => {
						if (res.statusCode && res.statusCode < 500) {
							resolve();
						} else {
							reject(new Error(`Server returned status ${res.statusCode}`));
						}
					},
				);
				req.on("error", reject);
				req.on("timeout", () => {
					req.destroy();
					reject(new Error("Request timeout"));
				});
				req.setTimeout(1000);
			});
			console.log(
				`[electron-main] Dev server is ready! (attempt ${i + 1}/${maxRetries})`,
			);
			return;
		} catch {
			console.log(
				`[electron-main] Waiting for dev server… (attempt ${i + 1}/${maxRetries})`,
			);
			if (i < maxRetries - 1) {
				await new Promise((r) => setTimeout(r, retryDelay));
			}
		}
	}

	throw new Error(`Dev server failed to start after ${maxRetries} attempts`);
}

function createWindow() {
	mainWindow = new BrowserWindow({
		icon: path.resolve(__dirname, "icons/icon.png"),
		width: 1280,
		height: 960,
		minWidth: 800,
		minHeight: 600,
		useContentSize: true,
		frame: false,
		resizable: true,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD),
		},
	});

	const appUrl = process.env.APP_URL;
	const isProduction = process.env.NODE_ENV === "production";
	console.log(
		`[electron-main] Loading URL: ${appUrl} (production: ${isProduction})`,
	);
	// Set Content-Security-Policy header
	mainWindow.webContents.session.webRequest.onHeadersReceived(
		(details, callback) => {
			callback({
				responseHeaders: {
					...details.responseHeaders,
					"Content-Security-Policy": [
						"default-src 'self'; " +
							"script-src 'self'; " +
							"img-src 'self' https: data:; " +
							"style-src 'self' 'unsafe-inline'",
					],
				},
			});
		},
	);

	if (isProduction) {
		// Production: load the bundled index.html directly (no dev server)
		const indexPath = path.join(__dirname, "index.html");
		console.log(`[electron-main] Production mode: loading file ${indexPath}`);
		mainWindow.loadFile(indexPath);
	} else {
		// Dev: load from Vite dev server
		mainWindow.loadURL(appUrl);
	}

	// Dev: only open DevTools when NODE_ENV is NOT production
	// This ensures DevTools are never exposed to end users in production builds
	if (process.env.NODE_ENV !== "production") {
		mainWindow.webContents.openDevTools();
	}

	mainWindow.on("closed", () => {
		mainWindow = undefined;
	});

	// Block in-window navigation — open external links in default browser
	mainWindow.webContents.on("will-navigate", (e, url) => {
		e.preventDefault();
		// Only allow same-origin internal navigation
		try {
			const dest = new URL(url);
			const src = new URL(appUrl);
			if (dest.origin !== src.origin) {
				shell.openExternal(url);
			}
		} catch {
			shell.openExternal(url);
		}
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
}

// ============================================================
// IPC Handler Registration
// ============================================================

app.whenReady().then(async () => {
	// ---- Database init ----
	try {
		console.log("[electron-main] Initializing database…");
		await initDB();
		console.log("[electron-main] Database initialized successfully");

		// Initialize SyncManager (load saved config from disk, now safe after DB init)
		syncManager.init();
		// 3 秒后后台静默同步，不阻塞窗口创建
		setTimeout(() => syncManager.startAutoSync(), 3000);
	} catch (error) {
		console.error("[electron-main] Failed to initialize database:", error);
		throw error;
	}

	// ==================== Legacy RSS Handlers ====================

	ipcMain.handle(
		"rss:addRssSubscription",
		wrapHandler(async (obj: unknown) => {
			if (
				!obj ||
				typeof obj !== "object" ||
				!(obj as Record<string, unknown>).feedUrl
			) {
				throw new Error("INVALID_PARAM: expected object with feedUrl property");
			}
			const o = obj as Record<string, unknown>;
			validateUrl(o.feedUrl);
			if (o.title !== undefined && o.title !== null) {
				validateString(o.title, "title", 256);
			}
			if (o.folderName !== undefined && o.folderName !== null) {
				validateFolderName(o.folderName);
			}
			const payload = obj as RssInfoNew;
			await articleService.addFeed(
				payload.feedUrl,
				payload.title,
				payload.folderName,
			);
			return createVoidSuccessResponse();
		}),
	);

	ipcMain.handle(
		"rss:removeRssSubscription",
		wrapHandler(async (folderName: unknown, rssUrl: unknown) => {
			validateFolderName(folderName);
			validateUrl(rssUrl);
			const feeds = await articleService.getFeeds(folderName as string);
			const feed = feeds.find((f) => f.url === rssUrl);
			if (!feed) throw new Error("Subscription not found: " + rssUrl);
			await articleService.removeFeed(feed.id);
			return createVoidSuccessResponse();
		}),
	);

	ipcMain.handle(
		"rss:queryPostContentByGuid",
		wrapHandler(async (postId: unknown) => {
			validateId(postId, "guid");
			console.log(
				"[electron-main] rss:queryPostContentByGuid called with guid:",
				postId,
			);

			const article = await articleService.getArticle(postId as string);
			if (!article) throw new Error("Article not found: " + postId);

			const feed = article.feedId
				? await articleService.getFeed(article.feedId)
				: null;

			const contentInfo: ContentInfo = {
				title: article.title,
				content: article.content,
				link: article.link,
				author: article.author || feed?.title || "",
				updateTime:
					article.updateTime instanceof Date
						? article.updateTime.toISOString()
						: String(article.updateTime || ""),
				rssId: article.feedId,
				read: article.read ? 1 : 0,
				favorite: article.favorite ? 1 : 0,
				rssSource: {
					rssId: article.feedId,
					url: feed?.url || "",
					name: feed?.title || article.feedTitle || "",
					folder: article.folderName || feed?.folderName || "",
					avatar: feed?.avatar || article.avatar || "",
					htmlUrl: feed?.htmlUrl || "",
				},
			};
			return clampContent(createSuccessResponse(contentInfo));
		}),
	);

	ipcMain.handle(
		"rss:importOpmlFile",
		wrapHandler(async () => {
			const dialogResult = await dialog.showOpenDialog({
				properties: ["openFile"],
			});
			if (!dialogResult.canceled && dialogResult.filePaths.length > 0) {
				const filePath = dialogResult.filePaths[0];
				const parser = new OpmlParserAdapter();
				const outlines = await parser.parse(
					await fs.promises.readFile(filePath, "utf-8"),
				);

				for (const outline of outlines) {
					if (outline.type === "rss" && outline.xmlUrl) {
						await articleService.addFeed(
							outline.xmlUrl,
							outline.title || outline.text,
						);
					} else if (outline.type === "folder") {
						const folderName = outline.title || outline.text;
						if (folderName) {
							try {
								await articleService.addFolder(folderName);
							} catch {
								// folder may already exist
							}
						}
						if (outline.children) {
							for (const child of outline.children) {
								if (child.type === "rss" && child.xmlUrl) {
									await articleService.addFeed(
										child.xmlUrl,
										child.title || child.text,
										folderName,
									);
								}
							}
						}
					}
				}
			}
			return createVoidSuccessResponse();
		}),
	);

	ipcMain.handle(
		"openLink",
		wrapHandler(async (url: unknown) => {
			validateUrl(url);
			await shell.openExternal(url as string);
			return undefined;
		}),
	);

	ipcMain.handle("close", () => {
		BrowserWindow.getFocusedWindow()?.close();
	});

	ipcMain.handle("minimize", () => {
		BrowserWindow.getFocusedWindow()?.minimize();
	});

	ipcMain.handle(
		"addFolder",
		wrapHandler(async (folderName: unknown) => {
			validateFolderName(folderName);
			await articleService.addFolder(folderName as string);
			return createVoidSuccessResponse();
		}),
	);

	ipcMain.handle(
		"editFolder",
		wrapHandler(async (oldFolderName: unknown, newFolderName: unknown) => {
			validateFolderName(oldFolderName);
			validateFolderName(newFolderName);
			await articleService.renameFolder(
				oldFolderName as string,
				newFolderName as string,
			);
			return createVoidSuccessResponse();
		}),
	);

	ipcMain.handle(
		"removeFolder",
		wrapHandler(async (folderName: unknown) => {
			validateFolderName(folderName);
			await articleService.removeFolder(folderName as string);
			return createVoidSuccessResponse();
		}),
	);

	/** @deprecated Domain layer handles persistence transparently — kept for IPC compat */
	ipcMain.handle(
		"rss:dumpFolderToDb",
		wrapHandler(async (_folderInfoListJson: unknown) => {
			return createVoidSuccessResponse();
		}),
	);

	/** @deprecated Domain layer handles persistence transparently — kept for IPC compat */
	ipcMain.handle(
		"rss:loadFolderFromDb",
		wrapHandler(async () => {
			const folders = await articleService.getFolders();
			return createSuccessResponse(JSON.stringify(folders));
		}),
	);

	ipcMain.handle(
		"rss:getRssInfoListFromDb",
		wrapHandler(async () => {
			const t = new Date().toISOString();
			console.log(
				"[" + t + "] [electron-main] rss:getRssInfoListFromDb called",
			);

			const folders = await articleService.getFolders();
			const result: RssFolderItem[] = [];

			for (const folder of folders) {
				const feeds = await articleService.getFeeds(folder.name);
				const rssInfoList: RssInfoItem[] = feeds.map((feed) => ({
					id: feed.id,
					title: feed.title,
					unread: feed.unreadCount,
					htmlUrl: feed.htmlUrl,
					feedUrl: feed.url,
					avatar: feed.avatar || "",
					lastUpdateTime: feed.lastUpdateTime
						? feed.lastUpdateTime instanceof Date
							? feed.lastUpdateTime.toISOString()
							: String(feed.lastUpdateTime)
						: undefined,
					etag: undefined,
					lastModified: undefined,
				}));

				result.push({
					folderName: folder.name,
					data: rssInfoList,
					children: [],
				});
			}

			console.log(
				"[" + t + "] [electron-main] rss:getRssInfoListFromDb SUCCESS",
			);
			return createSuccessResponse(result);
		}),
	);

	ipcMain.handle(
		"rss:queryPostIndexByRssId",
		wrapHandler(async (rssId: unknown) => {
			validateId(rssId, "rssId");
			const t = new Date().toISOString();
			console.log(
				"[" + t + "] [electron-main] rss:queryPostIndexByRssId called, rssId:",
				rssId,
			);

			const articlesResult = await articleService.getArticles(
				{ feedId: rssId as string },
				0,
				500,
			);

			const posts: PostIndexItem[] = articlesResult.articles.map((article) => ({
				title: article.title,
				guid: article.id,
				link: article.link,
				author: article.author || "",
				updateTime:
					article.updateTime instanceof Date
						? article.updateTime.toISOString()
						: String(article.updateTime || ""),
				read: article.read,
				desc: article.description || article.content || "",
				rssId: article.feedId,
			}));

			console.log(
				"[" + t + "] [electron-main] rss:queryPostIndexByRssId SUCCESS",
			);
			return createSuccessResponse(posts);
		}),
	);

	ipcMain.handle(
		"rss:fetchRssIndexList",
		wrapHandler(async (rssId: unknown) => {
			validateId(rssId, "rssId");
			const t = new Date().toISOString();
			console.log(
				"[" + t + "] [electron-main] rss:fetchRssIndexList called, rssId:",
				rssId,
			);

			await articleService.syncFeed(rssId as string);

			console.log("[" + t + "] [electron-main] fetchRssIndexList SUCCESS");
			return createSuccessResponse({ success: true, msg: "" });
		}),
	);

	// ==================== Article Handlers ====================

	ipcMain.handle(
		"article:getArticles",
		wrapHandler(async (params: unknown) => {
			const p =
				params && typeof params === "object"
					? (params as Record<string, unknown>)
					: {};
			const filter = (
				p.filter && typeof p.filter === "object" ? p.filter : {}
			) as Record<string, unknown>;
			// Sanitize keyword
			if (typeof filter.keyword === "string") {
				if (filter.keyword.length > MAX_QUERY_LENGTH) {
					throw new Error(
						`INVALID_PARAM: filter.keyword exceeds max length ${MAX_QUERY_LENGTH}`,
					);
				}
			}
			const offset =
				typeof p.offset === "number" &&
				Number.isFinite(p.offset) &&
				p.offset >= 0
					? p.offset
					: 0;
			const limit =
				typeof p.limit === "number" && Number.isFinite(p.limit) && p.limit > 0
					? Math.min(p.limit, MAX_ARTICLES_PER_PAGE)
					: 50;
			return await articleService.getArticles(filter, offset, limit);
		}),
	);

	ipcMain.handle(
		"article:getArticle",
		wrapHandler(async (id: unknown) => {
			validateId(id, "id");
			const result = await articleService.getArticle(id);
			if (result) {
				return clampContent(result);
			}
			return result;
		}),
	);

	ipcMain.handle(
		"article:toggleReadStatus",
		wrapHandler(async (id: unknown) => {
			validateId(id, "id");
			await articleService.toggleReadStatus(id);
			return undefined;
		}),
	);

	ipcMain.handle(
		"article:toggleFavorite",
		wrapHandler(async (id: unknown) => {
			validateId(id, "id");
			return await articleService.toggleFavorite(id);
		}),
	);

	ipcMain.handle(
		"article:markAllAsRead",
		wrapHandler(async (params: unknown) => {
			const p =
				params && typeof params === "object"
					? (params as Record<string, unknown>)
					: {};
			if (p.feedId !== undefined && p.feedId !== null) {
				validateId(p.feedId, "feedId");
			}
			if (p.folderName !== undefined && p.folderName !== null) {
				validateFolderName(p.folderName);
			}
			await articleService.markAllAsRead(p);
			return undefined;
		}),
	);

	ipcMain.handle(
		"article:clearAllFavorites",
		wrapHandler(async () => {
			await articleService.clearAllFavorites();
			return undefined;
		}),
	);

	ipcMain.handle(
		"article:getStats",
		wrapHandler(() => articleService.getStats()),
	);

	// ==================== Feed Handlers ====================

	ipcMain.handle(
		"feed:getFeeds",
		wrapHandler(async (folderName: unknown) => {
			if (folderName !== undefined && folderName !== null) {
				validateFolderName(folderName);
			}
			return await articleService.getFeeds(folderName as string | undefined);
		}),
	);

	ipcMain.handle(
		"feed:getFeed",
		wrapHandler(async (id: unknown) => {
			validateId(id, "id");
			return await articleService.getFeed(id);
		}),
	);

	ipcMain.handle(
		"feed:addFeed",
		wrapHandler(async (payload: unknown) => {
			if (!payload || typeof payload !== "object") {
				throw new Error(
					"INVALID_PARAM: expected object { feedUrl, title?, folderName? }",
				);
			}
			const p = payload as Record<string, unknown>;
			validateUrl(p.feedUrl);
			if (p.title !== undefined && p.title !== null) {
				validateString(p.title, "title", 256);
			}
			if (p.folderName !== undefined && p.folderName !== null) {
				validateFolderName(p.folderName);
			}
			await articleService.addFeed(
				p.feedUrl as string,
				p.title as string | undefined,
				p.folderName as string | undefined,
			);
			return undefined;
		}),
	);

	ipcMain.handle(
		"feed:removeFeed",
		wrapHandler(async (id: unknown) => {
			validateId(id, "id");
			await articleService.removeFeed(id);
			return undefined;
		}),
	);

	ipcMain.handle(
		"feed:syncFeed",
		wrapHandler(async (id: unknown) => {
			validateId(id, "id");
			await articleService.syncFeed(id);
			return undefined;
		}),
	);

	// ==================== Folder Handlers (v2) ====================

	ipcMain.handle(
		"folder:getFolders",
		wrapHandler(() => articleService.getFolders()),
	);

	ipcMain.handle(
		"folder:getFolder",
		wrapHandler(async (name: unknown) => {
			validateFolderName(name);
			return await articleService.getFolder(name);
		}),
	);

	ipcMain.handle(
		"folder:addFolder",
		wrapHandler(async (name: unknown) => {
			validateFolderName(name);
			await articleService.addFolder(name);
			return undefined;
		}),
	);

	ipcMain.handle(
		"folder:removeFolder",
		wrapHandler(async (name: unknown) => {
			validateFolderName(name);
			await articleService.removeFolder(name);
			return undefined;
		}),
	);

	ipcMain.handle(
		"folder:renameFolder",
		wrapHandler(async (oldName: unknown, newName: unknown) => {
			validateFolderName(oldName);
			validateFolderName(newName);
			await articleService.renameFolder(oldName, newName);
			return undefined;
		}),
	);

	// ==================== Legacy Favorite Handlers ====================

	ipcMain.handle(
		"article:getFavoritePosts",
		wrapHandler(async () => {
			const result = await articleService.getArticles(
				{ favorite: true },
				0,
				MAX_ARTICLES_PER_PAGE,
			);
			return result.articles;
		}),
	);

	ipcMain.handle(
		"article:addFavoritePost",
		wrapHandler(async (post: unknown) => {
			if (!post || typeof post !== "object") {
				throw new Error("INVALID_PARAM: expected PostIndexItem object");
			}
			const p = post as Record<string, unknown>;
			const id = (p.guid ?? p.id) as unknown;
			validateId(id, "guid");
			// Convert PostIndexItem to Article and toggle favorite
			const desc = typeof p.desc === "string" ? p.desc : "";
			const dateStr = p.updateTime ? String(p.updateTime) : "";
			const article: Article = {
				id: String(id),
				guid: String(id),
				title: typeof p.title === "string" ? p.title : "",
				content: typeof p.content === "string" ? clampSummary(p.content) : "",
				description: desc,
				summary: desc,
				link: typeof p.link === "string" ? p.link : "",
				author: typeof p.author === "string" ? p.author : "",
				pubDate: dateStr,
				publishDate: dateStr ? new Date(dateStr) : new Date(),
				updateTime: dateStr ? new Date(dateStr) : new Date(),
				read: Boolean(p.read),
				favorite: true,
				feedId: (p.rssId as string) || "",
				feedTitle: "",
				feedUrl: "",
				folderName: "",
			};
			return await articleService.toggleFavorite(article.id);
		}),
	);

	ipcMain.handle(
		"article:removeFavoritePost",
		wrapHandler(async (guid: unknown) => {
			validateId(guid, "guid");
			return await articleService.toggleFavorite(guid);
		}),
	);

	ipcMain.handle(
		"article:isPostFavorite",
		wrapHandler(async (guid: unknown) => {
			validateId(guid, "guid");
			const article = await articleService.getArticle(guid);
			return article?.favorite || false;
		}),
	);

	// ==================== Sync Handlers ====================

	ipcMain.handle(
		"sync:getConfig",
		wrapHandler(() => syncManager.getConfig()),
	);

	ipcMain.handle(
		"sync:updateConfig",
		wrapHandler(async (config: unknown) => {
			if (!config || typeof config !== "object") {
				throw new Error("INVALID_PARAM: config must be an object");
			}
			syncManager.updateConfig(config);
			return { success: true };
		}),
	);

	ipcMain.handle(
		"sync:start",
		wrapHandler(async () => {
			const stats = await syncManager.syncAll();
			return { success: true, stats };
		}),
	);

	ipcMain.handle(
		"sync:getStatus",
		wrapHandler(() => syncManager.getStatus()),
	);

	ipcMain.handle(
		"sync:startAuto",
		wrapHandler(async () => {
			syncManager.startAutoSync();
			return { success: true };
		}),
	);

	ipcMain.handle(
		"sync:stopAuto",
		wrapHandler(async () => {
			syncManager.stopAutoSync();
			return { success: true };
		}),
	);

	// ==================== Search Handlers ====================

	ipcMain.handle(
		"search:searchPosts",
		wrapHandler(async (query: unknown, options: unknown) => {
			validateString(query, "query", MAX_QUERY_LENGTH);
			const opts =
				options && typeof options === "object"
					? (options as Record<string, unknown>)
					: {};
			// Sanitize search options
			if (opts.folderId !== undefined && opts.folderId !== null) {
				validateId(opts.folderId, "folderId");
			}
			const limit =
				typeof opts.limit === "number"
					? Math.min(opts.limit, MAX_SEARCH_RESULTS)
					: MAX_SEARCH_RESULTS;

			const searchResult = await articleService.getArticles(
				{ keyword: query as string },
				0,
				limit,
			);

			const posts: PostIndexItem[] = searchResult.articles.map((article) => ({
				title: article.title,
				guid: article.id,
				link: article.link,
				author: article.author || "",
				updateTime:
					article.updateTime instanceof Date
						? article.updateTime.toISOString()
						: String(article.updateTime || ""),
				read: article.read,
				desc: article.description || article.content || "",
				rssId: article.feedId,
			}));

			return createSuccessResponse(posts);
		}),
	);

	// ---- Window creation (after all handlers registered) ----
	console.log(
		"[electron-main] All IPC handlers registered, waiting for dev server…",
	);

	// Dev mode: wait for Vite dev server to be ready
	// Production: skip — we load index.html directly via loadFile
	if (process.env.NODE_ENV !== "production") {
		try {
			await waitForDevServer();
			console.log("[electron-main] Dev server is ready, creating window…");
		} catch (error) {
			console.error("[electron-main] Failed to wait for dev server:", error);
			console.error(
				"[electron-main] Please check if dev server is running on the correct port",
			);
			console.error("[electron-main] App will not start without dev server");
			app.quit();
			return;
		}
	} else {
		console.log("[electron-main] Production mode: skipping dev server wait");
	}

	createWindow();
});

app.on("window-all-closed", () => {
	if (platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (mainWindow === undefined) {
		createWindow();
	}
});
