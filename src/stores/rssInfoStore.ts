import {defineStore} from 'pinia';
import {computed, ref, Ref} from "vue";
import {RssFolderItem, RssInfoItem, RssInfoNew} from "src/common/RssInfoItem";
import {ErrorMsg} from "src/common/ErrorMsg";

export const userRssInfoStore = defineStore('rssInfo', () => {
  const rssFolderList: Ref<RssFolderItem[]> = ref([])
  const folderNameList = computed(() => (rssFolderList.value.map(item => item.folderName)))
  const addRssSubscription = async (feedUrl: string, title: string, folderName: string) => {
    const obj: RssInfoNew = {
      feedUrl,
      title,
      folderName
    }
    await window.electronAPI.addRssSubscription(obj)
    rssFolderList.value = await window.electronAPI.getRssFolderList()
  }
  const removeRssSubscription = (folderName: string, rssInfoItem: RssInfoItem) => {
    const targetFolder = rssFolderList.value.find((item) => item.folderName === folderName)
    if (!targetFolder) {
      return
    }
    const targetRssInfoItemIndex = targetFolder.data.findIndex((item) => item.id === rssInfoItem.id)
    if (targetRssInfoItemIndex === -1) {
      return;
    }
    targetFolder.data = targetFolder.data.splice(targetRssInfoItemIndex, 1)
  }
  const refresh = async () => {
    const data = await window.electronAPI.getRssFolderList()
    rssFolderList.value = data
  }
  const addFolder = async (folderName: string): Promise<ErrorMsg> => {
    const errMsg = await window.electronAPI.addFolder(folderName)
    await refresh()
    return errMsg
  }
  // 初始化RSS菜单数据
  window.electronAPI.getRssFolderList().then(data => {
    rssFolderList.value = data
  })
  return {rssFolderList, addRssSubscription, removeRssSubscription, folderNameList, addFolder}
})
