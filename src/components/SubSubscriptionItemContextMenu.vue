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
      <!--      <q-item clickable v-close-popup>-->
      <!--        <q-item-section>Open...</q-item-section>-->
      <!--      </q-item>-->
      <!--      <q-item clickable v-close-popup>-->
      <!--        <q-item-section>New</q-item-section>-->
      <!--      </q-item>-->
      <!--      <q-separator/>-->
      <!--      <q-item clickable v-close-popup>-->
      <!--        <q-item-section>Preferences</q-item-section>-->
      <!--        <q-item-section side>-->
      <!--          <q-icon name="keyboard_arrow_right"/>-->
      <!--        </q-item-section>-->

      <!--      </q-item>-->
      <!--      <q-separator/>-->
      <!--      <q-item clickable v-close-popup>-->
      <!--        <q-item-section>Quit</q-item-section>-->
      <!--      </q-item>-->
    </q-list>

  </q-menu>
</template>
<script setup lang="ts">

export interface ContextMenuItem {
  title: string,
  icon?: string,
  clickHandler?: (id: number) => void,
  separator?: boolean
}

const onOpenHomePage = (id: number) => {

}
const onMarkRead = (id: number) => {

}
const onOpenEditDialog = (id: number) => {

}
const onCopyFeedUrl = (id: number) => {

}
const onRename = (id: number) => {

}
const onDeleted = (id: number) => {

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
