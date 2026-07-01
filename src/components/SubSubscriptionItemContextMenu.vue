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
import {RssInfoItem} from "src/common/models";
import { electronClient } from "src/services/electronClient";
import {useClipboard} from '@vueuse/core'
import {ref} from "vue";
import {useQuasar} from 'quasar'
import {useRssInfoStore} from "stores/rssInfoStore";

const $q = useQuasar()

const feedUrl = ref('')
const {copy, isSupported} = useClipboard({source: feedUrl})

const props = defineProps<{
  rssInfo: RssInfoItem,
  folderName: string
}>()

const rssInfoStore = useRssInfoStore()
const {removeRssSubscription} = rssInfoStore

interface ContextMenuItem {
  title: string,
  icon?: string,
  clickHandler?: () => void,
  separator?: boolean
}

const onOpenHomePage = () => {
  electronClient.openLink(props.rssInfo.htmlUrl)
}
const onCopyFeedUrl = () => {
  feedUrl.value = props.rssInfo.feedUrl
  if (isSupported.value) {
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
const onDeleted = async () => {
  const errMsg = await removeRssSubscription(props.rssInfo.id)
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
    title: '复制订阅链接',
    clickHandler: onCopyFeedUrl
  },
  {
    title: '删除',
    clickHandler: onDeleted
  },
]
</script>
