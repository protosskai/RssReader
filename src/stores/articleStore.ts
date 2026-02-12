import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Article, ArticleFilter, ArticleStats } from 'src/common/models';
import { electronClient } from 'src/services/electronClient';

const DEFAULT_PAGE_SIZE = 50;

const defaultStats = (): ArticleStats => ({
  totalArticles: 0,
  unreadCount: 0,
  favoriteCount: 0,
  feedCount: 0,
  folderCount: 0,
});

export const useArticleStore = defineStore('article', () => {
  const articles = ref<Article[]>([]);
  const currentArticle = ref<Article | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const total = ref(0);
  const currentFilter = ref<ArticleFilter>({});
  const stats = ref<ArticleStats>(defaultStats());

  const unreadArticles = computed(() => articles.value.filter((item) => !item.read));
  const favoriteArticles = computed(() => articles.value.filter((item) => item.favorite));

  const runTask = async <T>(task: () => Promise<T>, fallbackMessage: string): Promise<T> => {
    try {
      return await task();
    } catch (rawError) {
      const message = rawError instanceof Error ? rawError.message : fallbackMessage;
      error.value = message;
      throw new Error(message);
    }
  };

  const loadArticles = async (filter?: ArticleFilter, offset = 0, limit = DEFAULT_PAGE_SIZE) => {
    isLoading.value = true;
    error.value = null;

    try {
      const effectiveFilter = filter ?? currentFilter.value;
      const result = await electronClient.getArticles({ filter: effectiveFilter, offset, limit });
      articles.value = result.articles;
      total.value = result.total;
      if (offset === 0) {
        currentFilter.value = { ...effectiveFilter };
      }
    } catch {
      articles.value = [];
      total.value = 0;
    } finally {
      isLoading.value = false;
    }
  };

  const loadArticle = async (id: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      currentArticle.value = await electronClient.getArticle(id);
    } catch {
      currentArticle.value = null;
    } finally {
      isLoading.value = false;
    }
  };

  const toggleReadStatus = async (id: string) => {
    await runTask(async () => {
      await electronClient.toggleReadStatus(id);
      const target = articles.value.find((item) => item.id === id);
      if (target) {
        target.read = !target.read;
      }
      if (currentArticle.value?.id === id) {
        currentArticle.value.read = !currentArticle.value.read;
      }
      await loadStats();
    }, '切换已读状态失败');
  };

  const toggleFavorite = async (id: string) => {
    return runTask(async () => {
      const favorite = await electronClient.toggleFavorite(id);
      const target = articles.value.find((item) => item.id === id);
      if (target) {
        target.favorite = favorite;
      }
      if (currentArticle.value?.id === id) {
        currentArticle.value.favorite = favorite;
      }
      await loadStats();
      return favorite;
    }, '切换收藏状态失败');
  };

  const markAllAsRead = async (filter?: { feedId?: string; folderName?: string }) => {
    await runTask(async () => {
      await electronClient.markAllAsRead(filter);
      articles.value.forEach((item) => {
        const shouldUpdate = !filter
          || (filter.feedId && item.feedId === filter.feedId)
          || (filter.folderName && item.folderName === filter.folderName);
        if (shouldUpdate) {
          item.read = true;
        }
      });
      await loadStats();
    }, '标记全部已读失败');
  };

  const clearAllFavorites = async () => {
    await runTask(async () => {
      await electronClient.clearAllFavorites();
      articles.value.forEach((item) => {
        item.favorite = false;
      });
      if (currentArticle.value) {
        currentArticle.value.favorite = false;
      }
      await loadStats();
    }, '清空收藏失败');
  };

  const loadStats = async () => {
    try {
      stats.value = await electronClient.getArticleStats();
    } catch {
      stats.value = defaultStats();
    }
  };

  const applyFilter = async (filter: ArticleFilter) => {
    await loadArticles(filter, 0, DEFAULT_PAGE_SIZE);
  };

  const clearFilter = async () => {
    currentFilter.value = {};
    await loadArticles(undefined, 0, DEFAULT_PAGE_SIZE);
  };

  const searchArticles = async (keyword: string) => {
    await loadArticles({ keyword }, 0, DEFAULT_PAGE_SIZE);
  };

  return {
    articles,
    currentArticle,
    isLoading,
    error,
    total,
    currentFilter,
    stats,
    unreadArticles,
    favoriteArticles,
    loadArticles,
    loadArticle,
    toggleReadStatus,
    toggleFavorite,
    markAllAsRead,
    clearAllFavorites,
    loadStats,
    applyFilter,
    clearFilter,
    searchArticles,
  };
});
