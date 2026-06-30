import { ipcMain } from "electron";
import { getArticleService } from "../../infrastructure/di/Container";

/**
 * Standard IPC response envelope — must match electron-preload.ts IpcEnvelope.
 * { error: null, data: T } for success; { error: string, data: null } for errors.
 */
interface IpcEnvelope<T = unknown> {
	error: string | null;
	data: T | null;
}

function wrap<T>(fn: (...args: any[]) => Promise<T>) {
	return async (...args: any[]): Promise<IpcEnvelope<T>> => {
		try {
			const data = await fn(...args);
			return { error: null, data };
		} catch (e) {
			return {
				error: e instanceof Error ? e.message : String(e),
				data: null,
			};
		}
	};
}

export function registerArticleHandlers(): void {
	const service = getArticleService();

	ipcMain.handle(
		"article:getArticles",
		wrap((_event: unknown, filter?: unknown, offset?: number, limit?: number) =>
			service.getArticles(filter as any, offset ?? 0, limit ?? 50),
		),
	);

	ipcMain.handle(
		"article:getById",
		wrap((_event: unknown, id: string) => service.getArticle(id)),
	);

	ipcMain.handle(
		"article:toggleRead",
		wrap((_event: unknown, id: string) => service.toggleReadStatus(id)),
	);

	ipcMain.handle(
		"article:toggleFavorite",
		wrap((_event: unknown, id: string) => service.toggleFavorite(id)),
	);

	ipcMain.handle(
		"article:markAllRead",
		wrap((_event: unknown, feedId?: string, folderName?: string) =>
			service.markAllAsRead({ feedId, folderName }),
		),
	);

	ipcMain.handle(
		"article:search",
		wrap((_event: unknown, query: string) =>
			service.getArticles({ keyword: query }, 0, 100),
		),
	);

	ipcMain.handle(
		"article:getStats",
		wrap(() => service.getStats()),
	);
}
