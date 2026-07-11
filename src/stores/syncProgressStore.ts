import { defineStore } from 'pinia';
import { ref } from 'vue';
import { electronClient } from 'src/services/electronClient';

export interface FeedProgress {
  rssId: string;
  title: string;
  status: 'pending' | 'syncing' | 'success' | 'failed';
}

export interface SyncProgressData {
  totalSources: number;
  completedCount: number;
  successCount: number;
  failureCount: number;
  isSyncing: boolean;
  currentSource: string | null;
  sources: FeedProgress[];
}

export const useSyncProgressStore = defineStore('syncProgress', () => {
  const progress = ref<SyncProgressData>({
    totalSources: 0,
    completedCount: 0,
    successCount: 0,
    failureCount: 0,
    isSyncing: false,
    currentSource: null,
    sources: [],
  });

  const isPolling = ref(false);

  const progressPercent = () => {
    if (progress.value.totalSources === 0) return 0;
    return Math.round((progress.value.completedCount / progress.value.totalSources) * 100);
  };

  const fetchProgress = async () => {
    try {
      const data = await electronClient.syncGetProgress();
      if (data && typeof data === 'object') {
        progress.value = data as SyncProgressData;
      }
    } catch (err) {
      console.error('[syncProgressStore] fetchProgress error:', err);
    }
  };

  const startPolling = (intervalMs = 500) => {
    if (isPolling.value) return;
    isPolling.value = true;

    const poll = async () => {
      if (!isPolling.value) return;
      await fetchProgress();
      if (progress.value.isSyncing) {
        setTimeout(poll, intervalMs);
      } else {
        isPolling.value = false;
      }
    };

    // Initial fetch
    void fetchProgress().then(() => {
      if (progress.value.isSyncing) {
        setTimeout(poll, intervalMs);
      } else {
        isPolling.value = false;
      }
    });
  };

  const stopPolling = () => {
    isPolling.value = false;
  };

  return {
    progress,
    isPolling,
    progressPercent,
    fetchProgress,
    startPolling,
    stopPolling,
  };
});
