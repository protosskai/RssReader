/**
 * Favorites E2E Tests — Favorite/Unfavorite Toggle and Bulk Clear.
 *
 * Covers: Flow 3 – Favorites
 * Techniques: state_transition, boundary, exception, positive
 *
 * Scenario: Favorite state machine on normal post (false→true→false)
 * with idempotency verification, boundary-value titles (500-char, CJK,
 * emoji, XSS), and clearAllFavorites → empty state enforcement.
 *
 * Each test follows the store-action pattern: mock IPC → invoke store
 * action → assert on returned value AND on store state (favoritePosts,
 * favoriteCount, error).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFavoriteStore } from '../../src/stores/favoriteStore';
import {
  createIpcMock,
  installIpcMock,
  makePostIndexItem,
  type IpcMock,
} from '../__mocks__/factories';
import type { PostIndexItem } from 'src/common/models';

// -----------------------------------------------------------------------
// Fixtures — PostIndexItem factory + scenario-specific posts
// -----------------------------------------------------------------------

/**
 * Helper: create a PostIndexItem that DeepReadonly won't wrap.
 * Returns a plain object matching the PostIndexItem interface.
 */
function fixturePost(overrides: Partial<PostIndexItem> & { guid: string }): PostIndexItem {
  return {
    title: 'default title',
    link: 'https://example.com/default',
    author: 'Default Author',
    updateTime: '2024-06-10 08:00:00',
    read: false,
    desc: 'Default description...',
    rssId: 'feed-default',
    ...overrides,
  };
}

/** Scenario-specific fixture posts — see scenario spec. */
const FIXTURES = {
  /** Normal / positive control */
  normal: fixturePost({
    title: 'Understanding Quarks',
    guid: 'guid-quarks',
    link: 'https://science.example/quarks',
    author: 'Dr. Particle',
    updateTime: '2024-06-10 08:00:00',
    read: false,
    desc: 'Deep dive into particle physics...',
    rssId: 'feed-sci',
  }),
  /** CJK / multi-script title (boundary) */
  cjk: fixturePost({
    title: '日本語のタイトル — 测试文章标题 — 한국어 제목',
    guid: 'guid-cjk',
    link: 'https://example.com/cjk',
    author: '多语言作者',
    updateTime: '2024-06-11 12:30:00',
    read: true,
    desc: '多语言内容测试...',
    rssId: 'feed-test',
  }),
  /** Emoji / special-character title (boundary) */
  emoji: fixturePost({
    title: '🔥🚀 Latest News — Breaking! 📰✨',
    guid: 'guid-emoji',
    link: 'https://example.com/emoji-news',
    author: 'News Bot',
    updateTime: '2024-06-12 16:45:00',
    read: false,
    desc: 'Emoji-heavy title test...',
    rssId: 'feed-test',
  }),
  /** 500-char title (boundary – long text overflow) */
  longTitle: fixturePost({
    title: 'A'.repeat(500),
    guid: 'guid-long-title',
    link: 'https://example.com/very-long-title',
    author: 'Long Author',
    updateTime: '2024-06-13 07:00:00',
    read: false,
    desc: 'Article with very long title...',
    rssId: 'feed-test',
  }),
  /** HTML-escaped title (boundary – XSS / injection) */
  xss: fixturePost({
    title: '<script>alert(\'xss\')</script>',
    guid: 'guid-xss',
    link: 'https://example.com/xss-test',
    author: 'Hacker',
    updateTime: '2024-06-14 10:00:00',
    read: false,
    desc: 'HTML escaped title...',
    rssId: 'feed-test',
  }),
};

describe('Favorite/Unfavorite Toggle and Bulk Clear', () => {
  let ipc: IpcMock;
  let store: ReturnType<typeof useFavoriteStore>;

  beforeEach(() => {
    setActivePinia(createPinia());

    ipc = createIpcMock();

    // configureFavoriteLookup ipc for getFavoritePosts/isPostFavorite
    // so they return [] / false unless a specific test overrides.
    ipc.getFavoritePosts.mockResolvedValue([]);
    ipc.isPostFavorite.mockResolvedValue(false);
    ipc.addFavoritePost.mockResolvedValue(undefined);
    ipc.removeFavoritePost.mockResolvedValue(undefined);

    installIpcMock(ipc);
    store = useFavoriteStore();
  });

  // ====================================================================
  // 1) POSITIVE — happy path: toggle favorite on a normal post
  // ====================================================================

  describe('Positive — normal post favorite toggle', () => {
    it('should start with empty favoritePosts (assertion: count=0)', () => {
      expect(store.favoritePosts).toHaveLength(0);
      expect(store.favoriteCount).toBe(0);
    });

    it('should return favorited=true for an un-favorited post (assertion: boolean=true)', async () => {
      const post = FIXTURES.normal;

      // isPostFavorite returns false → store sees "not yet favorited"
      // Add succeeds
      const result = await store.toggleFavorite(post);

      expect(result).toEqual({ favorited: true });
      expect(ipc.isPostFavorite).toHaveBeenCalledWith(post.guid);
      expect(ipc.addFavoritePost).toHaveBeenCalledWith(
        expect.objectContaining({ guid: 'guid-quarks', isFavorite: true }),
      );
      expect(ipc.removeFavoritePost).not.toHaveBeenCalled();
    });

    it('should store 1 post after first favorite (assertion: count=1)', async () => {
      const post = FIXTURES.normal;

      await store.toggleFavorite(post);

      expect(store.favoritePosts).toHaveLength(1);
      expect(store.favoritePosts[0].guid).toBe('guid-quarks');
      expect(store.favoritePosts[0].title).toBe('Understanding Quarks');
    });

    it('should show favoriteCount=1 after adding one favorite (assertion: count=1)', async () => {
      const post = FIXTURES.normal;

      await store.toggleFavorite(post);

      expect(store.favoriteCount).toBe(1);
    });
  });

  // ====================================================================
  // 2) STATE TRANSITION — false → true → false plus idempotency
  // ====================================================================

  describe('State transition — false→true→false with idempotency', () => {
    it('should transition not-favorited → favorited (toggle #1)', async () => {
      const post = FIXTURES.normal;

      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);

      const result = await store.toggleFavorite(post);

      expect(result.favorited).toBe(true);
      expect(store.favoritePosts).toHaveLength(1);
    });

    it('should transition favorited → not-favorited on second toggle (assertion: boolean=false)', async () => {
      const post = FIXTURES.normal;

      // First toggle: not-favorited → favorited
      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);
      await store.toggleFavorite(post);

      // Second toggle: favorited → not-favorited
      ipc.isPostFavorite.mockResolvedValueOnce(true);
      ipc.removeFavoritePost.mockResolvedValueOnce(undefined);
      const result = await store.toggleFavorite(post);

      expect(result).toEqual({ favorited: false });
      expect(ipc.removeFavoritePost).toHaveBeenCalledWith('guid-quarks');
      expect(ipc.addFavoritePost).toHaveBeenCalledTimes(1); // not called again
    });

    it('should return to 0 posts after unfavorite (assertion: count=0)', async () => {
      const post = FIXTURES.normal;

      // Not-favorited → favorited
      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);
      await store.toggleFavorite(post);

      // Favorited → not-favorited
      ipc.isPostFavorite.mockResolvedValueOnce(true);
      ipc.removeFavoritePost.mockResolvedValueOnce(undefined);
      await store.toggleFavorite(post);

      expect(store.favoritePosts).toHaveLength(0);
      expect(store.favoriteCount).toBe(0);
    });

    it('should be idempotent: toggle + toggle returns to original state', async () => {
      const post = FIXTURES.normal;

      // t0: not favorited
      expect(store.favoriteCount).toBe(0);

      // t1: favorite
      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);
      const addResult = await store.toggleFavorite(post);
      expect(addResult.favorited).toBe(true);
      expect(store.favoriteCount).toBe(1);

      // t2: unfavorite
      ipc.isPostFavorite.mockResolvedValueOnce(true);
      ipc.removeFavoritePost.mockResolvedValueOnce(undefined);
      const removeResult = await store.toggleFavorite(post);
      expect(removeResult.favorited).toBe(false);
      expect(store.favoriteCount).toBe(0);

      // t3: re-add — should work again (idempotent cycle)
      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);
      const reAddResult = await store.toggleFavorite(post);
      expect(reAddResult.favorited).toBe(true);
      expect(store.favoriteCount).toBe(1);
    });
  });

  // ====================================================================
  // 3) BOUNDARY — emoji, CJK, 500-char, XSS titles
  // ====================================================================

  describe('Boundary — special title preservation', () => {
    it('should preserve emoji title in favorite list (assertion: text)', async () => {
      const post = FIXTURES.emoji;

      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);

      await store.toggleFavorite(post);

      expect(store.favoritePosts).toHaveLength(1);
      expect(store.favoritePosts[0].title).toBe(
        '🔥🚀 Latest News — Breaking! 📰✨',
      );
    });

    it('should preserve CJK title in favorite list (assertion: text)', async () => {
      const post = FIXTURES.cjk;

      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);

      await store.toggleFavorite(post);

      expect(store.favoritePosts).toHaveLength(1);
      expect(store.favoritePosts[0].title).toBe(
        '日本語のタイトル — 测试文章标题 — 한국어 제목',
      );
    });

    it('should preserve 500-character title', async () => {
      const post = FIXTURES.longTitle;

      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);

      await store.toggleFavorite(post);

      expect(store.favoritePosts).toHaveLength(1);
      expect(store.favoritePosts[0].title).toHaveLength(500);
      expect(store.favoritePosts[0].title).toBe('A'.repeat(500));
    });

    it('should preserve HTML-escaped title without rendering', async () => {
      const post = FIXTURES.xss;

      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);

      await store.toggleFavorite(post);

      expect(store.favoritePosts).toHaveLength(1);
      expect(store.favoritePosts[0].title).toBe(
        '<script>alert(\'xss\')</script>',
      );
      // Title should NOT be decoded or sanitized — stored as-is
      expect(store.favoritePosts[0].title).not.toContain('＞');
      expect(store.favoritePosts[0].title).not.toContain('&lt;');
    });

    it('should favorite 3 boundary posts then show length=3 (assertion: count=3)', async () => {
      // Arrange: 3 boundary posts — emoji, CJK, 500-char
      for (const post of [FIXTURES.emoji, FIXTURES.cjk, FIXTURES.longTitle]) {
        ipc.isPostFavorite.mockResolvedValueOnce(false);
        ipc.addFavoritePost.mockResolvedValueOnce(undefined);
        await store.toggleFavorite(post);
      }

      expect(store.favoritePosts).toHaveLength(3);
      expect(store.favoriteCount).toBe(3);

      // Verify all three titles are in the list
      const titles = store.favoritePosts.map((p) => p.title);
      expect(titles).toContain('🔥🚀 Latest News — Breaking! 📰✨');
      expect(titles).toContain('日本語のタイトル — 测试文章标题 — 한국어 제목');
      expect(titles).toContain('A'.repeat(500));
    });
  });

  // ====================================================================
  // 4) BULK CLEAR — clearAllFavorites → empty state
  // ====================================================================

  describe('Bulk clear — clearAllFavorites', () => {
    it('should clear all favorites and leave empty list (assertion: count=0)', async () => {
      // Populate with 3 boundary posts
      for (const post of [FIXTURES.emoji, FIXTURES.cjk, FIXTURES.longTitle]) {
        ipc.isPostFavorite.mockResolvedValueOnce(false);
        ipc.addFavoritePost.mockResolvedValueOnce(undefined);
        await store.toggleFavorite(post);
      }

      expect(store.favoritePosts).toHaveLength(3);
      expect(store.favoriteCount).toBe(3);

      // Clear all (mock remove succeeds for all 3)
      await store.clearAllFavorites();

      expect(store.favoritePosts).toHaveLength(0);
      expect(store.favoriteCount).toBe(0);
      expect(ipc.removeFavoritePost).toHaveBeenCalledTimes(3);
      expect(ipc.removeFavoritePost).toHaveBeenCalledWith('guid-emoji');
      expect(ipc.removeFavoritePost).toHaveBeenCalledWith('guid-cjk');
      expect(ipc.removeFavoritePost).toHaveBeenCalledWith('guid-long-title');
    });

    it('should handle clearAllFavorites when list is already empty', async () => {
      expect(store.favoritePosts).toHaveLength(0);

      await store.clearAllFavorites();

      expect(ipc.removeFavoritePost).not.toHaveBeenCalled();
      expect(store.favoritePosts).toHaveLength(0);
      expect(store.favoriteCount).toBe(0);
    });
  });

  // ====================================================================
  // 5) EXCEPTION — error handling
  // ====================================================================

  describe('Exception — error handling', () => {
    it('should handle IPC failure when checking favorite status', async () => {
      const post = FIXTURES.normal;

      ipc.isPostFavorite.mockRejectedValueOnce(new Error('IPC channel error'));
      // Fallback: store checks local state (empty), tries to add
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);

      const result = await store.toggleFavorite(post);

      // Falls back to local check (not in list → not favorited), adds
      expect(result.favorited).toBe(true);
      expect(store.favoritePosts).toHaveLength(1);
    });

    it('should propagate addFavoritePost IPC failure', async () => {
      const post = FIXTURES.normal;

      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockRejectedValueOnce(new Error('DB write failure'));

      await expect(store.toggleFavorite(post)).rejects.toThrow('DB write failure');

      // Post should NOT be added to local state
      expect(store.favoritePosts).toHaveLength(0);
    });

    it('should propagate removeFavoritePost IPC failure', async () => {
      const post = FIXTURES.normal;

      // First toggle: add
      ipc.isPostFavorite.mockResolvedValueOnce(false);
      ipc.addFavoritePost.mockResolvedValueOnce(undefined);
      await store.toggleFavorite(post);
      expect(store.favoritePosts).toHaveLength(1);

      // Second toggle: remove → fails
      ipc.isPostFavorite.mockResolvedValueOnce(true);
      ipc.removeFavoritePost.mockRejectedValueOnce(new Error('DB delete error'));

      await expect(store.toggleFavorite(post)).rejects.toThrow('DB delete error');

      // Post should remain in local state because the IPC call failed
      expect(store.favoritePosts).toHaveLength(1);
    });

    it('should handle clearAllFavorites partial failure', async () => {
      // Populate 3 posts
      for (const post of [FIXTURES.normal, FIXTURES.emoji, FIXTURES.cjk]) {
        ipc.isPostFavorite.mockResolvedValueOnce(false);
        ipc.addFavoritePost.mockResolvedValueOnce(undefined);
        await store.toggleFavorite(post);
      }
      expect(store.favoritePosts).toHaveLength(3);

      // Second remove fails
      ipc.removeFavoritePost
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('partial clear failure'))
        .mockResolvedValueOnce(undefined);

      await expect(store.clearAllFavorites()).rejects.toThrow('partial clear failure');

      expect(store.error).toBe('partial clear failure');
    });
  });
});
