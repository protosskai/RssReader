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

export function registerFeedHandlers(): void {
	const service = getArticleService();

	ipcMain.handle(
		"feed:add",
		wrap((_event: unknown, feedUrl: string, title?: string, folderName?: string) =>
			service.addFeed(feedUrl, title, folderName),
		),
	);

	ipcMain.handle(
		"feed:getAll",
		wrap((_event: unknown, folderName?: string) => service.getFeeds(folderName)),
	);

	ipcMain.handle(
		"feed:remove",
		wrap((_event: unknown, id: string) => service.removeFeed(id)),
	);

	ipcMain.handle(
		"feed:sync",
		wrap((_event: unknown, id: string) => service.syncFeed(id)),
	);
}
