import {defineStore} from 'pinia';
import {computed, ref, Ref} from "vue";
import {RssFolderItem, RssInfoItem, RssInfoNew} from "src/common/RssInfoItem";
import {ErrorMsg} from "src/common/ErrorMsg";

export const useRssInfoStore = defineStore('rssInfo', () => {
  const rssFolderList: Ref<RssFolderItem[]> = ref([])
  const folderNameList = computed(() => (rssFolderList.value.map(item => item.folderName)))
  const refresh = async () => {
    rssFolderList.value = await window.electronAPI.getRssInfoListFromDb()
  }
  const addRssSubscription = async (feedUrl: string, title: string, folderName: string) => {
    const obj: RssInfoNew = {
      feedUrl,
      title,
      folderName
    }
    await window.electronAPI.addRssSubscription(obj)
    await refresh()
  }
  const removeRssSubscription = async (folderName: string, rssInfoItem: RssInfoItem): Promise<ErrorMsg> => {
    const errMsg = await window.electronAPI.removeRssSubscription(folderName, rssInfoItem.feedUrl)
    await refresh()
    return errMsg
  }
  const addFolder = async (folderName: string): Promise<ErrorMsg> => {
    const errMsg = await window.electronAPI.addFolder(folderName)
    await refresh()
    return errMsg
  }
  const editFolder = async (oldFolderName: string, newFolderName: string): Promise<ErrorMsg> => {
    const errMsg = await window.electronAPI.editFolder(oldFolderName, newFolderName)
    await refresh()
    return errMsg
  }
  const removeFolder = async (folderName: string): Promise<ErrorMsg> => {
    const errMsg = await window.electronAPI.removeFolder(folderName)
    await refresh()
    return errMsg
  }
  const importOpmlFile = async (): Promise<ErrorMsg> => {
    const errMsg = await window.electronAPI.importOpmlFile()
    await refresh()
    return errMsg
  }
  // 初始化RSS菜单数据
  window.electronAPI.getRssInfoListFromDb().then(data => {
    rssFolderList.value = data
  })
  return {
    rssFolderList,
    addRssSubscription,
    removeRssSubscription,
    folderNameList,
    addFolder,
    removeFolder,
    importOpmlFile,
    editFolder
  }
})
