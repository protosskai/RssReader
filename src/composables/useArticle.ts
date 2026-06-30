/**
 * useArticle — 文章数据 & 阅读体验
 *
 * 管理文章列表、已读/收藏状态、标记已读等。
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type { Article, ArticleFilter, ArticleStats } from 'src/common/models';
import { electronClient } from 'src/services/electronClient';

const DEFAULT_PAGE_SIZE = 50;

const defaultStats = (): ArticleStats => ({
  totalArticles: 0, unreadCount: 0, favoriteCount: 0, feedCount: 0, folderCount: 0,
});

export function useArticle() {
  const articles: Ref<Article[]> = ref([]);
  const currentArticle: Ref<Article | null> = ref(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const total = ref(0);
  const currentFilter: Ref<ArticleFilter> = ref({});
  const stats: Ref<ArticleStats> = ref(defaultStats());
  // Reading experience
  const fontSize: Ref<number> = ref(16);
  const lineHeight: Ref<number> = ref(1.6);
  const fontFamily: Ref<string> = ref('system-ui');
  const readingWidth: Ref<number> = ref(720);

  const unreadArticles: ComputedRef<Article[]> = computed(() => articles.value.filter((a) => !a.read));
  const favoriteArticles: ComputedRef<Article[]> = computed(() => articles.value.filter((a) => a.favorite));

  const loadStats = async () => {
    try { stats.value = await electronClient.getArticleStats(); } catch { stats.value = defaultStats(); }
  };

  const loadArticles = async (filter?: ArticleFilter, offset = 0, limit = DEFAULT_PAGE_SIZE) => {
    isLoading.value = true; error.value = null;
    try {
      const result = await electronClient.getArticles({ filter: filter ?? currentFilter.value, offset, limit });
      articles.value = result.articles; total.value = result.total;
      if (offset === 0) currentFilter.value = { ...(filter ?? {}) };
    } catch { articles.value = []; total.value = 0; }
    finally { isLoading.value = false; }
  };

  const loadArticle = async (id: string) => {
    isLoading.value = true; error.value = null;
    try { currentArticle.value = await electronClient.getArticle(id); }
    catch { currentArticle.value = null; }
    finally { isLoading.value = false; }
  };

  const toggleReadStatus = async (id: string) => {
    try {
      await electronClient.toggleReadStatus(id);
      const target = articles.value.find((a) => a.id === id);
      if (target) target.read = !target.read;
      if (currentArticle.value?.id === id) currentArticle.value.read = !currentArticle.value.read;
      await loadStats();
    } catch (rawError) {
      error.value = rawError instanceof Error ? rawError.message : '切换已读状态失败';
    }
  };

  const toggleFavorite = async (id: string) => {
    const f = await electronClient.toggleFavorite(id);
    const target = articles.value.find((a) => a.id === id);
    if (target) target.favorite = f;
    if (currentArticle.value?.id === id) currentArticle.value.favorite = f;
    await loadStats();
    return f;
  };

  const markAllAsRead = async (filter?: { feedId?: string; folderName?: string }) => {
    await electronClient.markAllAsRead(filter);
    articles.value.forEach((item) => {
      const shouldUpdate = !filter
        || (filter.feedId && item.feedId === filter.feedId)
        || (filter.folderName && item.folderName === filter.folderName);
      if (shouldUpdate) item.read = true;
    });
    await loadStats();
  };

  const clearAllFavorites = async () => {
    await electronClient.clearAllFavorites();
    articles.value.forEach((a) => { a.favorite = false; });
    if (currentArticle.value) currentArticle.value.favorite = false;
    await loadStats();
  };

  const applyFilter = async (filter: ArticleFilter) => { await loadArticles(filter, 0, DEFAULT_PAGE_SIZE); };
  const clearFilter = async () => { currentFilter.value = {}; await loadArticles(undefined); };
  const searchArticles = async (keyword: string) => { await loadArticles({ keyword }, 0, DEFAULT_PAGE_SIZE); };

  return {
    articles, currentArticle, isLoading, error, total, currentFilter, stats,
    fontSize, lineHeight, fontFamily, readingWidth,
    unreadArticles, favoriteArticles,
    loadArticles, loadArticle, toggleReadStatus, toggleFavorite,
    markAllAsRead, clearAllFavorites, loadStats, applyFilter, clearFilter, searchArticles,
  };
}
