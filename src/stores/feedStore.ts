/**
 * Feed Store - 基于新架构的RSS源管理Store
 * 使用Service层而不是直接调用electronAPI
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FeedSource } from 'src-electron/domain/models/Article';

export const useFeedStore = defineStore('feed', () => {
  // 状态
  const feeds = ref<FeedSource[]>([]);
  const currentFeed = ref<FeedSource | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const feedsByFolder = computed(() => {
    const grouped: Record<string, FeedSource[]> = {};
    feeds.value.forEach(feed => {
      if (!grouped[feed.folderName]) {
        grouped[feed.folderName] = [];
      }
      grouped[feed.folderName].push(feed);
    });
    return grouped;
  });

  const totalUnreadCount = computed(() => {
    return feeds.value.reduce((sum, feed) => sum + feed.unreadCount, 0);
  });

  const folderNames = computed(() => {
    return [...new Set(feeds.value.map(feed => feed.folderName))];
  });

  // 加载RSS源列表
  const loadFeeds = async (folderName?: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      feeds.value = await window.electronAPI.getFeeds(folderName);
    } catch (err: any) {
      console.error('加载RSS源失败:', err);
      error.value = err.message || '加载RSS源失败';
      feeds.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  // 加载单个RSS源
  const loadFeed = async (id: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      currentFeed.value = await window.electronAPI.getFeed(id);
    } catch (err: any) {
      console.error('加载RSS源失败:', err);
      error.value = err.message || '加载RSS源失败';
      currentFeed.value = null;
    } finally {
      isLoading.value = false;
    }
  };

  // 添加RSS源
  const addFeed = async (feedUrl: string, title?: string, folderName: string = '默认') => {
    try {
      await window.electronAPI.addFeed(feedUrl, title, folderName);
      await loadFeeds(); // 重新加载列表
    } catch (err: any) {
      console.error('添加RSS源失败:', err);
      throw new Error(err.message || '添加RSS源失败');
    }
  };

  // 删除RSS源
  const removeFeed = async (id: string) => {
    try {
      await window.electronAPI.removeFeed(id);
      await loadFeeds(); // 重新加载列表
    } catch (err: any) {
      console.error('删除RSS源失败:', err);
      throw new Error(err.message || '删除RSS源失败');
    }
  };

  // 同步RSS源
  const syncFeed = async (id: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      await window.electronAPI.syncFeed(id);
      await loadFeeds(); // 重新加载列表
    } catch (err: any) {
      console.error('同步RSS源失败:', err);
      error.value = err.message || '同步RSS源失败';
    } finally {
      isLoading.value = false;
    }
  };

  // 按文件夹分组获取RSS源
  const getFeedsByFolder = (folderName: string) => {
    return feeds.value.filter(feed => feed.folderName === folderName);
  };

  return {
    // 状态
    feeds,
    currentFeed,
    isLoading,
    error,

    // 计算属性
    feedsByFolder,
    totalUnreadCount,
    folderNames,

    // 方法
    loadFeeds,
    loadFeed,
    addFeed,
    removeFeed,
    syncFeed,
    getFeedsByFolder
  };
});
