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
import {RssInfoItem} from "src/common/RssInfoItem";
import {useClipboard} from '@vueuse/core'
import {ref} from "vue";
import {useQuasar} from 'quasar'
import {userRssInfoStore} from "stores/rssInfoStore";

const feedUrl = ref('')
const {copy, isSupported} = useClipboard({source: feedUrl})

const props = defineProps<{
  rssInfo: RssInfoItem,
  folderName: string
}>()
const $q = useQuasar()
const rssInfoStore = userRssInfoStore()
const {removeRssSubscription} = rssInfoStore

export interface ContextMenuItem {
  title: string,
  icon?: string,
  clickHandler?: () => void,
  separator?: boolean
}

const onOpenHomePage = () => {
  const htmlUrl = props.rssInfo.htmlUrl
  window.electronAPI.openLink(htmlUrl)
}
const onMarkRead = () => {

}
const onOpenEditDialog = () => {

}
const onCopyFeedUrl = () => {
  feedUrl.value = props.rssInfo.feedUrl
  if (isSupported) {
    copy(feedUrl.value)
    $q.notify({
      message: '复制成功!'
    })
  } else {
    $q.notify({
      message: '当前浏览器不支持复制!',
      icon: 'announcement'
    })
  }
}
const onRename = () => {

}
const onDeleted = async () => {
  const errMsg = await removeRssSubscription(props.folderName, props.rssInfo)
  if (!errMsg.success) {
    $q.notify({
      message: errMsg.msg,
      icon: 'announcement'
    })
  }
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
