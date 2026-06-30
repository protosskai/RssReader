/**
 * OPML Import E2E Tests — Import folder tree, verify unread counts and stats,
 * handle malformed OPML gracefully without corrupting previous state.
 *
 * Covers: OPML Import with Nested Folder Tree
 * Techniques: positive, equivalence_class, exception, boundary, state_transition
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRssInfoStore } from '../../src/stores/rssInfoStore';
import {
  createIpcMock,
  installIpcMock,
  apiSuccess,
  apiError,
  makeRssFolderItem,
  makeRssInfoItem,
  makeFolderTree,
  type IpcMock,
} from '../__mocks__/factories';
import type { RssFolderItem, ArticleStats } from 'src/common/models';

// ================================================================
// Fixtures — realistic OPML import result data
// ================================================================

/**
 * Simulated folder tree after importing an OPML file with:
 *   - 'Tech' folder: Hacker News (42 unread) + Lobsters (3 unread) → 45 total
 *   - 'News' folder: BBC World (15) + Reuters (0) + AP News (7) → 22 total
 *   - 'Empty Folder' folder: 0 feeds
 *   - Aggregate unread: 42 + 3 + 15 + 0 + 7 = 67
 */
const OPML_TREE: RssFolderItem[] = [
  {
    folderName: 'Tech',
    data: [
      makeRssInfoItem({ id: 'tech-001', title: 'Hacker News', feedUrl: 'https://hnrss.org/frontpage', unread: 42 }),
      makeRssInfoItem({ id: 'tech-002', title: 'Lobsters', feedUrl: 'https://lobste.rs/rss', unread: 3 }),
    ],
    children: [],
  },
  {
    folderName: 'News',
    data: [
      makeRssInfoItem({ id: 'news-001', title: 'BBC World', feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml', unread: 15 }),
      makeRssInfoItem({ id: 'news-002', title: 'Reuters', feedUrl: 'https://www.reuters.com/rss', unread: 0 }),
      makeRssInfoItem({ id: 'news-003', title: 'AP News', feedUrl: 'https://www.apnews.com/rss', unread: 7 }),
    ],
    children: [],
  },
  {
    folderName: 'Empty Folder',
    data: [],
    children: [],
  },
];

/** Simulated ArticleStats matching the OPML tree above */
const OPML_STATS: ArticleStats = {
  totalArticles: 150,
  unreadCount: 67,
  favoriteCount: 12,
  feedCount: 5,
  folderCount: 3,
};

describe('Flow: OPML Import with Nested Folder Tree', () => {
  let ipc: IpcMock;
  let store: ReturnType<typeof useRssInfoStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    ipc = createIpcMock();
    installIpcMock(ipc);
    store = useRssInfoStore();
    // Let the store constructor's fire-and-forget refresh() settle
    await new Promise((r) => setTimeout(r, 20));
    vi.clearAllMocks();
  });

  // ================================================================
  // Positive — successful OPML import with nested folder tree
  // ================================================================

  describe('Positive — Successful OPML Import', () => {
    it('should import an OPML folder tree and populate the store', async () => {
      // Arrange: mock a successful OPML import
      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      // The refresh after import returns the built tree
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(OPML_TREE));
      // Aggregated stats updated after import
      ipc.getArticleStats.mockResolvedValueOnce(OPML_STATS);

      // Act
      await store.importOpmlFile();

      // Assert: IPC was called
      expect(ipc.importOpmlFile).toHaveBeenCalledTimes(1);
      expect(ipc.getRssInfoListFromDb).toHaveBeenCalled();
      expect(ipc.getArticleStats).toHaveBeenCalled();

      // Assert: rssFolderList has 3 folders
      expect(store.rssFolderList.length).toBe(3);

      // Assert: folder names include all three
      expect(store.folderNameList).toContain('Tech');
      expect(store.folderNameList).toContain('News');
      expect(store.folderNameList).toContain('Empty Folder');

      // Assert: 'Tech' folder has 2 feeds
      const techFolder = store.rssFolderList.find((f) => f.folderName === 'Tech')!;
      expect(techFolder).toBeDefined();
      expect(techFolder.data.length).toBe(2);
      expect(techFolder.data[0].title).toBe('Hacker News');
      expect(techFolder.data[1].title).toBe('Lobsters');

      // Assert: 'News' folder has 3 feeds
      const newsFolder = store.rssFolderList.find((f) => f.folderName === 'News')!;
      expect(newsFolder).toBeDefined();
      expect(newsFolder.data.length).toBe(3);
      expect(newsFolder.data[0].title).toBe('BBC World');
      expect(newsFolder.data[1].title).toBe('Reuters');
      expect(newsFolder.data[2].title).toBe('AP News');

      // Assert: 'Empty Folder' has 0 feeds
      const emptyFolder = store.rssFolderList.find((f) => f.folderName === 'Empty Folder')!;
      expect(emptyFolder).toBeDefined();
      expect(emptyFolder.data.length).toBe(0);

      // Assert: unread counts per folder sum correctly
      const techUnread = techFolder.data.reduce((sum, feed) => sum + feed.unread, 0);
      expect(techUnread).toBe(45);
      const newsUnread = newsFolder.data.reduce((sum, feed) => sum + feed.unread, 0);
      expect(newsUnread).toBe(22);

      // Assert: total unread matches across all folders (42+3+15+0+7 = 67)
      expect(store.unreadArticleCount).toBe(67);

      // Assert: aggregated stats match
      expect(store.aggregatedStats.totalArticles).toBe(150);
      expect(store.aggregatedStats.unreadCount).toBe(67);
      expect(store.aggregatedStats.favoriteCount).toBe(12);
      expect(store.aggregatedStats.feedCount).toBe(5);
      expect(store.aggregatedStats.folderCount).toBe(3);

      // Assert: computed properties are derived correctly
      expect(store.totalArticleCount).toBe(150);
      expect(store.favoriteCount).toBe(12);

      // Assert: no error state
      expect(store.error).toBeNull();
      expect(store.isLoading).toBe(false);
    });

    it('should preserve the empty folder name after OPML import', async () => {
      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(OPML_TREE));
      ipc.getArticleStats.mockResolvedValueOnce(OPML_STATS);

      await store.importOpmlFile();

      expect(store.folderNameList).toContain('Empty Folder');
    });

    it('should import a single-folder OPML with one feed', async () => {
      const singleFolder: RssFolderItem[] = [
        {
          folderName: 'Solo Feed',
          data: [
            makeRssInfoItem({ id: 'solo-001', title: 'Single Feed', feedUrl: 'https://example.com/rss', unread: 10 }),
          ],
          children: [],
        },
      ];

      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(singleFolder));
      ipc.getArticleStats.mockResolvedValueOnce({
        totalArticles: 10,
        unreadCount: 10,
        favoriteCount: 0,
        feedCount: 1,
        folderCount: 1,
      });

      await store.importOpmlFile();

      expect(store.rssFolderList.length).toBe(1);
      expect(store.rssFolderList[0].folderName).toBe('Solo Feed');
      expect(store.rssFolderList[0].data.length).toBe(1);
      expect(store.unreadArticleCount).toBe(10);
      expect(store.error).toBeNull();
    });
  });

  // ================================================================
  // Equivalence Classes — OPML with different folder/feed structures
  // ================================================================

  describe('Equivalence Classes — Folder and Feed Structures', () => {
    it('should import an OPML with folders that have zero unread articles', async () => {
      const allReadFolders: RssFolderItem[] = [
        {
          folderName: 'Read Everything',
          data: [
            makeRssInfoItem({ id: 'read-001', title: 'Read Feed', feedUrl: 'https://example.com/rss', unread: 0 }),
          ],
          children: [],
        },
      ];

      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(allReadFolders));
      ipc.getArticleStats.mockResolvedValueOnce({
        totalArticles: 100,
        unreadCount: 0,
        favoriteCount: 5,
        feedCount: 1,
        folderCount: 1,
      });

      await store.importOpmlFile();

      expect(store.rssFolderList.length).toBe(1);
      expect(store.unreadArticleCount).toBe(0);
      expect(store.aggregatedStats.unreadCount).toBe(0);
      expect(store.error).toBeNull();
    });

    it('should import an OPML with many feeds in one folder', async () => {
      const manyFeeds = Array.from({ length: 20 }, (_, i) =>
        makeRssInfoItem({
          id: `multi-${String(i + 1).padStart(3, '0')}`,
          title: `Feed ${i + 1}`,
          feedUrl: `https://example.com/feed-${i + 1}.xml`,
          unread: i * 2,
        }),
      );
      const heavyFolder: RssFolderItem[] = [
        {
          folderName: 'Heavy Folder',
          data: manyFeeds,
          children: [],
        },
      ];
      // Expected unread: sum of i*2 for i=0..19 = 2 * (19*20/2) = 380
      const expectedUnread = 380;

      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(heavyFolder));
      ipc.getArticleStats.mockResolvedValueOnce({
        totalArticles: 1000,
        unreadCount: expectedUnread,
        favoriteCount: 3,
        feedCount: 20,
        folderCount: 1,
      });

      await store.importOpmlFile();

      expect(store.rssFolderList.length).toBe(1);
      expect(store.rssFolderList[0].data.length).toBe(20);
      expect(store.unreadArticleCount).toBe(expectedUnread);
      expect(store.error).toBeNull();
    });

    it('should import an OPML with only empty folders', async () => {
      const emptyOnly: RssFolderItem[] = [
        { folderName: 'Empty A', data: [], children: [] },
        { folderName: 'Empty B', data: [], children: [] },
        { folderName: 'Empty C', data: [], children: [] },
      ];

      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(emptyOnly));
      ipc.getArticleStats.mockResolvedValueOnce({
        totalArticles: 0,
        unreadCount: 0,
        favoriteCount: 0,
        feedCount: 0,
        folderCount: 3,
      });

      await store.importOpmlFile();

      expect(store.rssFolderList.length).toBe(3);
      expect(store.unreadArticleCount).toBe(0);
      expect(store.folderNameList).toEqual(['Empty A', 'Empty B', 'Empty C']);
      expect(store.error).toBeNull();
    });
  });

  // ================================================================
  // Boundary — Edge case OPML scenarios
  // ================================================================

  describe('Boundary Values', () => {
    it('should handle importing an OPML when no file is selected (dialog canceled)', async () => {
      // When the dialog is canceled, the main process still returns success
      // but does nothing — folder list stays the same
      const initialFolder: RssFolderItem[] = [
        { folderName: 'Initial', data: [], children: [] },
      ];
      store.rssFolderList = initialFolder;

      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      // Refresh returns the same data (nothing changed)
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(initialFolder));
      ipc.getArticleStats.mockResolvedValueOnce({
        totalArticles: 0,
        unreadCount: 0,
        favoriteCount: 0,
        feedCount: 0,
        folderCount: 1,
      });

      await store.importOpmlFile();

      expect(store.rssFolderList).toEqual(initialFolder);
      expect(store.error).toBeNull();
    });

    it('should accept folders with very long names (up to boundary)', async () => {
      const longName = 'A'.repeat(256);
      const longFolder: RssFolderItem[] = [
        {
          folderName: longName,
          data: [makeRssInfoItem({ id: 'long-001', title: 'Deep Feed', feedUrl: 'https://example.com/rss', unread: 1 })],
          children: [],
        },
      ];

      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(longFolder));
      ipc.getArticleStats.mockResolvedValueOnce({
        totalArticles: 1,
        unreadCount: 1,
        favoriteCount: 0,
        feedCount: 1,
        folderCount: 1,
      });

      await store.importOpmlFile();

      expect(store.rssFolderList[0].folderName.length).toBe(256);
      expect(store.folderNameList).toContain(longName);
      expect(store.error).toBeNull();
    });

    it('should accept folder names with special characters', async () => {
      const specialFolders: RssFolderItem[] = [
        { folderName: 'Tech & Science', data: [], children: [] },
        { folderName: 'Café & Crêpes', data: [], children: [] },
        { folderName: '<Dev> (hacker-news)', data: [], children: [] },
      ];

      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(specialFolders));
      ipc.getArticleStats.mockResolvedValueOnce({
        totalArticles: 0,
        unreadCount: 0,
        favoriteCount: 0,
        feedCount: 0,
        folderCount: 3,
      });

      await store.importOpmlFile();

      expect(store.rssFolderList.length).toBe(3);
      expect(store.folderNameList).toContain('Tech & Science');
      expect(store.folderNameList).toContain('Café & Crêpes');
      expect(store.folderNameList).toContain('<Dev> (hacker-news)');
      expect(store.error).toBeNull();
    });
  });

  // ================================================================
  // Exception — error handling during OPML import
  // ================================================================

  describe('Exception — Error Handling', () => {
    it('should handle an empty/malformed OPML importing gracefully', async () => {
      // Set up initial state first
      store.rssFolderList = OPML_TREE;
      store.aggregatedStats.value = OPML_STATS;

      // Mock a failed import — malformed file
      ipc.importOpmlFile.mockRejectedValueOnce(
        new Error('INVALID_PARAM: Empty or malformed OPML file'),
      );

      // Act & Assert: the store throws with the correct error
      await expect(store.importOpmlFile()).rejects.toThrow('INVALID_PARAM');

      // Assert: previous folder state is preserved despite the error
      expect(store.rssFolderList).toEqual(OPML_TREE);
      expect(store.rssFolderList.length).toBe(3);
      expect(store.folderNameList).toContain('Tech');
      expect(store.folderNameList).toContain('News');
      expect(store.folderNameList).toContain('Empty Folder');

      // Assert: error state is set correctly
      expect(store.error).toContain('INVALID_PARAM');

      // Assert: loading is cleared
      expect(store.isLoading).toBe(false);

      // Assert: IPC not called for refresh (action threw before refresh)
      expect(ipc.getRssInfoListFromDb).not.toHaveBeenCalled();
    });

    it('should handle a file-not-found error from the main process', async () => {
      store.rssFolderList = OPML_TREE;

      ipc.importOpmlFile.mockRejectedValueOnce(
        new Error('FILE_NOT_FOUND: File does not exist'),
      );

      await expect(store.importOpmlFile()).rejects.toThrow('FILE_NOT_FOUND');

      // Previous state preserved
      expect(store.rssFolderList).toEqual(OPML_TREE);
      expect(store.error).toContain('FILE_NOT_FOUND');
    });

    it('should handle a database error during the OPML refresh phase', async () => {
      // The importOpmlFile IPC succeeds, but the subsequent refresh fails
      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockRejectedValueOnce(
        new Error('DATABASE_ERROR: disk I/O error'),
      );

      await expect(store.importOpmlFile()).rejects.toThrow('DATABASE_ERROR');

      expect(store.error).toContain('DATABASE_ERROR');
      expect(store.isLoading).toBe(false);
    });

    it('should handle unexpected rejection (non-Error)', async () => {
      // Set previous state to verify preservation
      store.rssFolderList = [
        { folderName: 'Persistent', data: [], children: [] },
      ];

      // Simulate a non-Error throw from IPC
      ipc.importOpmlFile.mockRejectedValueOnce('something went wrong');

      await expect(store.importOpmlFile()).rejects.toThrow('导入OPML文件失败');

      // Previous state preserved because action threw before refresh
      expect(store.rssFolderList.length).toBe(1);
      expect(store.rssFolderList[0].folderName).toBe('Persistent');
      expect(store.error).toBe('导入OPML文件失败');
    });

    it('should handle apiError response from importOpmlFile', async () => {
      store.rssFolderList = OPML_TREE;

      // IPC returns an error response instead of throwing
      ipc.importOpmlFile.mockResolvedValueOnce(
        apiError('INVALID_PARAM', 'Empty file'),
      );

      await expect(store.importOpmlFile()).rejects.toThrow('Empty file');

      expect(store.error).toBe('Empty file');
      expect(store.rssFolderList).toEqual(OPML_TREE);
    });
  });

  // ================================================================
  // State Transitions — loading, error, success lifecycle
  // ================================================================

  describe('State Transitions', () => {
    it('should transition: idle → loading → ready on success', async () => {
      ipc.importOpmlFile.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(apiSuccess(undefined)), 10)),
      );
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(OPML_TREE));
      ipc.getArticleStats.mockResolvedValueOnce(OPML_STATS);

      const promise = store.importOpmlFile();

      // During the operation, loading should be true
      expect(store.isLoading).toBe(true);

      await promise;

      // After completion, loading cleared
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.rssFolderList.length).toBe(3);
    });

    it('should transition: idle → loading → error on failure', async () => {
      ipc.importOpmlFile.mockImplementationOnce(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('OPML parse failure')), 10)),
      );

      const promise = store.importOpmlFile();

      expect(store.isLoading).toBe(true);

      await expect(promise).rejects.toThrow('OPML parse failure');

      expect(store.isLoading).toBe(false);
      expect(store.error).toBe('OPML parse failure');
    });

    it('should clear previous error on a subsequent successful import', async () => {
      // First: trigger an error
      store.rssFolderList = [];
      ipc.importOpmlFile.mockRejectedValueOnce(new Error('First error'));
      await expect(store.importOpmlFile()).rejects.toThrow('First error');
      expect(store.error).toBe('First error');

      // Second: succeed
      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(OPML_TREE));
      ipc.getArticleStats.mockResolvedValueOnce(OPML_STATS);
      await store.importOpmlFile();

      expect(store.error).toBeNull();
      expect(store.rssFolderList.length).toBe(3);
    });

    it('should preserve previous folder tree when a second OPML import fails', async () => {
      // First import succeeds
      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(OPML_TREE));
      ipc.getArticleStats.mockResolvedValueOnce(OPML_STATS);
      await store.importOpmlFile();
      expect(store.rssFolderList.length).toBe(3);
      expect(store.error).toBeNull();

      // Second import fails
      ipc.importOpmlFile.mockRejectedValueOnce(new Error('Network error'));
      await expect(store.importOpmlFile()).rejects.toThrow('Network error');

      // Previous tree is still intact
      expect(store.rssFolderList.length).toBe(3);
      expect(store.rssFolderList[0].folderName).toBe('Tech');
      expect(store.error).toBe('Network error');
    });

    it('should reset loading state even when refresh fails after successful import IPC', async () => {
      // importOpmlFile succeeds, but refresh (getRssInfoListFromDb) fails
      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockRejectedValueOnce(
        new Error('DATABASE_ERROR: connection lost'),
      );

      await expect(store.importOpmlFile()).rejects.toThrow('DATABASE_ERROR');

      expect(store.isLoading).toBe(false);
    });

    it('should overwrite a previous error with a new error', async () => {
      // First error
      ipc.importOpmlFile.mockRejectedValueOnce(new Error('parse error #1'));
      await expect(store.importOpmlFile()).rejects.toThrow('parse error #1');
      expect(store.error).toBe('parse error #1');

      // Second different error
      ipc.importOpmlFile.mockRejectedValueOnce(new Error('parse error #2'));
      await expect(store.importOpmlFile()).rejects.toThrow('parse error #2');
      expect(store.error).toBe('parse error #2');
    });
  });

  // ================================================================
  // Computed Properties — derived state after OPML import
  // ================================================================

  describe('Computed Properties After Import', () => {
    it('should compute folderNameList from imported folder tree', async () => {
      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(OPML_TREE));
      ipc.getArticleStats.mockResolvedValueOnce(OPML_STATS);

      await store.importOpmlFile();

      // folderNameList is a computed derived from rssFolderList
      expect(store.folderNameList).toEqual(['Tech', 'News', 'Empty Folder']);
      expect(store.folderNameList.length).toBe(3);
    });

    it('should compute unreadArticleCount from folder data after import', async () => {
      store.rssFolderList = OPML_TREE;

      // unreadArticleCount is derived from rssFolderList unread values
      // Tech: 42+3=45, News: 15+0+7=22, Empty: 0 → total 67
      expect(store.unreadArticleCount).toBe(67);

      // Verify per-folder contributions
      const techFolder = store.rssFolderList[0];
      const techUnread = techFolder.data.reduce((s, f) => s + f.unread, 0);
      expect(techUnread).toBe(45);

      const newsFolder = store.rssFolderList[1];
      const newsUnread = newsFolder.data.reduce((s, f) => s + f.unread, 0);
      expect(newsUnread).toBe(22);

      const emptyFolder = store.rssFolderList[2];
      const emptyUnread = emptyFolder.data.reduce((s, f) => s + f.unread, 0);
      expect(emptyUnread).toBe(0);
    });

    it('should derive totalArticleCount from aggregatedStats', async () => {
      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess(OPML_TREE));
      ipc.getArticleStats.mockResolvedValueOnce(OPML_STATS);

      await store.importOpmlFile();

      // totalArticleCount comes from aggregatedStats.totalArticles
      expect(store.totalArticleCount).toBe(150);
      expect(store.aggregatedStats.totalArticles).toBe(150);
    });

    it('should compute folder counts correctly after importing an empty OPML', async () => {
      ipc.importOpmlFile.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));
      ipc.getArticleStats.mockResolvedValueOnce({
        totalArticles: 0,
        unreadCount: 0,
        favoriteCount: 0,
        feedCount: 0,
        folderCount: 0,
      });

      await store.importOpmlFile();

      expect(store.rssFolderList).toEqual([]);
      expect(store.folderNameList).toEqual([]);
      expect(store.unreadArticleCount).toBe(0);
      expect(store.totalArticleCount).toBe(0);
    });
  });
});
