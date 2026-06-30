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

const props = defineProps<{
  folderName: string
}>()
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

const onMarkedRead = () => {

}

const onRename = () => {
  setEditFolderDialogOldFolderName(props.folderName)
  toggleEditFolderDialog()
}
const onDeleted = async () => {
  const result = await removeFolder(props.folderName)
  if (!result?.success) {
    // Error handled by store
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
