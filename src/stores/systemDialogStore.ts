import {defineStore} from 'pinia';
import {ref} from "vue";

export const useSystemDialogStore = defineStore('systemDialogStore', () => {
  const showAddSubscriptionDialog = ref(false)
  const showAddFolderDialog = ref(false)
  const toggleSubscriptionDialog = () => {
    showAddSubscriptionDialog.value = !showAddSubscriptionDialog.value
  }
  const toggleAddFolderDialog = () => {
    showAddFolderDialog.value = !showAddFolderDialog.value
  }
  return {
    showAddSubscriptionDialog,
    showAddFolderDialog,
    toggleSubscriptionDialog,
    toggleAddFolderDialog
  }
})
