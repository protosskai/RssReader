import { ipcMain } from "electron";
import { getArticleService } from "../../infrastructure/di/Container";

export function registerFeedHandlers(): void {
	const service = getArticleService();

	ipcMain.handle(
		"feed:add",
		async (_event, feedUrl: string, title?: string, folderName?: string) => {
			try {
				const feed = await service.addFeed(feedUrl, title, folderName);
				return { success: true, data: feed };
			} catch (e) {
				return {
					success: false,
					msg: e instanceof Error ? e.message : String(e),
				};
			}
		},
	);

	ipcMain.handle("feed:getAll", async (_event, folderName?: string) => {
		try {
			const feeds = await service.getFeeds(folderName);
			return { success: true, data: feeds };
		} catch (e) {
			return {
				success: false,
				msg: e instanceof Error ? e.message : String(e),
			};
		}
	});

	ipcMain.handle("feed:remove", async (_event, id: string) => {
		try {
			await service.removeFeed(id);
			return { success: true };
		} catch (e) {
			return {
				success: false,
				msg: e instanceof Error ? e.message : String(e),
			};
		}
	});

	ipcMain.handle("feed:sync", async (_event, id: string) => {
		try {
			await service.syncFeed(id);
			return { success: true };
		} catch (e) {
			return {
				success: false,
				msg: e instanceof Error ? e.message : String(e),
			};
		}
	});
}
