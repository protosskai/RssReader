import { ipcMain } from "electron";
import { getArticleService } from "../../infrastructure/di/Container";

export function registerArticleHandlers(): void {
	const service = getArticleService();

	ipcMain.handle(
		"article:getArticles",
		async (_event, filter?: unknown, offset?: number, limit?: number) => {
			try {
				const result = await service.getArticles(
					filter as any,
					offset ?? 0,
					limit ?? 50,
				);
				return { success: true, data: result };
			} catch (e) {
				return {
					success: false,
					msg: e instanceof Error ? e.message : String(e),
				};
			}
		},
	);

	ipcMain.handle("article:getById", async (_event, id: string) => {
		try {
			const article = await service.getArticle(id);
			return { success: true, data: article };
		} catch (e) {
			return {
				success: false,
				msg: e instanceof Error ? e.message : String(e),
			};
		}
	});

	ipcMain.handle("article:toggleRead", async (_event, id: string) => {
		try {
			await service.toggleReadStatus(id);
			return { success: true };
		} catch (e) {
			return {
				success: false,
				msg: e instanceof Error ? e.message : String(e),
			};
		}
	});

	ipcMain.handle("article:toggleFavorite", async (_event, id: string) => {
		try {
			const state = await service.toggleFavorite(id);
			return { success: true, data: state };
		} catch (e) {
			return {
				success: false,
				msg: e instanceof Error ? e.message : String(e),
			};
		}
	});

	ipcMain.handle(
		"article:markAllRead",
		async (_event, feedId?: string, folderName?: string) => {
			try {
				await service.markAllAsRead({ feedId, folderName });
				return { success: true };
			} catch (e) {
				return {
					success: false,
					msg: e instanceof Error ? e.message : String(e),
				};
			}
		},
	);

	ipcMain.handle("article:search", async (_event, query: string) => {
		try {
			const result = await service.getArticles({ keyword: query }, 0, 100);
			return { success: true, data: result };
		} catch (e) {
			return {
				success: false,
				msg: e instanceof Error ? e.message : String(e),
			};
		}
	});

	ipcMain.handle("article:getStats", async () => {
		try {
			const stats = await service.getStats();
			return { success: true, data: stats };
		} catch (e) {
			return {
				success: false,
				msg: e instanceof Error ? e.message : String(e),
			};
		}
	});
}
