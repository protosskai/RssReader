import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Ref } from 'vue';
import { ErrorMsg } from 'src/common/ErrorMsg';
import { RssFolderItem, RssInfoItem, RssInfoNew } from 'src/common/RssInfoItem';
import { electronClient } from 'src/services/electronClient';

export const useRssInfoStore = defineStore('rssInfo', () => {
  const rssFolderList: Ref<RssFolderItem[]> = ref([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const folderNameList = computed(() => rssFolderList.value.map((item) => item.folderName));
  const totalArticleCount = computed(() => 0);
  const unreadArticleCount = computed(() => 0);
  const favoriteCount = computed(() => 0);

  const executeAndRefresh = async <T>(action: () => Promise<T>): Promise<T> => {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await action();
      rssFolderList.value = await electronClient.getRssInfoListFromDb();
      return result;
    } catch (rawError) {
      error.value = rawError instanceof Error ? rawError.message : 'RSS数据操作失败';
      throw rawError;
    } finally {
      isLoading.value = false;
    }
  };

  const refresh = async () => {
    await executeAndRefresh(async () => undefined);
  };

  const syncAll = async () => {
    await refresh();
  };

  const addRssSubscription = async (feedUrl: string, title: string, folderName: string) => {
    const payload: RssInfoNew = { feedUrl, title, folderName };
    await executeAndRefresh(() => electronClient.addRssSubscription(payload));
  };

  const removeRssSubscription = async (folderName: string, rssInfoItem: RssInfoItem): Promise<ErrorMsg> => {
    return executeAndRefresh(() => electronClient.removeRssSubscription(folderName, rssInfoItem.feedUrl));
  };

  const addFolder = async (folderName: string): Promise<ErrorMsg> => {
    return executeAndRefresh(() => electronClient.addFolder(folderName));
  };

  const editFolder = async (oldFolderName: string, newFolderName: string): Promise<ErrorMsg> => {
    return executeAndRefresh(() => electronClient.editFolder(oldFolderName, newFolderName));
  };

  const removeFolder = async (folderName: string): Promise<ErrorMsg> => {
    return executeAndRefresh(() => electronClient.removeFolder(folderName));
  };

  const importOpmlFile = async (): Promise<ErrorMsg> => {
    return executeAndRefresh(() => electronClient.importOpmlFile());
  };

  void refresh();

  return {
    rssFolderList,
    isLoading,
    error,
    addRssSubscription,
    removeRssSubscription,
    folderNameList,
    addFolder,
    removeFolder,
    importOpmlFile,
    editFolder,
    refresh,
    syncAll,
    totalArticleCount,
    unreadArticleCount,
    favoriteCount,
  };
});
