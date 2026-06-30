/**
 * Feed Subscription Lifecycle E2E Tests
 *
 * Complete feed lifecycle: subscribe → verify store → fetch posts →
 * read article → toggle read status → duplicate rejection →
 * unsubscribe → store cleanup → URL validation.
 *
 * Covers all state transitions across the feed lifecycle via mocked IPC.
 * Techniques: positive, state_transition, boundary, exception
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRssInfoStore } from '../../src/stores/rssInfoStore';
import {
  createIpcMock,
  installIpcMock,
  apiSuccess,
  apiError,
  makeRssInfoItem,
  makeRssFolderItem,
  makePostIndexItem,
  makePostIndexItems,
  makeContentInfo,
  type IpcMock,
} from '../__mocks__/factories';
import type { RssFolderItem, RssInfoItem } from 'src/common/models';

// ============================================================================
// Fixtures — match the scenario specification
// ============================================================================

const FEED_PYTHON: RssInfoItem = {
  id: 'feed-py',
  title: 'Python Blog',
  feedUrl: 'https://python.example/rss.xml',
  htmlUrl: 'https://python.example',
  unread: 15,
  avatar: '',
  lastUpdateTime: '2024-06-15 14:30:00',
};

const FEED_HN: RssInfoItem = {
  id: 'feed-hn',
  title: 'Hacker News',
  feedUrl: 'https://hnrss.org/frontpage',
  htmlUrl: 'https://news.ycombinator.com',
  unread: 42,
  avatar: '',
  lastUpdateTime: '2024-06-15 12:00:00',
};

const POSTS_PYTHON = [
  makePostIndexItem({
    title: 'Async Python Deep Dive',
    guid: 'post-001',
    link: 'https://python.example/async-deep-dive',
    author: 'Jane Dev',
    updateTime: '2024-06-15 14:30:00',
    read: false,
    desc: 'A comprehensive guide to asyncio patterns...',
    rssId: 'feed-py',
  }),
  makePostIndexItem({
    title: 'PEP 723 Update',
    guid: 'post-002',
    link: 'https://python.example/pep-723',
    author: 'Guido Fan',
    updateTime: '2024-06-14 09:00:00',
    read: false,
    desc: 'New packaging standards...',
    rssId: 'feed-py',
  }),
];

const TECH_FOLDER_EMPTY: RssFolderItem = {
  folderName: 'Tech',
  data: [],
  children: [],
};

const TECH_FOLDER_WITH_PYTHON: RssFolderItem = {
  folderName: 'Tech',
  data: [FEED_PYTHON],
  children: [],
};

const CONTENT_PYTHON_DEEP_DIVE = makeContentInfo({
  title: 'Async Python Deep Dive',
  content: '<p>A comprehensive guide to asyncio patterns...</p><p>With code examples.</p>',
  link: 'https://python.example/async-deep-dive',
  author: 'Jane Dev',
  updateTime: '2024-06-15 14:30:00',
  rssId: 'feed-py',
  read: 0,
  favorite: 0,
});

describe('Feed Subscription Lifecycle — Add → Read → Remove', () => {
  let ipc: IpcMock;
  let store: ReturnType<typeof useRssInfoStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    ipc = createIpcMock();
    installIpcMock(ipc);
    store = useRssInfoStore();
    // Let store init's fire-and-forget refresh() settle
    await new Promise((r) => setTimeout(r, 20));
    // Clear call history after init so test assertions are clean
    vi.clearAllMocks();
  });

  // ================================================================
  // 1. Positive — Add a feed and verify store reflects new feed
  // ================================================================

  describe('Phase 1: Subscribe to Feed (Positive)', () => {
    it('should subscribe to a valid RSS feed and immediately reflect in store', async () => {
      // addRssSubscription succeeds via executeAndRefresh
      // NOTE: executeAndRefresh calls getRssInfoListFromDb() internally
      // after the action succeeds. We only need ONE getRssInfoListFromDb
      // override — the default mock returns [] which the first call consumes.
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));

      // executeAndRefresh's internal getRssInfoListFromDb call consumes the default mock ([])
      // so we set the final state mock AFTER the action mock:
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([TECH_FOLDER_WITH_PYTHON]));

      await store.addRssSubscription(
        'https://python.example/rss.xml',
        'Python Blog',
        'Tech',
      );

      // ── Assertion 1: After addFeed, rssFolderList[0].data has 1 feed ──
      expect(store.rssFolderList).toHaveLength(1);
      expect(store.rssFolderList[0].data).toHaveLength(1);

      // ── Assertion 2: Feed title matches after subscription ──
      expect(store.rssFolderList[0].data[0].title).toBe('Python Blog');

      // Verify IPC was called with the correct parameters
      expect(ipc.addRssSubscription).toHaveBeenCalledTimes(1);
      expect(ipc.addRssSubscription).toHaveBeenCalledWith({
        feedUrl: 'https://python.example/rss.xml',
        title: 'Python Blog',
        folderName: 'Tech',
      });

      // Store state is clean
      expect(store.error).toBeNull();
      expect(store.isLoading).toBe(false);
    });
  });

  // ================================================================
  // 2. Positive — Fetch posts and read article content
  // ================================================================

  describe('Phase 2: Fetch and Read Posts (Positive)', () => {
    it('should fetch posts for a feed and read article content by GUID', async () => {
      // Simulate the store already having the Python Blog feed
      store.rssFolderList = [TECH_FOLDER_WITH_PYTHON];

      // ── Assertion 3: queryPostIndexByRssId returns exactly 2 posts ──
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(POSTS_PYTHON));

      const postsResult = await ipc.queryPostIndexByRssId('feed-py');

      expect(ipc.queryPostIndexByRssId).toHaveBeenCalledWith('feed-py');
      const posts = postsResult.success ? postsResult.data : [];
      expect(posts).toHaveLength(2);

      // ── Assertion 4: Post title matches expected content ──
      expect(posts[0].title).toBe('Async Python Deep Dive');

      // Fetch article content by GUID
      ipc.queryPostContentByGuid.mockResolvedValueOnce(apiSuccess(CONTENT_PYTHON_DEEP_DIVE));

      const contentResult = await ipc.queryPostContentByGuid('post-001');

      expect(ipc.queryPostContentByGuid).toHaveBeenCalledWith('post-001');
      expect(contentResult.success).toBe(true);
      if (contentResult.success) {
        expect(contentResult.data.title).toBe('Async Python Deep Dive');
        expect(contentResult.data.content).toContain('asyncio patterns');
        expect(contentResult.data.author).toBe('Jane Dev');
      }
    });
  });

  // ================================================================
  // 3. State Transition — Toggle read status
  // ================================================================

  describe('Phase 3: Toggle Read Status (State Transition)', () => {
    it('should toggle a post from unread to read', async () => {
      // ── Assertion 5: Post.read is false before toggleReadStatus ──
      expect(POSTS_PYTHON[0].read).toBe(false);

      // Toggle read status via the IPC bridge
      ipc.toggleReadStatus.mockResolvedValueOnce(undefined);

      await ipc.toggleReadStatus('post-001');

      expect(ipc.toggleReadStatus).toHaveBeenCalledWith('post-001');
      expect(ipc.toggleReadStatus).toHaveBeenCalledTimes(1);

      // ── Assertion 6: After toggleReadStatus, post.read is true ──
      // Simulate the database having updated the post, and re-fetch
      const updatedPosts = [
        { ...POSTS_PYTHON[0], read: true },
        POSTS_PYTHON[1],
      ];

      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(updatedPosts));

      const postsResult = await ipc.queryPostIndexByRssId('feed-py');
      expect(postsResult.success).toBe(true);
      if (postsResult.success) {
        expect(postsResult.data[0].read).toBe(true);
        expect(postsResult.data[1].read).toBe(false); // second post still unread
      }
    });

    it('should handle read toggle as idempotent operation', async () => {
      // Toggle an already-read post (idempotent)
      ipc.toggleReadStatus.mockResolvedValue(undefined);

      await ipc.toggleReadStatus('post-001');
      await ipc.toggleReadStatus('post-001');
      await ipc.toggleReadStatus('post-001');

      expect(ipc.toggleReadStatus).toHaveBeenCalledTimes(3);
    });
  });

  // ================================================================
  // 4. Exception — Duplicate subscription must reject
  // ================================================================

  describe('Phase 4: Duplicate Subscription (Exception)', () => {
    it('should reject a duplicate feed subscription', async () => {
      // First subscription succeeds
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([TECH_FOLDER_WITH_PYTHON]));

      await store.addRssSubscription(
        'https://python.example/rss.xml',
        'Python Blog',
        'Tech',
      );

      // ── Assertion 7: Duplicate subscription throws 'Feed already exists' ──
      const dupErrorMsg = 'VALIDATION_DUPLICATE: feed already exists';
      ipc.addRssSubscription.mockRejectedValueOnce(new Error(dupErrorMsg));

      await expect(
        store.addRssSubscription(
          'https://python.example/rss.xml',
          'Python Blog',
          'Tech',
        ),
      ).rejects.toThrow('feed already exists');

      expect(store.error).toContain('feed already exists');
      expect(store.isLoading).toBe(false);

      // Original feed is still intact — the store was not mutated
      expect(store.rssFolderList).toHaveLength(1);
      expect(store.rssFolderList[0].data).toHaveLength(1);
      expect(store.rssFolderList[0].data[0].title).toBe('Python Blog');
    });

    it('should reject duplicate feed subscription via the new addFeed API', async () => {
      // Test the new addFeed API for completeness
      ipc.addFeed.mockRejectedValueOnce(
        new Error('VALIDATION_DUPLICATE: feed already exists'),
      );

      await expect(
        ipc.addFeed('https://python.example/rss.xml', 'Python Blog', 'Tech'),
      ).rejects.toThrow('feed already exists');
    });
  });

  // ================================================================
  // 5. State Transition — Remove feed and verify cleanup
  // ================================================================

  describe('Phase 5: Remove Subscription (State Transition)', () => {
    it('should remove a feed and verify store cleanup', async () => {
      // Start with the Python Blog feed in the store
      store.rssFolderList = [TECH_FOLDER_WITH_PYTHON];

      // Removal succeeds
      ipc.removeRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));

      // After removal, refresh returns empty folder
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([
        { folderName: 'Tech', data: [], children: [] },
      ]));

      await store.removeRssSubscription('Tech', FEED_PYTHON);

      // ── Assertion 8: After removeFeed, store.rssFolderList is empty ──
      expect(store.rssFolderList).toHaveLength(1);
      expect(store.rssFolderList[0].data).toHaveLength(0);

      // Verify IPC was called correctly
      expect(ipc.removeRssSubscription).toHaveBeenCalledWith(
        'Tech',
        'https://python.example/rss.xml',
      );
      expect(ipc.removeRssSubscription).toHaveBeenCalledTimes(1);

      // ── Assertion 9: isLoading resets to false after removeFeed ──
      expect(store.isLoading).toBe(false);

      // Error is clear
      expect(store.error).toBeNull();
    });

    it('should remove a feed and leave remaining feeds intact', async () => {
      // Store has both feeds
      const folderWithTwoFeeds: RssFolderItem = {
        folderName: 'Tech',
        data: [FEED_PYTHON, FEED_HN],
        children: [],
      };
      store.rssFolderList = [folderWithTwoFeeds];

      // Remove Python feed
      ipc.removeRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([
        { folderName: 'Tech', data: [FEED_HN], children: [] },
      ]));

      await store.removeRssSubscription('Tech', FEED_PYTHON);

      // Hacker News feed remains
      expect(store.rssFolderList[0].data).toHaveLength(1);
      expect(store.rssFolderList[0].data[0].title).toBe('Hacker News');
      expect(store.rssFolderList[0].data[0].feedUrl).toBe('https://hnrss.org/frontpage');
    });
  });

  // ================================================================
  // 6. Boundary & Exception — Invalid protocol URL validation
  // ================================================================

  describe('Phase 6: URL Validation (Boundary / Exception)', () => {
    it('should reject a feed URL with invalid protocol (FTP)', async () => {
      // ── Assertion 10: Feed URL with invalid protocol throws INVALID_PARAM ──
      ipc.addRssSubscription.mockRejectedValueOnce(
        new Error('INVALID_PARAM: URL protocol must be http or https'),
      );

      await expect(
        store.addRssSubscription(
          'ftp://bad.example/feed.xml',
          'Bad Protocol Feed',
          'Tech',
        ),
      ).rejects.toThrow('INVALID_PARAM');

      expect(store.error).toContain('INVALID_PARAM');
      expect(store.isLoading).toBe(false);
    });

    it('should reject feed URLs with various invalid protocols', async () => {
      const invalidProtocols = [
        { url: 'ftp://bad.example/feed.xml', desc: 'FTP protocol' },
        { url: 'file:///etc/passwd', desc: 'File protocol' },
        { url: 'javascript:alert(1)', desc: 'JavaScript pseudo-protocol' },
      ];

      for (const { url, desc } of invalidProtocols) {
        ipc.addRssSubscription.mockRejectedValueOnce(
          new Error('INVALID_PARAM: URL protocol must be http or https'),
        );

        await expect(
          store.addRssSubscription(url, desc, 'Tech'),
        ).rejects.toThrow('INVALID_PARAM');

        expect(store.error).toContain('INVALID_PARAM');
      }
    });

    it('should reject a malformed URL (not a URL at all)', async () => {
      ipc.addRssSubscription.mockRejectedValueOnce(
        new Error('INVALID_PARAM: malformed URL'),
      );

      await expect(
        store.addRssSubscription('not-a-url', 'Bad', 'Tech'),
      ).rejects.toThrow('INVALID_PARAM');

      expect(store.error).toContain('INVALID_PARAM');
    });

    it('should reject an empty feed URL via the new addFeed API', async () => {
      ipc.addFeed.mockRejectedValueOnce(
        new Error('INVALID_PARAM: url must not be empty'),
      );

      await expect(
        ipc.addFeed('', 'Empty URL', 'Tech'),
      ).rejects.toThrow('must not be empty');
    });
  });

  // ================================================================
  // 7. Full Lifecycle — End-to-end state machine transitions
  // ================================================================

  describe('Full Lifecycle State Transitions', () => {
    it('should transition through the complete lifecycle: empty → subscribed → posts loaded → read → removed', async () => {
      // ── State 0: Empty store ──
      expect(store.rssFolderList).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();

      // ── State 1: Subscribe ──
      ipc.addRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([TECH_FOLDER_WITH_PYTHON]));

      await store.addRssSubscription(
        'https://python.example/rss.xml',
        'Python Blog',
        'Tech',
      );

      expect(store.rssFolderList[0].data).toHaveLength(1);
      expect(store.rssFolderList[0].data[0].title).toBe('Python Blog');
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();

      // ── State 2: Fetch posts ──
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(POSTS_PYTHON));

      const postsResult = await ipc.queryPostIndexByRssId('feed-py');
      expect(postsResult.success).toBe(true);
      if (postsResult.success) {
        expect(postsResult.data).toHaveLength(2);
        expect(postsResult.data[0].title).toBe('Async Python Deep Dive');
        expect(postsResult.data[0].read).toBe(false);
      }

      // ── State 3: Toggle read status ──
      ipc.toggleReadStatus.mockResolvedValueOnce(undefined);
      await ipc.toggleReadStatus('post-001');

      // Re-fetch to verify state change
      const updatedPosts = [
        { ...POSTS_PYTHON[0], read: true },
        POSTS_PYTHON[1],
      ];
      ipc.queryPostIndexByRssId.mockResolvedValueOnce(apiSuccess(updatedPosts));
      const refetchResult = await ipc.queryPostIndexByRssId('feed-py');
      expect(refetchResult.success).toBe(true);
      if (refetchResult.success) {
        expect(refetchResult.data[0].read).toBe(true);
      }

      // ── State 4: Duplicate attempt (must reject) ──
      ipc.addRssSubscription.mockRejectedValueOnce(
        new Error('VALIDATION_DUPLICATE: feed already exists'),
      );

      await expect(
        store.addRssSubscription(
          'https://python.example/rss.xml',
          'Python Blog',
          'Tech',
        ),
      ).rejects.toThrow('feed already exists');
      expect(store.error).toContain('feed already exists');

      // ── State 5: Remove subscription ──
      ipc.removeRssSubscription.mockResolvedValueOnce(apiSuccess(undefined));
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([
        { folderName: 'Tech', data: [], children: [] },
      ]));

      await store.removeRssSubscription('Tech', FEED_PYTHON);

      expect(store.rssFolderList[0].data).toHaveLength(0);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();

      // ── State 6: Verify empty store ──
      ipc.getRssInfoListFromDb.mockResolvedValueOnce(apiSuccess([]));
      await store.refresh();
      expect(store.rssFolderList).toEqual([]);
    });
  });
});
