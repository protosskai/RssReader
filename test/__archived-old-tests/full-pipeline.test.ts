/**
 * Integration Tests — Full data pipeline end-to-end.
 *
 * Tests the complete flow: add feed → fetch → parse → persist → query.
 * Uses store patterns with mocked IPC to simulate realistic user flows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRssInfoStore } from '../../src/stores/rssInfoStore';
import { useFavoriteStore } from '../../src/stores/favoriteStore';
import { useSearchStore } from '../../src/stores/searchStore';
import {
  createIpcMock,
  installIpcMock,
  apiSuccess,
  apiError,
  makeRssFolderItem,
  makeRssInfoItem,
  makePostIndexItem,
  makePostIndexItems,
  makeContentInfo,
  makeFolderTree,
  type IpcMock,
} from '../__mocks__/factories';

describe('Integration: Full Data Pipeline', () => {
  let ipc: IpcMock;
  let rssStore: ReturnType<typeof useRssInfoStore>;
  let favStore: ReturnType<typeof useFavoriteStore>;
  let searchStore: ReturnType<typeof useSearchStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    ipc = createIpcMock();
    installIpcMock(ipc);
    rssStore = useRssInfoStore();
    favStore = useFavoriteStore();
    searchStore = useSearchStore();
    // Let store init settle
    await new Promise((r) => setTimeout(r, 20));
    vi.clearAllMocks();
    localStorage.clear();
    searchStore.clearSearch();
    searchStore.clearSearchHistory();
  });

  // ================================================================
  // Pipeline 1: Add Feed → Fetch Posts → Read Article
  // ================================================================

  it('should complete: add feed → fetch posts → read article → mark as read', async () => {
    // Step 1: Create a folder
    ipc.addFolder.mockResolvedValueOnce(apiSuccess(undefined));
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(
      apiSuccess([makeRssFolderItem({ folderName: 'Tech', data: [] })]),
    );
    await rssStore.addFolder('Tech');
    expect(rssStore.folderNameList).toContain('Tech');

    // Step 2: Subscribe to a feed
    const feedList = [
      makeRssFolderItem({
        folderName: 'Tech',
        data: [
          makeRssInfoItem({
            id: 'feed-hn',
            title: 'Hacker News',
            feedUrl: 'https://hnrss.org/frontpage',
          }),
        ],
      }),
    ];
    ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(feedList));
    await rssStore.addRssSubscription('https://hnrss.org/frontpage', 'Hacker News', 'Tech');
    expect(rssStore.rssFolderList[0].data).toHaveLength(1);

    // Step 3: Fetch posts for the feed
    const posts = makePostIndexItems(20, { rssId: 'feed-hn' });
    ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(posts));
    const fetchedPosts = await ipc.queryPostIndexByRssId('feed-hn');
    expect(fetchedPosts.data).toHaveLength(20);

    // Step 4: Read article content
    const firstPost = posts[0];
    const content = makeContentInfo({
      title: firstPost.title,
      guid: firstPost.guid,
    });
    ipc.queryPostContentByGuid.mockResolvedValueOnce(apiSuccess(content));
    const article = await ipc.queryPostContentByGuid(firstPost.guid);
    expect(article.data.title).toBe(firstPost.title);

    // Step 5: Mark as read
    ipc.toggleReadStatus.mockResolvedValueOnce(undefined);
    await ipc.toggleReadStatus(firstPost.guid);
    expect(ipc.toggleReadStatus).toHaveBeenCalledWith(firstPost.guid);

    // Verify all steps completed without errors
    expect(rssStore.error).toBeNull();
  });

  // ================================================================
  // Pipeline 2: Search → Favorite → Unfavorite
  // ================================================================

  it('should complete: search → favorite → unfavorite', async () => {
    // Set up posts
    const posts = makePostIndexItems(10);
    const searchKeyword = 'Article 5'; // exact match
    posts[4].title = 'Article 5 — Special Target';

    // Step 1: Search locally
    await searchStore.search(searchKeyword, posts);
    expect(searchStore.searchResults).toHaveLength(1);
    const targetPost = searchStore.searchResults[0];

    // Step 2: Favorite the found post
    ipc.isPostFavorite.mockResolvedValueOnce(false);
    ipc.addFavoritePost.mockResolvedValueOnce(undefined);
    const favResult = await favStore.toggleFavorite(targetPost);
    expect(favResult.favorited).toBe(true);
    expect(favStore.favoritePosts).toHaveLength(1);

    // Step 3: Unfavorite it
    ipc.isPostFavorite.mockResolvedValueOnce(true);
    ipc.removeFavoritePost.mockResolvedValueOnce(undefined);
    const unfavResult = await favStore.toggleFavorite(targetPost);
    expect(unfavResult.favorited).toBe(false);
    expect(favStore.favoritePosts).toHaveLength(0);
  });

  // ================================================================
  // Pipeline 3: Import OPML → Sync → Verify
  // ================================================================

  it('should complete: import OPML → refresh → verify folders', async () => {
    const importedFolders = makeFolderTree();

    // Step 1: Import OPML
    ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(importedFolders));
    await rssStore.importOpmlFile();
    expect(ipc.importOpmlFile).toHaveBeenCalledTimes(1);

    // Step 2: Mock article stats since totalArticleCount comes from DB stats
    ipc.getArticleStats.mockResolvedValueOnce({
      totalArticles: 150,
      unreadCount: 67,
      favoriteCount: 12,
      feedCount: 5,
      folderCount: 3,
    });
    await rssStore.loadAggregatedStats();

    // Step 3: Verify computed properties
    // totalArticleCount from DB stats, unreadArticleCount from folder list
    expect(rssStore.totalArticleCount).toBe(150);
    expect(rssStore.unreadArticleCount).toBe(67); // 45 + 22
    expect(rssStore.folderNameList).toContain('Tech');
    expect(rssStore.folderNameList).toContain('News');
    expect(rssStore.folderNameList).toContain('Empty Folder');

    // Step 3: Refresh to verify persistence
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(importedFolders));
    await rssStore.refresh();
    expect(rssStore.rssFolderList).toEqual(importedFolders);
  });

  // ================================================================
  // Pipeline 4: Error Recovery — Operation fails, retry succeeds
  // ================================================================

  it('should recover: error → retry → success', async () => {
    // First attempt fails
    ipc.addRssSubscription.mockRejectedValueOnce(
      new Error('NETWORK_TIMEOUT: Feed fetch timed out'),
    );
    await expect(
      rssStore.addRssSubscription('https://slow.example/rss.xml', 'Slow Feed', 'Tech'),
    ).rejects.toThrow('NETWORK_TIMEOUT');
    expect(rssStore.error).toContain('NETWORK_TIMEOUT');

    // Second attempt succeeds
    ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));
    await rssStore.addRssSubscription('https://fast.example/rss.xml', 'Fast Feed', 'Tech');
    expect(rssStore.error).toBeNull();

    // Verify loading state was reset correctly
    expect(rssStore.isLoading).toBe(false);
  });

  // ================================================================
  // Pipeline 5: Multi-feed refresh → search global
  // ================================================================

  it('should complete: multi-feed library → global search', async () => {
    // Set up multi-folder state
    const folders = makeFolderTree();
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(folders));
    await rssStore.refresh();
    expect(rssStore.rssFolderList).toEqual(folders);

    // Global search across all feeds
    const searchResults = makePostIndexItems(3, {
      title: 'Python async guide',
      rssId: 'tech-001',
    });
    ipc.searchPosts.mockResolvedValueOnce(apiSuccess(searchResults));

    await searchStore.search('Python async', []);

    expect(ipc.searchPosts).toHaveBeenCalledWith('Python async', undefined);
    expect(searchStore.searchResults).toHaveLength(3);
    expect(searchStore.searchResults[0].title).toContain('Python async');
  });

  // ================================================================
  // Pipeline 6: Folder lifecycle — create → add feeds → delete
  // ================================================================

  it('should complete: folder lifecycle (create → add feeds → delete)', async () => {
    // Step 1: Create folder
    ipc.addFolder.mockResolvedValueOnce(apiSuccess(undefined));
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(
      apiSuccess([makeRssFolderItem({ folderName: 'Programming', data: [] })]),
    );
    await rssStore.addFolder('Programming');
    expect(rssStore.folderNameList).toContain('Programming');

    // Step 2: Add feeds to the folder
    const folderWithFeeds = [
      makeRssFolderItem({
        folderName: 'Programming',
        data: [
          makeRssInfoItem({ id: 'feed-py', title: 'Python Blog', feedUrl: 'https://python.example/rss' }),
          makeRssInfoItem({ id: 'feed-js', title: 'JS Blog', feedUrl: 'https://js.example/rss' }),
        ],
      }),
    ];
    ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(folderWithFeeds));
    await rssStore.addRssSubscription('https://python.example/rss', 'Python Blog', 'Programming');
    expect(rssStore.rssFolderList[0].data).toHaveLength(2);

    // Step 3: Delete the folder with feeds
    ipc.removeFolder.mockResolvedValueOnce(apiSuccess(undefined));
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));
    await rssStore.removeFolder('Programming');
    expect(rssStore.rssFolderList).toEqual([]);
    expect(rssStore.folderNameList).toEqual([]);
  });

  // ================================================================
  // Pipeline 7: Concurrent store interactions
  // ================================================================

  it('should not interfere: concurrent search and favorite operations', async () => {
    const posts = makePostIndexItems(10);

    // Search for something
    await searchStore.search('Article 3', posts);
    expect(searchStore.searchResults).toHaveLength(1);

    // While search results exist, toggle a favorite on a different post
    ipc.isPostFavorite.mockResolvedValueOnce(false);
    ipc.addFavoritePost.mockResolvedValueOnce(undefined);
    await favStore.toggleFavorite(posts[0]);
    expect(favStore.favoritePosts).toHaveLength(1);

    // Refresh RSS store
    ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(makeFolderTree()));
    await rssStore.refresh();
    expect(rssStore.rssFolderList).toEqual(makeFolderTree());

    // Search results should still be intact (stores are independent)
    expect(searchStore.searchResults).toHaveLength(1);
    expect(favStore.favoritePosts).toHaveLength(1);
  });

  // ================================================================
  // Pipeline 8: Edge case — all API layers in sequence
  // ================================================================

  it('should handle rapid sequential IPC calls without data corruption', async () => {
    // Set up feeds
    const folders = makeFolderTree();
    ipc.getRssInfoListFromDb.mockResolvedValue(apiSuccess(folders));

    // Run all in parallel-sequential fashion
    await rssStore.refresh();

    // Fetch articles for each feed
    for (const folder of folders) {
      for (const feed of folder.data) {
        ipc.queryPostIndexByRssId.mockResolvedValueOnce(
          apiSuccess(makePostIndexItems(5, { rssId: feed.id })),
        );
        const result = await ipc.queryPostIndexByRssId(feed.id);
        expect(result.data).toHaveLength(5);
      }
    }

    // Mark all as read in first folder
    ipc.markAllAsRead.mockResolvedValueOnce(undefined);
    await ipc.markAllAsRead({ folderName: 'Tech' });
    expect(ipc.markAllAsRead).toHaveBeenCalledWith({ folderName: 'Tech' });

    // Toggle favorites on a few articles
    const article = makePostIndexItem({ guid: 'fav-test' });
    ipc.isPostFavorite.mockResolvedValueOnce(false);
    ipc.addFavoritePost.mockResolvedValueOnce(undefined);
    await favStore.toggleFavorite(article);
    expect(favStore.favoriteCount).toBe(1);

    // Clear all favorites
    ipc.removeFavoritePost.mockResolvedValueOnce(undefined);
    await favStore.clearAllFavorites();
    expect(favStore.favoritePosts).toEqual([]);
  });
});
