import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { FeedSource } from 'src/common/models';
import { electronClient } from 'src/services/electronClient';

export const useFeedStore = defineStore('feed', () => {
  const feeds = ref<FeedSource[]>([]);
  const currentFeed = ref<FeedSource | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const feedsByFolder = computed(() => {
    return feeds.value.reduce<Record<string, FeedSource[]>>((accumulator, feed) => {
      if (!accumulator[feed.folderName]) {
        accumulator[feed.folderName] = [];
      }
      accumulator[feed.folderName].push(feed);
      return accumulator;
    }, {});
  });

  const totalUnreadCount = computed(() => feeds.value.reduce((sum, feed) => sum + feed.unreadCount, 0));
  const folderNames = computed(() => [...new Set(feeds.value.map((feed) => feed.folderName))]);

  const withLoading = async (task: () => Promise<void>, message: string) => {
    isLoading.value = true;
    error.value = null;
    try {
      await task();
    } catch (rawError) {
      error.value = rawError instanceof Error ? rawError.message : message;
      throw rawError;
    } finally {
      isLoading.value = false;
    }
  };

  const loadFeeds = async (folderName?: string) => {
    await withLoading(async () => {
      feeds.value = await electronClient.getFeeds(folderName);
    }, '加载RSS源失败');
  };

  const loadFeed = async (id: string) => {
    await withLoading(async () => {
      currentFeed.value = await electronClient.getFeed(id);
    }, '加载RSS源失败');
  };

  const addFeed = async (feedUrl: string, title?: string, folderName = '默认') => {
    await withLoading(async () => {
      await electronClient.addFeed(feedUrl, title, folderName);
      feeds.value = await electronClient.getFeeds();
    }, '添加RSS源失败');
  };

  const removeFeed = async (id: string) => {
    await withLoading(async () => {
      await electronClient.removeFeed(id);
      feeds.value = await electronClient.getFeeds();
    }, '删除RSS源失败');
  };

  const syncFeed = async (id: string) => {
    await withLoading(async () => {
      await electronClient.syncFeed(id);
      feeds.value = await electronClient.getFeeds();
    }, '同步RSS源失败');
  };

  const getFeedsByFolder = (folderName: string) => feeds.value.filter((feed) => feed.folderName === folderName);

  return {
    feeds,
    currentFeed,
    isLoading,
    error,
    feedsByFolder,
    totalUnreadCount,
    folderNames,
    loadFeeds,
    loadFeed,
    addFeed,
    removeFeed,
    syncFeed,
    getFeedsByFolder,
  };
});
