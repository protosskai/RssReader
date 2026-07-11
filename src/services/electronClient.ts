import type { ElectronContract } from 'src/common/electronContract';

let cachedClient: ElectronContract | null = null;
let cachedNoop: ElectronContract | null = null;

const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!window?.electronAPI;

const getClient = (): ElectronContract => {
  if (cachedClient) return cachedClient;
  if (!isElectron()) {
    throw new Error('Electron API is not available in current runtime.');
  }
  cachedClient = window.electronAPI;
  return cachedClient;
};

/** Reset cached client (logout / app restart). */
export const resetElectronClient = (): void => {
  cachedClient = null;
};

/**
 * Build a safe noop proxy that returns empty/default values for every
 * method on ElectronContract.  Used when window.electronAPI is absent
 * (e.g. regular browser dev / SSR).  Never throws.
 */
const buildNoopClient = (): ElectronContract => {
  const noopPromise = <T>(defaultValue?: T) =>
    Promise.resolve(defaultValue) as Promise<T>;

  const safeDefaults: Partial<Record<keyof ElectronContract, () => unknown>> = {
    // --- Legacy ---
    addRssSubscription: () => noopPromise({ success: false, error: { code: 'UNKNOWN_ERROR', message: '非 Electron 环境' } }),
    removeRssSubscription: () => noopPromise({ success: false, error: { code: 'UNKNOWN_ERROR', message: '非 Electron 环境' } }),
    addFolder: () => noopPromise({ success: false, error: { code: 'UNKNOWN_ERROR', message: '非 Electron 环境' } }),
    removeFolder: () => noopPromise({ success: false, error: { code: 'UNKNOWN_ERROR', message: '非 Electron 环境' } }),
    importOpmlFile: () => noopPromise({ success: false, error: { code: 'UNKNOWN_ERROR', message: '非 Electron 环境' } }),
    getRssInfoListFromDb: () => noopPromise({ success: true, data: [] }),
    queryPostIndexByRssId: () => noopPromise({ success: true, data: [] }),
    queryPostContentByGuid: () => noopPromise({ success: false, error: { code: 'UNKNOWN_ERROR', message: '非 Electron 环境' } }),
    fetchRssIndexList: () => noopPromise({ success: true, data: undefined }),
    dumpFolderToDb: () => noopPromise({ success: false, msg: '非 Electron 环境' }),
    loadFolderFromDb: () => noopPromise({ success: true, data: '[]' }),
    editFolder: () => noopPromise({ success: false, error: { code: 'UNKNOWN_ERROR', message: '非 Electron 环境' } }),
    // --- Article API ---
    getArticles: () => noopPromise({ articles: [], total: 0 }),
    getArticle: () => noopPromise(null as never),
    toggleReadStatus: () => noopPromise(),
    setReadStatus: () => noopPromise(false),
    toggleFavorite: () => noopPromise(false),
    markAllAsRead: () => noopPromise(),
    clearAllFavorites: () => noopPromise(),
    getArticleStats: () =>
      noopPromise({
        totalArticles: 0,
        unreadCount: 0,
        favoriteCount: 0,
        feedCount: 0,
        folderCount: 0,
      }),
    // --- Feed API ---
    getFeeds: () => noopPromise([]),
    getFeed: () => noopPromise(null),
    addFeed: () => noopPromise(),
    removeFeed: () => noopPromise(),
    syncFeed: () => noopPromise(),
    // --- Folder API ---
    getFolders: () => noopPromise([]),
    getFolder: () => noopPromise(null),
    addFolderV2: () => noopPromise(),
    removeFolderV2: () => noopPromise(),
    renameFolder: () => noopPromise(),
    // --- Favorites ---
    getFavoritePosts: () => noopPromise([]),
    addFavoritePost: () => noopPromise(),
    removeFavoritePost: () => noopPromise(),
    isPostFavorite: () => noopPromise(false),
    // --- Sync ---
    syncGetConfig: () => noopPromise({ enabled: false }),
    syncUpdateConfig: () => noopPromise({}),
    syncStart: () => noopPromise({ success: true, stats: { successCount: 0, failureCount: 0 } }),
    syncGetStatus: () => noopPromise({ isSyncing: false }),
    syncGetProgress: () =>
      noopPromise({
        totalSources: 0,
        completedCount: 0,
        successCount: 0,
        failureCount: 0,
        isSyncing: false,
        currentSource: null,
        sources: [],
      }),
    syncStartAuto: () => noopPromise({}),
    syncStopAuto: () => noopPromise({}),
    // --- Search ---
    searchPosts: () => noopPromise({ success: true, data: [] }),
  };

  return new Proxy({} as ElectronContract, {
    get: (_, key: keyof ElectronContract) => {
      const fn = safeDefaults[key];
      if (fn) return fn;
      // Catch-all for window-control sync methods (close, minimize, openLink)
      console.warn(`[electronClient] Noop: ${String(key)} called outside Electron`);
      return () => undefined;
    },
  });
};

/**
 * Electron IPC client that resolves the real API lazily on each access.
 * Avoids locking into noop when the module is evaluated before preload injects
 * window.electronAPI (or during HMR). Never throws for missing API — falls
 * back to safe noop defaults.
 */
export const electronClient: ElectronContract = new Proxy({} as ElectronContract, {
  get: (_target, key: keyof ElectronContract) => {
    if (isElectron()) {
      try {
        const client = getClient();
        const value = client[key];
        if (typeof value === 'function') {
          return (value as (...args: unknown[]) => unknown).bind(client);
        }
        return value;
      } catch (e) {
        console.warn('[electronClient] Failed to resolve real client:', e);
      }
    }

    if (!cachedNoop) {
      cachedNoop = buildNoopClient();
    }
    return cachedNoop[key];
  },
});
