/**
 * Test factories — reusable mock data and IPC mocks for all test suites.
 *
 * IMPORTANT: Tests should use these factories instead of crafting ad-hoc
 * mock data. This ensures consistency across test files and makes
 * refactoring easier when data models change.
 */

import { vi } from 'vitest';
import type { ElectronContract } from 'src/common/electronContract';
import type { ApiResponse } from 'src/common/ErrorMsg';
import type { RssFolderItem, RssInfoItem, PostIndexItem, ContentInfo } from 'src/common/models';

// ------------------------------------------------------------------
// Mock IPC — typesafe, resettable, and configurable per-test.
// ------------------------------------------------------------------

export type IpcMock = {
  [K in keyof ElectronContract]: ReturnType<typeof vi.fn>;
};

/**
 * Create a fully-mocked ElectronContract with all methods as vi.fn().
 */
export function createIpcMock(): IpcMock {
  return {
    // Legacy RSS
    addRssSubscription: vi.fn(),
    removeRssSubscription: vi.fn(),
    queryPostContentByGuid: vi.fn(),
    importOpmlFile: vi.fn(),
    fetchRssIndexList: vi.fn(),
    queryPostIndexByRssId: vi.fn(),
    getRssInfoListFromDb: vi.fn().mockResolvedValue(
      apiSuccess([]),
    ),
    dumpFolderToDb: vi.fn(),
    loadFolderFromDb: vi.fn(),
    // Window & system
    openLink: vi.fn(),
    close: vi.fn(),
    minimize: vi.fn(),
    // Legacy folders
    addFolder: vi.fn(),
    editFolder: vi.fn(),
    removeFolder: vi.fn(),
    // Article
    getArticles: vi.fn(),
    getArticle: vi.fn(),
    toggleReadStatus: vi.fn(),
    toggleFavorite: vi.fn(),
    markAllAsRead: vi.fn(),
    clearAllFavorites: vi.fn(),
    getArticleStats: vi.fn().mockResolvedValue({
      totalArticles: 0,
      unreadCount: 0,
      favoriteCount: 0,
      feedCount: 0,
      folderCount: 0,
    }),
    // Feed
    getFeeds: vi.fn(),
    getFeed: vi.fn(),
    addFeed: vi.fn(),
    removeFeed: vi.fn(),
    syncFeed: vi.fn(),
    // Folder v2
    getFolders: vi.fn(),
    getFolder: vi.fn(),
    addFolderV2: vi.fn(),
    removeFolderV2: vi.fn(),
    renameFolder: vi.fn(),
    // Favorites
    getFavoritePosts: vi.fn().mockResolvedValue([]),
    addFavoritePost: vi.fn(),
    removeFavoritePost: vi.fn(),
    isPostFavorite: vi.fn().mockResolvedValue(false),
    // Sync
    syncGetConfig: vi.fn(),
    syncUpdateConfig: vi.fn(),
    syncStart: vi.fn(),
    syncGetStatus: vi.fn(),
    syncStartAuto: vi.fn(),
    syncStopAuto: vi.fn(),
    // Search
    searchPosts: vi.fn().mockResolvedValue(apiSuccess([])),
  };
}

/**
 * Mock window.electronAPI with a given IpcMock.
 * Call in beforeEach to set up fresh mocks.
 */
export function installIpcMock(mock: IpcMock): void {
  vi.stubGlobal('electronAPI', mock);
}

// ------------------------------------------------------------------
// API response helpers — build ApiResponse<T> payloads.
// ------------------------------------------------------------------

export function apiSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data } as ApiResponse<T>;
}

export function apiError(code: string, message: string): ApiResponse<never> {
  return {
    success: false,
    error: { code, message },
  } as ApiResponse<never>;
}

// ------------------------------------------------------------------
// Data factories — realistic mock data for all entities.
// ------------------------------------------------------------------

export function makeRssInfoItem(overrides?: Partial<RssInfoItem>): RssInfoItem {
  return {
    id: 'feed-001',
    title: 'Example Feed',
    unread: 5,
    htmlUrl: 'https://example.com',
    feedUrl: 'https://example.com/rss.xml',
    avatar: '',
    lastUpdateTime: '2024-01-15 10:30:00',
    ...overrides,
  };
}

export function makeRssFolderItem(overrides?: Partial<RssFolderItem>): RssFolderItem {
  return {
    folderName: 'Test Folder',
    data: [
      makeRssInfoItem({ id: 'feed-001', title: 'Example Feed', unread: 5 }),
      makeRssInfoItem({ id: 'feed-002', title: 'Another Feed', unread: 0, feedUrl: 'https://other.example/rss' }),
    ],
    children: [],
    ...overrides,
  };
}

export function makePostIndexItem(overrides?: Partial<PostIndexItem>): PostIndexItem {
  return {
    title: 'Test Article Title',
    guid: 'abc123-guid',
    link: 'https://example.com/articles/test',
    author: 'Test Author',
    updateTime: '2024-01-15 10:30:00',
    read: false,
    desc: 'This is a short description of the test article...',
    rssId: 'feed-001',
    ...overrides,
  };
}

export function makePostIndexItems(count: number, overrides?: Partial<PostIndexItem>): PostIndexItem[] {
  return Array.from({ length: count }, (_, i) =>
    makePostIndexItem({
      title: `Article ${i + 1}`,
      guid: `guid-${i + 1}`,
      link: `https://example.com/articles/${i + 1}`,
      read: i % 3 === 0, // every 3rd article is read
      ...overrides,
    }),
  );
}

export function makeContentInfo(overrides?: Partial<ContentInfo>): ContentInfo {
  return {
    title: 'Test Article Title',
    content: '<p>Full article HTML content goes here...</p><p>Second paragraph.</p>',
    link: 'https://example.com/articles/test',
    author: 'Test Author',
    updateTime: '2024-01-15 10:30:00',
    rssId: 'feed-001',
    read: 0,
    favorite: 0,
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Edge-case data — for boundary value and error state testing.
// ------------------------------------------------------------------

export const EDGE_CASES = {
  /** Very long strings (256+ chars) for overflow boundary testing */
  VERY_LONG_TITLE: 'A'.repeat(500),
  VERY_LONG_URL: `https://example.com/${'a'.repeat(2000)}`,
  /** Strings with special HTML/XML characters */
  HTML_ESCAPE_CHARS: '<script>alert("xss")</script>',
  XML_SPECIAL_CHARS: '&lt;div&gt;escaped&lt;/div&gt;',
  /** Unicode / CJK */
  CJK_TITLE: '日本語のタイトル — 测试文章标题 — 한국어 제목',
  EMOJI_TITLE: '🔥🚀 Latest News — Breaking! 📰✨',
  /** Zero-length / boundary */
  EMPTY_STRING: '',
  WHITESPACE_ONLY: '   \t\n  ',
  /** Invalid / malformed */
  NOT_A_URL: 'not-a-url-at-all',
  INVALID_FEED_URL: 'ftp://invalid-protocol.example/feed.xml',
  MALFORMED_XML: '<rss><channel><title>Broken</channel></rss>',
  /** SQL injection attempt (should be neutralized by parameterized queries) */
  SQL_INJECTION: "'; DROP TABLE post_info; --",
};

// ------------------------------------------------------------------
// Multi-folder / multi-feed scenarios — for integration tests.
// ------------------------------------------------------------------

export function makeFolderTree(): RssFolderItem[] {
  return [
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
}
