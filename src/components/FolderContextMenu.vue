<template>
  <q-menu
    touch-position
    context-menu
  >
    <q-list dense style="min-width: 100px">
      <q-item clickable v-close-popup v-for="(item, index) in contextMenuInfo"
              :key="item.title"
              @click="item.clickHandler"
      >
        <q-item-section>{{ item.title }}</q-item-section>
        <q-item-section side v-if="item.icon">
          <q-icon :name="item.icon"/>
        </q-item-section>
      </q-item>
    </q-list>

  </q-menu>
</template>
<script setup lang="ts">
import {useRssInfoStore} from "stores/rssInfoStore";
import {useSystemDialogStore} from "stores/systemDialogStore";
import { electronClient } from "src/services/electronClient";
import { useQuasar } from "quasar";

const props = defineProps<{
  folderName: string
}>()
const $q = useQuasar()
const systemDialogStore = useSystemDialogStore()
const {toggleEditFolderDialog, setEditFolderDialogOldFolderName} = systemDialogStore
const rssInfoStore = useRssInfoStore()
const {removeFolder} = rssInfoStore

interface ContextMenuItem {
  title: string,
  icon?: string,
  clickHandler?: () => void,
  separator?: boolean
}

const onMarkedRead = async () => {
  try {
    await electronClient.markAllAsRead({ folderName: props.folderName })
    await rssInfoStore.refresh()
    $q.notify({ message: `「${props.folderName}」已全部标为已读`, color: 'positive', position: 'top' })
  } catch (e) {
    $q.notify({
      message: e instanceof Error ? e.message : '标记已读失败',
      color: 'negative',
      position: 'top',
    })
  }
}

const onRename = () => {
  setEditFolderDialogOldFolderName(props.folderName)
  toggleEditFolderDialog()
}
const onDeleted = async () => {
  try {
    await removeFolder(props.folderName)
    $q.notify({ message: '文件夹已删除', color: 'positive', position: 'top' })
  } catch (e) {
    $q.notify({
      message: e instanceof Error ? e.message : '删除失败',
      color: 'negative',
      position: 'top',
    })
  }
}
const contextMenuInfo: ContextMenuItem[] = [
  {
    title: '标记为已读',
    clickHandler: onMarkedRead
  },
  {
    title: '重命名',
    clickHandler: onRename
  },
  {
    title: '删除',
    clickHandler: onDeleted
  },
]
</script>
