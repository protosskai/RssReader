<template>
  <q-menu
    touch-position
    context-menu
  >
    <q-list dense style="min-width: 100px">
      <q-item clickable v-close-popup v-for="(item, index) in contextMenuInfo"
              :key="index"
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
const props = defineProps<{
  id: number
}>()

export interface ContextMenuItem {
  title: string,
  icon?: string,
  clickHandler?: () => void,
  separator?: boolean
}

const onOpenHomePage = () => {
  console.log(`打开了${props.id}的主页`)
  window.electronAPI.testRss()
}
const onMarkRead = () => {

}
const onOpenEditDialog = () => {

}
const onCopyFeedUrl = () => {

}
const onRename = () => {

}
const onDeleted = () => {

}
const contextMenuInfo: ContextMenuItem[] = [
  {
    title: '打开主页',
    clickHandler: onOpenHomePage
  },
  {
    title: '标为已读',
    clickHandler: onMarkRead
  },
  {
    title: '复制订阅链接',
    clickHandler: onCopyFeedUrl
  },
  {
    title: '编辑',
    clickHandler: onOpenEditDialog
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
