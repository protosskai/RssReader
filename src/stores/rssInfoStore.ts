import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Ref } from "vue";
import { type ApiResponse, unwrapOrThrow } from "src/common/ErrorMsg";
import type { RssFolderItem, RssInfoItem, RssInfoNew } from "src/common/models";
import { electronClient } from "src/services/electronClient";
import type { ArticleStats } from "src/common/models";

export const useRssInfoStore = defineStore("rssInfo", () => {
	const rssFolderList: Ref<RssFolderItem[]> = ref([]);
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	/** Aggregated article statistics fetched from DB via IPC */
	const aggregatedStats = ref<ArticleStats>({
		totalArticles: 0,
		unreadCount: 0,
		favoriteCount: 0,
		feedCount: 0,
		folderCount: 0,
	});

	const folderNameList = computed(() =>
		rssFolderList.value.map((item) => item.folderName),
	);

	/**
	 * Total article count from DB (via aggregated stats).
	 * Shows 0 while stats are loading.
	 */
	const totalArticleCount = computed(() => aggregatedStats.value.totalArticles);

	/**
	 * Unread article count computed from folder list data.
	 * The `unread` field on each feed item is populated by loadFolderItemList
	 * which queries unread counts from the DB.
	 */
	const unreadArticleCount = computed(() =>
		rssFolderList.value.reduce(
			(sum, folder) =>
				sum + folder.data.reduce((s, feed) => s + (feed.unread || 0), 0),
			0,
		),
	);

	/**
	 * Favorite article count from DB (via aggregated stats).
	 * More reliable than deriving from the favorite store which may not be initialized yet.
	 */
	const favoriteCount = computed(() => aggregatedStats.value.favoriteCount);

	/**
	 * Execute an API action that returns ApiResponse<T>, unwrap on success,
	 * then refresh the folder list from the backend.
	 */
	const executeAndRefresh = async <T>(
		action: () => Promise<ApiResponse<T>>,
		fallbackMessage = "RSS数据操作失败",
	): Promise<T> => {
		isLoading.value = true;
		error.value = null;
		try {
			const rawResult = await action();
			const result = unwrapOrThrow(rawResult);

			// Refresh folder list and aggregated stats in parallel
			const [folderRaw] = await Promise.all([
				electronClient.getRssInfoListFromDb(),
				loadAggregatedStats(),
			]);
			rssFolderList.value = unwrapOrThrow(folderRaw);

			return result;
		} catch (rawError) {
			const message =
				rawError instanceof Error ? rawError.message : fallbackMessage;
			error.value = message;
			throw new Error(message);
		} finally {
			isLoading.value = false;
		}
	};

	/**
	 * Load aggregated article stats from the DB via IPC.
	 * Uses `article:getStats` channel which runs efficient SQL COUNT queries.
	 */
	const loadAggregatedStats = async () => {
		try {
			const stats = await electronClient.getArticleStats();
			aggregatedStats.value = stats;
		} catch (rawError) {
			console.error("加载文章统计数据失败:", rawError);
			// In non-Electron (browser) mode, stats will remain 0 — caller handles error UI
			// Keep existing values on error; don't reset to 0 to avoid flicker
		}
	};

	const refresh = async () => {
		isLoading.value = true;
		error.value = null;
		try {
			// Fetch folder/RSS list and aggregated stats in parallel for efficiency
			const [folderRaw] = await Promise.all([
				electronClient.getRssInfoListFromDb(),
				loadAggregatedStats(),
			]);
			rssFolderList.value = unwrapOrThrow(folderRaw);
		} catch (rawError) {
			const message =
				rawError instanceof Error ? rawError.message : "加载RSS订阅列表失败";
			error.value = message;
			// Re-throw so calling code (e.g., HomePage.loadData) can show error UI
			throw new Error(message);
		} finally {
			isLoading.value = false;
		}
	};

	const syncAll = async () => {
		await refresh();
	};

	const addRssSubscription = async (
		feedUrl: string,
		title: string,
		folderName: string,
	) => {
		const payload: RssInfoNew = { feedUrl, title, folderName };
		await executeAndRefresh(
			() => electronClient.addRssSubscription(payload),
			"添加RSS订阅失败",
		);
	};

	const removeRssSubscription = async (
		folderName: string,
		rssInfoItem: RssInfoItem,
	) => {
		await executeAndRefresh(
			() =>
				electronClient.removeRssSubscription(folderName, rssInfoItem.feedUrl),
			"删除RSS订阅失败",
		);
	};

	const addFolder = async (folderName: string) => {
		await executeAndRefresh(
			() => electronClient.addFolder(folderName),
			"添加文件夹失败",
		);
	};

	const editFolder = async (oldFolderName: string, newFolderName: string) => {
		await executeAndRefresh(
			() => electronClient.editFolder(oldFolderName, newFolderName),
			"编辑文件夹失败",
		);
	};

	const removeFolder = async (folderName: string) => {
		await executeAndRefresh(
			() => electronClient.removeFolder(folderName),
			"删除文件夹失败",
		);
	};

	const importOpmlFile = async () => {
		await executeAndRefresh(
			() => electronClient.importOpmlFile(),
			"导入OPML文件失败",
		);
	};

	/**
	 * Edit an existing subscription.
	 * Backend has no dedicated "edit" channel — implement as remove + re-add
	 * when URL/folder/title change. Preserves posts only if feed URL is unchanged
	 * and the feed id remains (we re-add with same feedUrl so sync reuses GUID).
	 */
	const editRssSubscription = async (payload: {
		rssId: string;
		title: string;
		feedUrl: string;
		htmlUrl?: string;
		folderName: string;
		oldFolderName?: string;
	}) => {
		const oldFolder = payload.oldFolderName || payload.folderName;
		// Find old feedUrl from store
		let oldFeedUrl = payload.feedUrl;
		for (const folder of rssFolderList.value) {
			const found = folder.data.find((f) => f.id === payload.rssId);
			if (found) {
				oldFeedUrl = found.feedUrl;
				break;
			}
		}
		await executeAndRefresh(async () => {
			// Remove old then add with new metadata
			await electronClient.removeRssSubscription(oldFolder, oldFeedUrl);
			return electronClient.addRssSubscription({
				feedUrl: payload.feedUrl,
				title: payload.title,
				folderName: payload.folderName || "默认",
			});
		}, "编辑RSS订阅失败");
	};

	/**
	 * Nested folder move is not supported by the current backend schema
	 * (folders are flat). Surface a clear error instead of a silent no-op.
	 */
	const moveFolder = async (
		_folderName: string,
		_targetParent?: string,
	): Promise<{ success: boolean; msg?: string }> => {
		return {
			success: false,
			msg: "当前版本暂不支持嵌套移动文件夹，请使用「重命名」或重新创建",
		};
	};

	/** Explicit initialization — call from component onMounted. Safe to call multiple times. */
	const init = async () => {
		try {
			await refresh();
		} catch (e) {
			console.error("[rssInfoStore] init failed:", e);
			// error.value already set by refresh()'s catch block
		}
	};

	return {
		rssFolderList,
		isLoading,
		error,
		aggregatedStats,
		addRssSubscription,
		removeRssSubscription,
		editRssSubscription,
		moveFolder,
		folderNameList,
		addFolder,
		removeFolder,
		importOpmlFile,
		editFolder,
		refresh,
		init,
		syncAll,
		totalArticleCount,
		unreadArticleCount,
		favoriteCount,
		loadAggregatedStats,
	};
});
