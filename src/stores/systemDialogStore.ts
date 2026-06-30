import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSystemDialogStore = defineStore('systemDialogStore', () => {
  // ── State ────────────────────────────────────────────────
  const showAddSubscriptionDialog = ref(false);
  const showAddFolderDialog = ref(false);
  const showEditFolderDialog = ref(false);
  const editFolderDialogOldFolderName = ref('');

  // ── Explicit open / close (safer than toggle-only) ───────

  // Add Subscription
  const openAddSubscriptionDialog = () => {
    showAddSubscriptionDialog.value = true;
  };
  const closeAddSubscriptionDialog = () => {
    showAddSubscriptionDialog.value = false;
  };
  /**
   * @deprecated Prefer explicit open/close.
   * Kept for backward compatibility.
   */
  const toggleSubscriptionDialog = () => {
    showAddSubscriptionDialog.value = !showAddSubscriptionDialog.value;
  };

  // Add Folder
  const openAddFolderDialog = () => {
    showAddFolderDialog.value = true;
  };
  const closeAddFolderDialog = () => {
    showAddFolderDialog.value = false;
  };
  /**
   * @deprecated Prefer explicit open/close.
   * Kept for backward compatibility.
   */
  const toggleAddFolderDialog = () => {
    showAddFolderDialog.value = !showAddFolderDialog.value;
  };

  // Edit Folder
  const openEditFolderDialog = (oldFolderName: string) => {
    editFolderDialogOldFolderName.value = oldFolderName;
    showEditFolderDialog.value = true;
  };
  const closeEditFolderDialog = () => {
    showEditFolderDialog.value = false;
  };
  /**
   * @deprecated Prefer openEditFolderDialog(name).
   * Kept for backward compatibility.
   */
  const toggleEditFolderDialog = () => {
    showEditFolderDialog.value = !showEditFolderDialog.value;
  };

  const setEditFolderDialogOldFolderName = (name: string) => {
    editFolderDialogOldFolderName.value = name;
  };

  /** Close every open dialog at once. */
  const closeAll = () => {
    showAddSubscriptionDialog.value = false;
    showAddFolderDialog.value = false;
    showEditFolderDialog.value = false;
  };

  /** Reset everything (logout / app-close). */
  const $reset = () => {
    closeAll();
    editFolderDialogOldFolderName.value = '';
  };

  return {
    // state
    showAddSubscriptionDialog,
    showAddFolderDialog,
    showEditFolderDialog,
    editFolderDialogOldFolderName,
    // explicit open/close
    openAddSubscriptionDialog,
    closeAddSubscriptionDialog,
    openAddFolderDialog,
    closeAddFolderDialog,
    openEditFolderDialog,
    closeEditFolderDialog,
    // legacy toggles (kept for backward compat)
    toggleSubscriptionDialog,
    toggleAddFolderDialog,
    toggleEditFolderDialog,
    setEditFolderDialogOldFolderName,
    // bulk operations
    closeAll,
    $reset,
  };
});
