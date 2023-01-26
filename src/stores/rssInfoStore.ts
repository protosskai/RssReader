import {defineStore} from 'pinia';
import {ref, Ref} from "vue";
import {RssFolderItem, RssInfoItem} from "src/common/RssInfoItem";

export const userRssInfoStore = defineStore('rssInfo', () => {
  const rssFolderList: Ref<RssFolderItem[]> = ref([])
  const addRssSubscription = (folderItem: RssFolderItem, rssInfoItem: RssInfoItem) => {
    const targetFolder = rssFolderList.value.find((item) => item.folderName === folderItem.folderName)
    if (!targetFolder) {
      return
    }
    targetFolder.data.push(rssInfoItem)
  }
  const removeRssSubscription = (folderItem: RssFolderItem, rssInfoItem: RssInfoItem) => {
    const targetFolder = rssFolderList.value.find((item) => item.folderName === folderItem.folderName)
    if (!targetFolder) {
      return
    }
    const targetRssInfoItemIndex = targetFolder.data.findIndex((item) => item.id === rssInfoItem.id)
    if (targetRssInfoItemIndex === -1) {
      return;
    }
    targetFolder.data = targetFolder.data.splice(targetRssInfoItemIndex, 1)
  }
  // 初始化RSS菜单数据
  window.electronAPI.getRssFolderList().then(data => {
    rssFolderList.value = data
  })
  return {rssFolderList, addRssSubscription, removeRssSubscription}
})
