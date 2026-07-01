import type { ElectronContract } from 'src/common/electronContract';

let cachedClient: ElectronContract | null = null;

const isElectron = (): boolean => !!window?.electronAPI;

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
    addRssSubscription: () => noopPromise({ error: '非 Electron 环境', data: null }),
    removeRssSubscription: () => noopPromise({ error: '非 Electron 环境', data: null }),
    addFolder: () => noopPromise({ error: '非 Electron 环境', data: null }),
    removeFolder: () => noopPromise({ error: '非 Electron 环境', data: null }),
    importOpmlFile: () => noopPromise({ error: '非 Electron 环境', data: null }),
    getRssInfoListFromDb: () => noopPromise({ error: '非 Electron 环境', data: [] }),
    queryPostIndexByRssId: () => noopPromise({ error: '非 Electron 环境', data: [] }),
    queryPostContentByGuid: () => noopPromise({ error: '非 Electron 环境', data: null }),
    fetchRssIndexList: () => noopPromise({ error: '非 Electron 环境', data: null }),
    dumpFolderToDb: () => noopPromise({ success: false, msg: '非 Electron 环境' }),
    loadFolderFromDb: () => noopPromise({ error: '非 Electron 环境', data: '[]' }),
    editFolder: () => noopPromise({ error: '非 Electron 环境', data: null }),
    // --- Article API ---
    getArticles: () => noopPromise({ articles: [], total: 0 }),
    getArticle: () => noopPromise(null),
    toggleReadStatus: () => noopPromise(),
    toggleFavorite: () => noopPromise(false),
    markAllAsRead: () => noopPromise(),
    clearAllFavorites: () => noopPromise(),
    getArticleStats: () => noopPromise({ totalArticles: 0, unreadArticles: 0, favoriteArticles: 0, feedCount: 0, folderCount: 0 }),
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
    syncStart: () => noopPromise({}),
    syncGetStatus: () => noopPromise({ syncing: false }),
    syncStartAuto: () => noopPromise({}),
    syncStopAuto: () => noopPromise({}),
    // --- Search ---
    searchPosts: () => noopPromise({ error: '非 Electron 环境', data: [] }),
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

/** The real client (Electron) or a safe noop (browser/SSR). Never throws. */
export const electronClient: ElectronContract = isElectron()
  ? new Proxy({} as ElectronContract, {
      get: (_, key: keyof ElectronContract) => {
        const client = getClient();
        return client[key];
      },
    })
  : buildNoopClient();
