/**
 * useSearch — 文章搜索（本地 + 全局 FTS5）
 */
import { ref, computed } from 'vue';
import type { PostIndexItem } from 'src/common/models';
import { unwrapOrThrow } from 'src/common/ErrorMsg';
import { electronClient } from 'src/services/electronClient';

const MAX_HISTORY = 10;
const LS_KEY = 'searchHistory';

export function useSearch() {
  const query = ref('');
  const results = ref<PostIndexItem[]>([]);
  const isSearching = ref(false);
  const searchError = ref<string | null>(null);
  const history = ref<string[]>([]);
  const hasResults = computed(() => results.value.length > 0);
  const hasHistory = computed(() => history.value.length > 0);

  let abortController: AbortController | null = null;

  const saveHistory = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(history.value)); } catch { /* noop */ } };
  const loadHistory = () => { try { const s = localStorage.getItem(LS_KEY); if (s) history.value = JSON.parse(s); } catch { history.value = []; } };
  loadHistory();

  const search = async (q: string, posts: PostIndexItem[] = [], options?: { folderId?: string; dateFrom?: string; dateTo?: string; limit?: number }) => {
    if (!q.trim()) { results.value = []; return; }
    if (abortController) abortController.abort();
    abortController = new AbortController();
    isSearching.value = true; searchError.value = null; query.value = q;
    try {
      if (posts.length > 0) {
        const lower = q.toLowerCase();
        results.value = posts.filter((p) => p.title.toLowerCase().includes(lower) || (p.desc && p.desc.toLowerCase().includes(lower)));
      } else {
        if (abortController.signal.aborted) return;
        const raw = await electronClient.searchPosts(q, options);
        if (abortController.signal.aborted) return;
        results.value = unwrapOrThrow(raw);
      }
      addHistory(q);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      searchError.value = e instanceof Error ? e.message : '搜索失败'; results.value = [];
    } finally { if (!abortController?.signal.aborted) isSearching.value = false; }
  };

  const addHistory = (q: string) => {
    const t = q.trim(); if (!t) return;
    history.value = history.value.filter((h) => h !== t);
    history.value.unshift(t);
    if (history.value.length > MAX_HISTORY) history.value = history.value.slice(0, MAX_HISTORY);
    saveHistory();
  };

  const clearSearch = () => { query.value = ''; results.value = []; searchError.value = null; };
  const clearHistory = () => { history.value = []; saveHistory(); };

  return { query, results, isSearching, searchError, history, hasResults, hasHistory,
    search, clearSearch, clearHistory };
}
