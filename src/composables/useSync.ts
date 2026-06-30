/**
 * useSync — 同步进度管理
 */
import { ref } from 'vue';
import { electronClient } from 'src/services/electronClient';

export interface FeedProgress {
  rssId: string; title: string; status: 'pending' | 'syncing' | 'success' | 'failed';
}

export interface SyncProgressData {
  totalSources: number; completedCount: number; successCount: number;
  failureCount: number; isSyncing: boolean; currentSource: string | null;
  sources: FeedProgress[];
}

const defaults: SyncProgressData = {
  totalSources: 0, completedCount: 0, successCount: 0,
  failureCount: 0, isSyncing: false, currentSource: null, sources: [],
};

export function useSync() {
  const progress = ref<SyncProgressData>({ ...defaults });
  const isPolling = ref(false);

  const percent = () =>
    progress.value.totalSources === 0 ? 0 : Math.round((progress.value.completedCount / progress.value.totalSources) * 100);

  const fetch = async () => {
    try { const d = await (electronClient as any).getSyncProgress?.(); if (d) progress.value = d; }
    catch { /* noop */ }
  };

  const startPolling = (ms = 500) => {
    if (isPolling.value) return; isPolling.value = true;
    const poll = async () => {
      if (!isPolling.value) return; await fetch();
      if (progress.value.isSyncing) setTimeout(poll, ms); else isPolling.value = false;
    };
    fetch().then(() => { if (progress.value.isSyncing) setTimeout(poll, ms); else isPolling.value = false; });
  };

  const stopPolling = () => { isPolling.value = false; };

  return { progress, isPolling, percent, fetch, startPolling, stopPolling };
}
