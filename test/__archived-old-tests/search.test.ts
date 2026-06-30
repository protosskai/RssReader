/**
 * Search E2E Tests — Local Substring, Global FTS, History, Abort
 *
 * Scenario: Search — Local Substring, Global FTS, History, Abort
 * Methods: equivalence_class, boundary, state_transition, exception
 *
 * Covers:
 *   - Local substring search: exact match, partial, no match, CJK, emoji
 *   - Global FTS5 search via IPC (searchPosts)
 *   - Mixed search with folder filter
 *   - Empty query (no-op)
 *   - Single-character search (boundary: 'a')
 *   - Search history tracking (last 10, dedup, persist)
 *   - Abort controller: rapid double-call, only second completes
 *   - State transitions: idle → loading → results / error → clear
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSearchStore } from '../../src/stores/searchStore';
import {
  createIpcMock,
  installIpcMock,
  apiSuccess,
  makePostIndexItem,
  type IpcMock,
} from '../__mocks__/factories';
import type { PostIndexItem } from 'src-electron/storage/common';

// ------------------------------------------------------------------
// Scenario fixtures
// ------------------------------------------------------------------

const FIXTURE_POSTS: PostIndexItem[] = [
  makePostIndexItem({
    title: 'Async Python Deep Dive',
    guid: 's-guid-1',
    link: 'https://py.example/1',
    author: 'Jane',
    updateTime: '2024-06-15 10:00:00',
    read: false,
    desc: 'Python concurrency patterns with asyncio, trio, and anyio',
    rssId: 'feed-py',
  }),
  makePostIndexItem({
    title: 'Rust Async/Await Tutorial',
    guid: 's-guid-2',
    link: 'https://rs.example/1',
    author: 'Alice',
    updateTime: '2024-06-14 09:00:00',
    read: true,
    desc: 'Learn async Rust from scratch',
    rssId: 'feed-rs',
  }),
  makePostIndexItem({
    title: 'Go Channels Deep Dive',
    guid: 's-guid-3',
    link: 'https://go.example/1',
    author: 'Bob',
    updateTime: '2024-06-13 08:00:00',
    read: false,
    desc: 'Understanding goroutines and channels',
    rssId: 'feed-go',
  }),
  makePostIndexItem({
    title: '日本語のプログラミング記事',
    guid: 's-guid-4',
    link: 'https://jp.example/1',
    author: '太郎',
    updateTime: '2024-06-12 07:00:00',
    read: false,
    desc: '日本発のプログラミング情報',
    rssId: 'feed-jp',
  }),
  makePostIndexItem({
    title: '🔥 Best Practices 2024',
    guid: 's-guid-5',
    link: 'https://ex.example/1',
    author: 'News',
    updateTime: '2024-06-11 06:00:00',
    read: false,
    desc: 'Top 10 best practices',
    rssId: 'feed-test',
  }),
];

// ------------------------------------------------------------------
// Test suite
// ------------------------------------------------------------------

describe('Search — Local Substring, Global FTS, History, Abort', () => {
  let ipc: IpcMock;
  let store: ReturnType<typeof useSearchStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    ipc = createIpcMock();
    installIpcMock(ipc);
    store = useSearchStore();

    // Let store init settle, then fully reset
    await new Promise((r) => setTimeout(r, 20));
    store.$reset();
    store.clearSearch();
    store.clearSearchHistory();
    vi.clearAllMocks();
    localStorage.clear();
    store.clearSearch();
    store.clearSearchHistory();
  });

  afterEach(() => {
    store.$reset();
    localStorage.clear();
  });

  // ================================================================
  // 1. LOCAL SUBSTRING SEARCH — equivalence_class
  // ================================================================

  describe('Local Substring Search (equivalence_class)', () => {
    it('should return 2 posts for "Async" (both Python and Rust titles)', async () => {
      await store.search('Async', FIXTURE_POSTS);

      // Both 'Async Python Deep Dive' and 'Rust Async/Await Tutorial' contain 'Async'
      expect(store.searchResults).toHaveLength(2);
      const titles = store.searchResults.map((p) => p.title).sort();
      expect(titles).toEqual(['Async Python Deep Dive', 'Rust Async/Await Tutorial']);
      expect(store.hasResults).toBe(true);
    });

    it('should return exactly 1 post for no-conflict query "Python"', async () => {
      await store.search('Python', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].title).toBe('Async Python Deep Dive');
      expect(store.searchResults[0].guid).toBe('s-guid-1');
    });

    it('should return 2 posts for case-insensitive "async" (Python + Rust)', async () => {
      await store.search('async', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(2);
      const titles = store.searchResults.map((p) => p.title).sort();
      expect(titles).toEqual(['Async Python Deep Dive', 'Rust Async/Await Tutorial']);
    });

    it('should match partial substring in description', async () => {
      await store.search('asyncio', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-1');
    });

    it('should match by author field', async () => {
      await store.search('Alice', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-2');
    });

    it('should handle no results for a query with no match', async () => {
      await store.search('ZZZZZ', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(0);
      expect(store.hasResults).toBe(false);
    });

    it('should return empty results for whitespace-only query', async () => {
      await store.search('   ', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(0);
      expect(store.isSearching).toBe(false);
    });

    it('should match CJK characters in title', async () => {
      await store.search('日本語', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-4');
    });

    it('should match CJK characters in description', async () => {
      await store.search('プログラミング', FIXTURE_POSTS);

      // Only s-guid-4 has 'プログラミング' in its description field
      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-4');
    });

    it('should match emoji characters in query', async () => {
      await store.search('🔥', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-5');
    });

    it('should handle single-character boundary "a"', async () => {
      await store.search('a', FIXTURE_POSTS);

      // 'a' appears in titles, authors, and descriptions of multiple posts
      expect(store.searchResults.length).toBeGreaterThanOrEqual(1);
      expect(store.isSearching).toBe(false);
    });

    it('should handle empty query as no-op', async () => {
      await store.search('', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(0);
      expect(store.searchError).toBeNull();
    });

    it('should match by tag/term in desc field (goroutines)', async () => {
      await store.search('goroutines', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-3');
      expect(store.searchResults[0].title).toBe('Go Channels Deep Dive');
    });

    it('should be case-insensitive across all searchable fields', async () => {
      await store.search('CONCURRENCY', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-1');
    });

    it('should handle regex special characters as literal strings', async () => {
      // .includes() treats regex chars literally
      await store.search('(async)', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(0); // no title/author/desc has "(async)"
    });

    it('should set isSearching to false after completion', async () => {
      expect(store.isSearching).toBe(false);

      await store.search('Async', FIXTURE_POSTS);

      expect(store.isSearching).toBe(false);
    });
  });

  // ================================================================
  // 2. GLOBAL FTS SEARCH VIA IPC — exception / equivalence_class
  // ================================================================

  describe('Global FTS via IPC', () => {
    it('should call searchPosts on IPC and return results', async () => {
      const ftsResults: PostIndexItem[] = [
        makePostIndexItem({
          title: 'Go Channels Deep Dive',
          guid: 's-guid-3',
        }),
      ];
      ipc.searchPosts.mockResolvedValueOnce(apiSuccess(ftsResults));

      await store.search('goroutines', []);

      expect(ipc.searchPosts).toHaveBeenCalledTimes(1);
      expect(ipc.searchPosts).toHaveBeenCalledWith('goroutines', undefined);
      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].title).toBe('Go Channels Deep Dive');
    });

    it('should pass folderId filter to global search', async () => {
      ipc.searchPosts.mockResolvedValueOnce(apiSuccess([]));

      await store.search('python', [], { folderId: 'feed-py' });

      expect(ipc.searchPosts).toHaveBeenCalledWith('python', {
        folderId: 'feed-py',
      });
    });

    it('should pass date range filters to global search', async () => {
      ipc.searchPosts.mockResolvedValueOnce(apiSuccess([]));

      await store.search('async', [], {
        dateFrom: '2024-06-01',
        dateTo: '2024-06-30',
      });

      expect(ipc.searchPosts).toHaveBeenCalledWith('async', {
        dateFrom: '2024-06-01',
        dateTo: '2024-06-30',
      });
    });

    it('should pass limit option to global search', async () => {
      ipc.searchPosts.mockResolvedValueOnce(apiSuccess([]));

      await store.search('test', [], { limit: 5 });

      expect(ipc.searchPosts).toHaveBeenCalledWith('test', { limit: 5 });
    });

    it('should handle FTS returning an empty result set', async () => {
      ipc.searchPosts.mockResolvedValueOnce(apiSuccess([]));

      await store.search('nonexistent_fts_term', []);

      expect(ipc.searchPosts).toHaveBeenCalledTimes(1);
      expect(store.searchResults).toHaveLength(0);
      expect(store.searchError).toBeNull();
      expect(store.isSearching).toBe(false);
    });

    it('should handle IPC network failure', async () => {
      ipc.searchPosts.mockRejectedValueOnce(new Error('NETWORK_TIMEOUT'));

      await store.search('keyword', []);

      expect(store.isSearching).toBe(false);
      expect(store.searchError).toBe('NETWORK_TIMEOUT');
      expect(store.searchResults).toEqual([]);
    });

    it('should handle IPC returning an apiError response', async () => {
      ipc.searchPosts.mockRejectedValueOnce(
        new Error('DATABASE_ERROR: FTS index corrupted'),
      );

      await store.search('test', []);

      expect(store.searchError).toBe('DATABASE_ERROR: FTS index corrupted');
      expect(store.hasResults).toBe(false);
    });

    it('should handle a non-Error thrown from searchPosts', async () => {
      ipc.searchPosts.mockRejectedValueOnce('plain string');

      await store.search('keyword', []);

      expect(store.searchError).toBe('搜索失败');
    });
  });

  // ================================================================
  // 3. ABORT CONTROLLER — exception / state_transition
  // ================================================================

  describe('Abort Controller — rapid double-call', () => {
    it('should cancel first search when second is called rapidly (second completes)', async () => {
      // First search: starts but takes long
      ipc.searchPosts.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new DOMException('Aborted', 'AbortError')),
              100,
            ),
          ),
      );

      // Fire first search (don't await yet)
      const firstPromise = store.search('first', []);

      // Second search resolves immediately
      ipc.searchPosts.mockResolvedValueOnce(
        apiSuccess([
          makePostIndexItem({ title: 'Second Result', guid: 'g-second' }),
        ]),
      );

      await store.search('second', []);

      // First promise should resolve without throwing (AbortError is swallowed)
      await firstPromise;

      // Results should be from second search
      expect(store.searchQuery).toBe('second');
      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('g-second');
      expect(store.searchError).toBeNull();
    });

    it('should handle three rapid searches — only last one wins', async () => {
      // First: slow
      ipc.searchPosts.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new DOMException('Aborted', 'AbortError')),
              100,
            ),
          ),
      );
      // Second: medium
      ipc.searchPosts.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new DOMException('Aborted', 'AbortError')),
              50,
            ),
          ),
      );
      // Third: fast (this one should win)
      ipc.searchPosts.mockResolvedValueOnce(
        apiSuccess([
          makePostIndexItem({ title: 'Third Result', guid: 'g-third' }),
        ]),
      );

      const p1 = store.search('first', []);
      const p2 = store.search('second', []);
      await store.search('third', []);

      await p1;
      await p2;

      expect(store.searchQuery).toBe('third');
      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('g-third');
      expect(store.searchError).toBeNull();
    });

    it('should set isSearching to false after aborted search', async () => {
      ipc.searchPosts.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new DOMException('Aborted', 'AbortError')),
              100,
            ),
          ),
      );

      const p1 = store.search('first', []);
      ipc.searchPosts.mockResolvedValueOnce(apiSuccess([]));
      await store.search('second', []);
      await p1;

      expect(store.isSearching).toBe(false);
    });

    it('should handle abort during local search (no IPC involved)', async () => {
      // Local search is synchronous and doesn't use IPC — it should complete
      // immediately even without abort concerns
      await store.search('Python', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-1');
      expect(store.isSearching).toBe(false);
    });
  });

  // ================================================================
  // 4. SEARCH HISTORY — state_transition / boundary
  // ================================================================

  describe('Search History (last 10, dedup, persist)', () => {
    it('should record search history in order (most recent first)', async () => {
      const queries = ['async', 'Rust', 'Go', '日本語', '🔥 Best Practices', 'a', 'zzz'];

      for (const q of queries) {
        await store.search(q, FIXTURE_POSTS);
      }

      // Most recent first
      expect(store.searchHistory[0]).toBe('zzz');
      expect(store.searchHistory[1]).toBe('a');
      expect(store.searchHistory[2]).toBe('🔥 Best Practices');
      expect(store.searchHistory[3]).toBe('日本語');
      expect(store.searchHistory[4]).toBe('Go');
      expect(store.searchHistory[5]).toBe('Rust');
      expect(store.searchHistory[6]).toBe('async');
    });

    it('should deduplicate history — repeated query moves to top', async () => {
      await store.search('async', FIXTURE_POSTS);
      await store.search('Go', FIXTURE_POSTS);
      await store.search('Rust', FIXTURE_POSTS);
      await store.search('async', FIXTURE_POSTS); // repeat

      expect(store.searchHistory).toEqual(['async', 'Rust', 'Go']);
    });

    it('should not add empty/whitespace queries to history', async () => {
      await store.search('', FIXTURE_POSTS);
      await store.search('   ', FIXTURE_POSTS);
      await store.search('Go', FIXTURE_POSTS);

      expect(store.searchHistory).toEqual(['Go']);
    });

    it('should cap history at 10 entries', async () => {
      for (let i = 1; i <= 15; i++) {
        await store.search(`query-${i}`, FIXTURE_POSTS);
      }

      expect(store.searchHistory).toHaveLength(10);
      // Most recent 10: query-15 down to query-6
      expect(store.searchHistory[0]).toBe('query-15');
      expect(store.searchHistory[9]).toBe('query-6');
    });

    it('should persist history to localStorage', () => {
      store.addToSearchHistory('async');
      store.addToSearchHistory('Rust');
      store.addToSearchHistory('Go');

      const saved = JSON.parse(
        localStorage.getItem('searchHistory') || '[]',
      );
      expect(saved).toEqual(['Go', 'Rust', 'async']);
    });

    it('should load persisted history from localStorage', () => {
      localStorage.setItem(
        'searchHistory',
        JSON.stringify(['Go', 'Rust', 'async']),
      );

      const newStore = useSearchStore();
      newStore.loadSearchHistory();

      expect(newStore.searchHistory).toEqual(['Go', 'Rust', 'async']);
    });

    it('should remove a single history entry', () => {
      store.addToSearchHistory('async');
      store.addToSearchHistory('Rust');
      store.addToSearchHistory('Go');

      store.removeFromSearchHistory('Rust');

      expect(store.searchHistory).toEqual(['Go', 'async']);
    });

    it('should clear all history', () => {
      store.addToSearchHistory('async');
      store.addToSearchHistory('Rust');

      store.clearSearchHistory();

      expect(store.searchHistory).toEqual([]);
      expect(store.hasHistory).toBe(false);
    });

    it('should search from a history entry — searchFromHistory', async () => {
      store.addToSearchHistory('Go');
      await store.searchFromHistory('Go', FIXTURE_POSTS);

      expect(store.searchQuery).toBe('Go');
      expect(store.hasResults).toBe(true);
      expect(store.searchResults[0].guid).toBe('s-guid-3');
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('searchHistory', '{invalid json!!!');

      // Should not throw
      expect(() => store.loadSearchHistory()).not.toThrow();
      expect(store.searchHistory).toEqual([]);
    });
  });

  // ================================================================
  // 5. STATE TRANSITIONS — idle → loading → results / error → clear
  // ================================================================

  describe('State Transitions', () => {
    it('should transition: idle → searching → results → clear', async () => {
      // 1. Idle
      expect(store.searchQuery).toBe('');
      expect(store.isSearching).toBe(false);
      expect(store.hasResults).toBe(false);
      expect(store.searchError).toBeNull();

      // 2. Searching → Results (use 'Go' for deterministic 1-result match)
      await store.search('Go', FIXTURE_POSTS);

      expect(store.searchQuery).toBe('Go');
      expect(store.isSearching).toBe(false);
      expect(store.hasResults).toBe(true);
      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-3');
      expect(store.searchError).toBeNull();

      // 3. Clear → back to idle
      store.clearSearch();

      expect(store.searchQuery).toBe('');
      expect(store.isSearching).toBe(false);
      expect(store.hasResults).toBe(false);
      expect(store.searchResults).toEqual([]);
      expect(store.searchError).toBeNull();
    });

    it('should transition: idle → searching → error → retry → results', async () => {
      // 1. Idle → Error
      ipc.searchPosts.mockRejectedValueOnce(new Error('NETWORK_TIMEOUT'));

      await store.search('fail', []);

      expect(store.searchError).toBe('NETWORK_TIMEOUT');
      expect(store.searchResults).toHaveLength(0);
      expect(store.isSearching).toBe(false);

      // 2. Error → Retry → Results
      ipc.searchPosts.mockResolvedValueOnce(
        apiSuccess([
          makePostIndexItem({ title: 'Recovered Result', guid: 'g-recovered' }),
        ]),
      );

      await store.search('retry', []);

      expect(store.searchError).toBeNull();
      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('g-recovered');
      expect(store.isSearching).toBe(false);
    });

    it('should transition: results → new search (replace results)', async () => {
      // 1. First search
      await store.search('Go', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-3');
      expect(store.searchQuery).toBe('Go');

      // 2. Second search replaces results
      await store.search('Rust', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-2');
      expect(store.searchQuery).toBe('Rust');

      // 3. History records both (most recent first)
      expect(store.searchHistory[0]).toBe('Rust');
      expect(store.searchHistory[1]).toBe('Go');
    });

    it('should transition: global search → local search (different paths)', async () => {
      // 1. Global FTS
      ipc.searchPosts.mockResolvedValueOnce(
        apiSuccess([makePostIndexItem({ title: 'FTS Result', guid: 'g-fts' })]),
      );
      await store.search('global', []);

      expect(ipc.searchPosts).toHaveBeenCalledTimes(1);
      expect(store.searchResults).toHaveLength(1);

      // 2. Local filter — use unique query
      await store.search('Python', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('s-guid-1');
      // IPC not called again for local search
      expect(ipc.searchPosts).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // 6. BOUNDARY / EDGE CASES
  // ================================================================

  describe('Boundary / Edge Cases', () => {
    it('should handle empty post array without throwing', async () => {
      await store.search('test', []);

      expect(store.searchResults).toHaveLength(0);
      expect(store.searchError).toBeNull();
    });

    it('should handle very long query string', async () => {
      const longQuery = 'x'.repeat(1000);
      // IPC simulation
      ipc.searchPosts.mockResolvedValueOnce(apiSuccess([]));

      await store.search(longQuery, []);

      expect(ipc.searchPosts).toHaveBeenCalledWith(longQuery, undefined);
      expect(store.searchResults).toHaveLength(0);
    });

    it('should handle query with SQL injection attempt', async () => {
      // Ensure SQL injection attempts don't break the search
      await store.search("'; DROP TABLE post_info; --", FIXTURE_POSTS);

      // No matches since no post contains this text
      expect(store.searchResults).toHaveLength(0);
      expect(store.searchError).toBeNull();
    });

    it('should handle query with Unicode mathematical symbols', async () => {
      const posts = [
        makePostIndexItem({
          title: '∀x: Mathematical Logic',
          guid: 'g-math',
          desc: 'Introducing universal quantification',
        }),
      ];

      await store.search('∀', posts);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].guid).toBe('g-math');
    });

    it('should handle search with mixed CJK and Latin', async () => {
      await store.search('Python并发', FIXTURE_POSTS);

      expect(store.searchResults).toHaveLength(0); // no post has "Python并发" substring
    });

    it('should not duplicate history when same query is searched rapidly', async () => {
      await store.search('Go', FIXTURE_POSTS);
      await store.search('Go', FIXTURE_POSTS);
      await store.search('Go', FIXTURE_POSTS);

      expect(store.searchHistory).toEqual(['Go']);
    });

    it('should clear error state on a new successful search', async () => {
      // First: error
      ipc.searchPosts.mockRejectedValueOnce(new Error('DB_CRASH'));
      await store.search('bad', []);
      expect(store.searchError).toBe('DB_CRASH');

      // Second: success — should clear error
      await store.search('Go', FIXTURE_POSTS);

      expect(store.searchError).toBeNull();
      expect(store.hasResults).toBe(true);
    });
  });
});
