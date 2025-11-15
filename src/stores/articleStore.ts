/**
 * Article Store - 基于新架构的文章管理Store
 * 使用Service层而不是直接调用electronAPI
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Article, ArticleFilter, ArticleStats } from 'src-electron/domain/models/Article';

export const useArticleStore = defineStore('article', () => {
  // 状态
  const articles = ref<Article[]>([]);
  const currentArticle = ref<Article | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const total = ref(0);
  const currentFilter = ref<ArticleFilter>({});
  const stats = ref<ArticleStats>({
    totalArticles: 0,
    unreadCount: 0,
    favoriteCount: 0,
    feedCount: 0,
    folderCount: 0
  });

  // 计算属性
  const unreadArticles = computed(() => articles.value.filter(a => !a.read));
  const favoriteArticles = computed(() => articles.value.filter(a => a.favorite));

  // 加载文章列表
  const loadArticles = async (filter?: ArticleFilter, offset = 0, limit = 50) => {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.electronAPI.getArticles({
        filter: filter || currentFilter.value,
        offset,
        limit
      });

      articles.value = result.articles;
      total.value = result.total;

      if (offset === 0) {
        currentFilter.value = filter || {};
      }
    } catch (err: any) {
      console.error('加载文章失败:', err);
      error.value = err.message || '加载文章失败';
      articles.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  // 加载单篇文章
  const loadArticle = async (id: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      currentArticle.value = await window.electronAPI.getArticle(id);
    } catch (err: any) {
      console.error('加载文章失败:', err);
      error.value = err.message || '加载文章失败';
      currentArticle.value = null;
    } finally {
      isLoading.value = false;
    }
  };

  // 切换已读状态
  const toggleReadStatus = async (id: string) => {
    try {
      await window.electronAPI.toggleReadStatus(id);

      // 更新本地状态
      const article = articles.value.find(a => a.id === id);
      if (article) {
        article.read = !article.read;
      }

      if (currentArticle.value?.id === id) {
        currentArticle.value.read = !currentArticle.value.read;
      }

      // 更新统计数据
      await loadStats();
    } catch (err: any) {
      console.error('切换阅读状态失败:', err);
      throw err;
    }
  };

  // 切换收藏状态
  const toggleFavorite = async (id: string) => {
    try {
      const isFavorite = await window.electronAPI.toggleFavorite(id);

      // 更新本地状态
      const article = articles.value.find(a => a.id === id);
      if (article) {
        article.favorite = isFavorite;
      }

      if (currentArticle.value?.id === id) {
        currentArticle.value.favorite = isFavorite;
      }

      // 更新统计数据
      await loadStats();

      return isFavorite;
    } catch (err: any) {
      console.error('切换收藏状态失败:', err);
      throw err;
    }
  };

  // 标记全部为已读
  const markAllAsRead = async (filter?: { feedId?: string, folderName?: string }) => {
    try {
      await window.electronAPI.markAllAsRead(filter);

      // 更新本地状态
      articles.value.forEach(article => {
        if (!filter || (filter.feedId && article.feedId === filter.feedId) ||
            (filter.folderName && article.folderName === filter.folderName)) {
          article.read = true;
        }
      });

      // 更新统计数据
      await loadStats();
    } catch (err: any) {
      console.error('标记全部为已读失败:', err);
      throw err;
    }
  };

  // 清空所有收藏
  const clearAllFavorites = async () => {
    try {
      await window.electronAPI.clearAllFavorites();

      // 更新本地状态
      articles.value.forEach(article => {
        article.favorite = false;
      });

      if (currentArticle.value) {
        currentArticle.value.favorite = false;
      }

      // 更新统计数据
      await loadStats();
    } catch (err: any) {
      console.error('清空收藏失败:', err);
      throw err;
    }
  };

  // 加载统计数据
  const loadStats = async () => {
    try {
      stats.value = await window.electronAPI.getArticleStats();
    } catch (err: any) {
      console.error('加载统计数据失败:', err);
    }
  };

  // 应用过滤器
  const applyFilter = async (filter: ArticleFilter) => {
    await loadArticles(filter, 0, 50);
  };

  // 清除过滤器
  const clearFilter = async () => {
    currentFilter.value = {};
    await loadArticles(undefined, 0, 50);
  };

  // 搜索文章
  const searchArticles = async (keyword: string) => {
    await loadArticles({ keyword }, 0, 50);
  };

  return {
    // 状态
    articles,
    currentArticle,
    isLoading,
    error,
    total,
    currentFilter,
    stats,

    // 计算属性
    unreadArticles,
    favoriteArticles,

    // 方法
    loadArticles,
    loadArticle,
    toggleReadStatus,
    toggleFavorite,
    markAllAsRead,
    clearAllFavorites,
    loadStats,
    applyFilter,
    clearFilter,
    searchArticles
  };
});
