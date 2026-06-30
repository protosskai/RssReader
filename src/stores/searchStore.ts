import { defineStore } from 'pinia';
import type { PostIndexItem } from 'src/common/models';
import { ref, computed } from 'vue';
import { unwrapOrThrow } from 'src/common/ErrorMsg';
import { electronClient } from 'src/services/electronClient';

const MAX_HISTORY_ITEMS = 10;
const LS_KEY = 'searchHistory';

export const useSearchStore = defineStore('search', () => {
  // ── State ────────────────────────────────────────────────
  const searchQuery = ref('');
  const searchResults = ref<PostIndexItem[]>([]);
  const isSearching = ref(false);
  const searchError = ref<string | null>(null);
  const searchHistory = ref<string[]>([]);

  // ── Computed ─────────────────────────────────────────────
  const hasResults = computed(() => searchResults.value.length > 0);
  const hasHistory = computed(() => searchHistory.value.length > 0);
  const isQueryEmpty = computed(() => searchQuery.value.trim() === '');

  // ── Internal helpers ─────────────────────────────────────

  /**
   * Debounce guard – prevents concurrent search execution.
   * The last caller's results always win; in-flight earlier
   * calls are simply overwritten.
   */
  let abortController: AbortController | null = null;

  const saveSearchHistory = (): void => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(searchHistory.value));
    } catch (err) {
      console.error('保存搜索历史失败:', err);
    }
  };

  const loadSearchHistory = (): void => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) searchHistory.value = JSON.parse(saved);
    } catch (err) {
      console.error('加载搜索历史失败:', err);
      searchHistory.value = [];
    }
  };

  // ── Actions ──────────────────────────────────────────────

  /**
   * Execute a search (local filter or global FTS, depending
   * on whether `posts` is supplied).
   */
  const search = async (
    query: string,
    posts: PostIndexItem[] = [],
    options?: {
      folderId?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    },
  ): Promise<void> => {
    if (!query.trim()) {
      searchResults.value = [];
      return;
    }

    // Cancel any in-flight global search
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    isSearching.value = true;
    searchError.value = null;
    searchQuery.value = query;

    try {
      if (posts.length > 0) {
        performLocalSearch(query, posts);
      } else {
        await performGlobalSearch(query, options);
      }
      addToSearchHistory(query);
    } catch (err) {
      // Aborted searches are expected noise; don't show as errors
      if (err instanceof DOMException && err.name === 'AbortError') return;

      const msg = err instanceof Error ? err.message : '搜索失败';
      searchError.value = msg;
      console.error('搜索失败:', err);
      searchResults.value = [];
    } finally {
      if (abortController && !abortController.signal.aborted) {
        isSearching.value = false;
      }
    }
  };

  /** Local substring filter over an already-fetched post array. */
  const performLocalSearch = (query: string, posts: PostIndexItem[]): void => {
    const lowerQuery = query.toLowerCase();
    searchResults.value = posts.filter(
      (post) =>
        post.title.toLowerCase().includes(lowerQuery) ||
        post.author.toLowerCase().includes(lowerQuery) ||
        (post.desc && post.desc.toLowerCase().includes(lowerQuery)),
    );
  };

  /** Global FTS5 search via the Electron main process. */
  const performGlobalSearch = async (
    query: string,
    options?: {
      folderId?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    },
  ): Promise<void> => {
    // Check for abort before making the IPC call
    if (abortController?.signal.aborted) return;
    // searchPosts now returns ApiResponse<PostIndexItem[]>
    const rawResult = await electronClient.searchPosts(query, options);
    if (abortController?.signal.aborted) return;
    const results = unwrapOrThrow(rawResult);
    searchResults.value = results;
  };

  /** Push a query to the top of the history stack (unique). */
  const addToSearchHistory = (query: string): void => {
    const trimmed = query.trim();
    if (!trimmed) return;

    searchHistory.value = searchHistory.value.filter(
      (item) => item !== trimmed,
    );
    searchHistory.value.unshift(trimmed);

    if (searchHistory.value.length > MAX_HISTORY_ITEMS) {
      searchHistory.value = searchHistory.value.slice(0, MAX_HISTORY_ITEMS);
    }
    saveSearchHistory();
  };

  const removeFromSearchHistory = (query: string): void => {
    searchHistory.value = searchHistory.value.filter((item) => item !== query);
    saveSearchHistory();
  };

  const clearSearchHistory = (): void => {
    searchHistory.value = [];
    saveSearchHistory();
  };

  /** Wipe current query + results. */
  const clearSearch = (): void => {
    searchQuery.value = '';
    searchResults.value = [];
    searchError.value = null;
  };

  /**
   * Re-run a previous history query.
   * Returns a Promise so callers can await / catch.
   */
  const searchFromHistory = async (
    query: string,
    posts: PostIndexItem[] = [],
    options?: {
      folderId?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    },
  ): Promise<void> => {
    searchQuery.value = query;
    await search(query, posts, options);
  };

  /**
   * Reset store to initial state.
   * Call on logout / app-close / user-data clear.
   */
  const $reset = (): void => {
    searchQuery.value = '';
    searchResults.value = [];
    isSearching.value = false;
    searchError.value = null;
    abortController = null;
    // searchHistory is intentionally preserved (persisted to LS)
  };

  // ── Initialisation ───────────────────────────────────────

  loadSearchHistory();

  // ── Public API ───────────────────────────────────────────

  return {
    // state
    searchQuery,
    searchResults,
    isSearching,
    searchError,
    searchHistory,
    // computed
    hasResults,
    hasHistory,
    isQueryEmpty,
    // actions
    search,
    clearSearch,
    loadSearchHistory,
    addToSearchHistory,
    removeFromSearchHistory,
    clearSearchHistory,
    searchFromHistory,
    $reset,
  };
});
