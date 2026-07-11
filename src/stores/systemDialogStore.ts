import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface EditSubscriptionInfo {
  rssId: string;
  title: string;
  feedUrl: string;
  htmlUrl?: string;
  folderName?: string;
}

export interface MoveSubscriptionParams {
  rssId: string;
  feedUrl: string;
  currentFolder: string;
}

/**
 * Central dialog visibility + payload store.
 * Components open/close dialogs via this store so menus don't need local state.
 */
export const useSystemDialogStore = defineStore('systemDialogStore', () => {
  // ── Add Subscription ─────────────────────────────────────
  const showAddSubscriptionDialog = ref(false);
  const openAddSubscriptionDialog = () => {
    showAddSubscriptionDialog.value = true;
  };
  const closeAddSubscriptionDialog = () => {
    showAddSubscriptionDialog.value = false;
  };
  const toggleSubscriptionDialog = () => {
    showAddSubscriptionDialog.value = !showAddSubscriptionDialog.value;
  };
  /** Alias used by some components */
  const toggleAddSubscriptionDialog = toggleSubscriptionDialog;

  // ── Add Folder ───────────────────────────────────────────
  const showAddFolderDialog = ref(false);
  const openAddFolderDialog = () => {
    showAddFolderDialog.value = true;
  };
  const closeAddFolderDialog = () => {
    showAddFolderDialog.value = false;
  };
  const toggleAddFolderDialog = () => {
    showAddFolderDialog.value = !showAddFolderDialog.value;
  };

  // ── Edit Folder ──────────────────────────────────────────
  const showEditFolderDialog = ref(false);
  const editFolderDialogOldFolderName = ref('');
  const openEditFolderDialog = (oldFolderName: string) => {
    editFolderDialogOldFolderName.value = oldFolderName;
    showEditFolderDialog.value = true;
  };
  const closeEditFolderDialog = () => {
    showEditFolderDialog.value = false;
  };
  const toggleEditFolderDialog = () => {
    showEditFolderDialog.value = !showEditFolderDialog.value;
  };
  const setEditFolderDialogOldFolderName = (name: string) => {
    editFolderDialogOldFolderName.value = name;
  };

  // ── Edit Subscription ────────────────────────────────────
  const showEditSubscriptionDialog = ref(false);
  const editSubscriptionOldRssInfo = ref<EditSubscriptionInfo | null>(null);
  const setEditSubscriptionOldRssInfo = (info: EditSubscriptionInfo) => {
    editSubscriptionOldRssInfo.value = info;
  };
  const openEditSubscriptionDialog = (info?: EditSubscriptionInfo) => {
    if (info) editSubscriptionOldRssInfo.value = info;
    showEditSubscriptionDialog.value = true;
  };
  const closeEditSubscriptionDialog = () => {
    showEditSubscriptionDialog.value = false;
  };
  const toggleEditSubscriptionDialog = () => {
    showEditSubscriptionDialog.value = !showEditSubscriptionDialog.value;
  };

  // ── Move Folder ──────────────────────────────────────────
  const showMoveFolderDialog = ref(false);
  const currentFolderName = ref('');
  const openMoveFolderDialog = (folderName: string) => {
    currentFolderName.value = folderName;
    showMoveFolderDialog.value = true;
  };
  const closeMoveFolderDialog = () => {
    showMoveFolderDialog.value = false;
  };
  const toggleMoveFolderDialog = () => {
    showMoveFolderDialog.value = !showMoveFolderDialog.value;
  };

  // ── Move Subscription ────────────────────────────────────
  const showMoveSubscriptionDialog = ref(false);
  const moveSubscriptionParams = ref<MoveSubscriptionParams | null>(null);
  const setMoveSubscriptionParams = (params: MoveSubscriptionParams) => {
    moveSubscriptionParams.value = params;
  };
  const openMoveSubscriptionDialog = (params?: MoveSubscriptionParams) => {
    if (params) moveSubscriptionParams.value = params;
    showMoveSubscriptionDialog.value = true;
  };
  const closeMoveSubscriptionDialog = () => {
    showMoveSubscriptionDialog.value = false;
  };
  const toggleMoveSubscriptionDialog = () => {
    showMoveSubscriptionDialog.value = !showMoveSubscriptionDialog.value;
  };

  /** Close every open dialog at once. */
  const closeAll = () => {
    showAddSubscriptionDialog.value = false;
    showAddFolderDialog.value = false;
    showEditFolderDialog.value = false;
    showEditSubscriptionDialog.value = false;
    showMoveFolderDialog.value = false;
    showMoveSubscriptionDialog.value = false;
  };

  /** Reset everything (logout / app-close). */
  const $reset = () => {
    closeAll();
    editFolderDialogOldFolderName.value = '';
    editSubscriptionOldRssInfo.value = null;
    currentFolderName.value = '';
    moveSubscriptionParams.value = null;
  };

  return {
    // state
    showAddSubscriptionDialog,
    showAddFolderDialog,
    showEditFolderDialog,
    editFolderDialogOldFolderName,
    showEditSubscriptionDialog,
    editSubscriptionOldRssInfo,
    showMoveFolderDialog,
    currentFolderName,
    showMoveSubscriptionDialog,
    moveSubscriptionParams,
    // add subscription
    openAddSubscriptionDialog,
    closeAddSubscriptionDialog,
    toggleSubscriptionDialog,
    toggleAddSubscriptionDialog,
    // add folder
    openAddFolderDialog,
    closeAddFolderDialog,
    toggleAddFolderDialog,
    // edit folder
    openEditFolderDialog,
    closeEditFolderDialog,
    toggleEditFolderDialog,
    setEditFolderDialogOldFolderName,
    // edit subscription
    setEditSubscriptionOldRssInfo,
    openEditSubscriptionDialog,
    closeEditSubscriptionDialog,
    toggleEditSubscriptionDialog,
    // move folder
    openMoveFolderDialog,
    closeMoveFolderDialog,
    toggleMoveFolderDialog,
    // move subscription
    setMoveSubscriptionParams,
    openMoveSubscriptionDialog,
    closeMoveSubscriptionDialog,
    toggleMoveSubscriptionDialog,
    // bulk
    closeAll,
    $reset,
  };
});
