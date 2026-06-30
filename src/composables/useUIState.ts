/**
 * useUIState — 全局 UI 状态（加载 + 对话框）
 */
import { ref, computed } from 'vue';

export function useUIState() {
  // Loading
  const loadingTasks = ref<Map<string, { id: string; label: string; ts: number }>>(new Map());
  const isLoading = computed(() => loadingTasks.value.size > 0);
  const start = (id: string, label = '加载中...') => loadingTasks.value.set(id, { id, label, ts: Date.now() });
  const stop = (id: string) => { loadingTasks.value.delete(id); };
  const stopAll = () => { loadingTasks.value.clear(); };

  const withLoading = async <T>(id: string, label: string, fn: () => Promise<T>) => {
    try { start(id, label); return await fn(); } finally { stop(id); }
  };

  // Dialogs
  const showAddSub = ref(false);
  const showAddFolder = ref(false);
  const showEditFolder = ref(false);
  const editFolderOldName = ref('');

  const openAddSub = () => { showAddSub.value = true; };
  const closeAddSub = () => { showAddSub.value = false; };
  const toggleAddSub = () => { showAddSub.value = !showAddSub.value; };

  const openAddFolder = () => { showAddFolder.value = true; };
  const closeAddFolder = () => { showAddFolder.value = false; };
  const toggleAddFolder = () => { showAddFolder.value = !showAddFolder.value; };

  const openEditFolder = (name: string) => { editFolderOldName.value = name; showEditFolder.value = true; };
  const closeEditFolder = () => { showEditFolder.value = false; };
  const toggleEditFolder = () => { showEditFolder.value = !showEditFolder.value; };

  const closeAll = () => { showAddSub.value = false; showAddFolder.value = false; showEditFolder.value = false; };

  return {
    isLoading, start, stop, stopAll, withLoading,
    showAddSub, showAddFolder, showEditFolder, editFolderOldName,
    openAddSub, closeAddSub, toggleAddSub,
    openAddFolder, closeAddFolder, toggleAddFolder,
    openEditFolder, closeEditFolder, toggleEditFolder,
    closeAll,
  };
}
