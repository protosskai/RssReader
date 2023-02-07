import {defineStore} from 'pinia';
import {ref} from "vue";

export const useSystemDialogStore = defineStore('systemDialogStore', () => {
  const showAddSubscriptionDialog = ref(false)
  const showAddFolderDialog = ref(false)
  const showEditFolderDialog = ref(false)
  const editFolderDialogOldFolderName = ref('')
  const toggleSubscriptionDialog = () => {
    showAddSubscriptionDialog.value = !showAddSubscriptionDialog.value
  }
  const toggleAddFolderDialog = () => {
    showAddFolderDialog.value = !showAddFolderDialog.value
  }
  const toggleEditFolderDialog = () => {
    showEditFolderDialog.value = !showEditFolderDialog.value
  }
  const setEditFolderDialogOldFolderName = (name: string) => {
    editFolderDialogOldFolderName.value = name
  }
  return {
    showAddSubscriptionDialog,
    showAddFolderDialog,
    toggleSubscriptionDialog,
    toggleAddFolderDialog,
    showEditFolderDialog,
    toggleEditFolderDialog,
    editFolderDialogOldFolderName,
    setEditFolderDialogOldFolderName
  }
})
