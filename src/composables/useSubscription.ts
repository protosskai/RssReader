/**
 * useSubscription — 订阅管理（合并 rssInfoStore + feedStore + folderStore）
 *
 * 统一管理 RSS 订阅源、文件夹、文章统计。通过 electronClient
 * 调用 IPC 而不依赖 Pinia。
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type { RssFolderItem, RssInfoItem, RssInfoNew, FeedSource, Folder, ArticleStats } from 'src/common/models';
import { ApiResponse, unwrapOrThrow } from 'src/common/ErrorMsg';
import { electronClient } from 'src/services/electronClient';

export function useSubscription() {
  // ── State ────────────────────────────────────────────────
  const rssFolderList: Ref<RssFolderItem[]> = ref([]);
  const feeds: Ref<FeedSource[]> = ref([]);
  const folders: Ref<Folder[]> = ref([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const aggregatedStats = ref<ArticleStats>({
    totalArticles: 0, unreadCount: 0, favoriteCount: 0, feedCount: 0, folderCount: 0,
  });

  // ── Computed ─────────────────────────────────────────────
  const folderNameList: ComputedRef<string[]> = computed(
    () => rssFolderList.value.map((item) => item.folderName),
  );
  const folderNames: ComputedRef<string[]> = computed(
    () => [...new Set(feeds.value.map((f) => f.folderName))],
  );
  const totalArticleCount = computed(() => aggregatedStats.value.totalArticles);
  const unreadArticleCount = computed(() =>
    rssFolderList.value.reduce(
      (sum, folder) => sum + folder.data.reduce((s, feed) => s + (feed.unread || 0), 0),
      0,
    ),
  );
  const favoriteCount = computed(() => aggregatedStats.value.favoriteCount);
  const totalUnreadCount = computed(() => feeds.value.reduce((sum, f) => sum + f.unreadCount, 0));
  const feedsByFolder = computed(() =>
    feeds.value.reduce<Record<string, FeedSource[]>>((acc, feed) => {
      (acc[feed.folderName] ??= []).push(feed);
      return acc;
    }, {}),
  );

  // ── Internal helpers ─────────────────────────────────────

  const loadAggregatedStats = async () => {
    try {
      aggregatedStats.value = await electronClient.getArticleStats();
    } catch (rawError) {
      console.error('加载文章统计数据失败:', rawError);
    }
  };

  const refresh = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const [folderRaw] = await Promise.all([
        electronClient.getRssInfoListFromDb(),
        loadAggregatedStats(),
      ]);
      rssFolderList.value = unwrapOrThrow(folderRaw);
    } catch (rawError) {
      error.value = rawError instanceof Error ? rawError.message : '加载RSS订阅列表失败';
    } finally {
      isLoading.value = false;
    }
  };

  const loadFeeds = async (folder?: string) => {
    try {
      feeds.value = await electronClient.getFeeds(folder);
    } catch (rawError) {
      console.error('加载RSS源失败:', rawError);
    }
  };

  const loadFeedList = async () => {
    const [ps] = await Promise.all([refresh(), loadFeeds()]);
    void ps;
  };

  // ── Actions ──────────────────────────────────────────────

  // Feed
  const addFeed = async (feedUrl: string, title: string, folderName = '默认') => {
    await electronClient.addFeed(feedUrl, title, folderName);
    await loadFeedList();
  };

  const removeFeed = async (id: string) => {
    await electronClient.removeFeed(id);
    await loadFeedList();
  };

  const syncFeed = async (id: string) => {
    await electronClient.syncFeed(id);
    await loadFeedList();
  };

  // Legacy (RssInfoItem-based)
  const addRssSubscription = async (feedUrl: string, title: string, folderName: string) => {
    const payload: RssInfoNew = { feedUrl, title, folderName };
    await electronClient.addRssSubscription(payload);
    await loadFeedList();
  };

  const removeRssSubscription = async (folderName: string, item: RssInfoItem) => {
    await electronClient.removeRssSubscription(folderName, item.feedUrl);
    await loadFeedList();
  };

  // Folder (legacy)
  const addFolder = async (name: string) => {
    await electronClient.addFolder(name);
    await refresh();
  };

  const editFolder = async (oldName: string, newName: string) => {
    await electronClient.editFolder(oldName, newName);
    await refresh();
  };

  const removeFolder = async (name: string) => {
    await electronClient.removeFolder(name);
    await refresh();
  };

  // Folder (v2)
  const addFolderV2 = async (name: string) => {
    await electronClient.addFolderV2(name);
    await refresh();
  };

  const removeFolderV2 = async (name: string) => {
    await electronClient.removeFolderV2(name);
    await refresh();
  };

  const renameFolder = async (oldName: string, newName: string) => {
    await electronClient.renameFolder(oldName, newName);
    await refresh();
  };

  // OPML
  const importOpmlFile = async () => {
    await electronClient.importOpmlFile();
    await loadFeedList();
  };

  // Fetch legacy IDs
  const fetchRssIndexList = async (rssId: string) => {
    await electronClient.fetchRssIndexList(rssId);
  };

  // Init
  void loadFeedList();

  return {
    rssFolderList, feeds, folders, isLoading, error, aggregatedStats,
    folderNameList, folderNames, totalArticleCount, unreadArticleCount,
    favoriteCount, totalUnreadCount, feedsByFolder,
    refresh, addFeed, removeFeed, syncFeed,
    addRssSubscription, removeRssSubscription,
    addFolder, editFolder, removeFolder,
    addFolderV2, removeFolderV2, renameFolder,
    importOpmlFile, fetchRssIndexList, loadAggregatedStats,
  };
}
