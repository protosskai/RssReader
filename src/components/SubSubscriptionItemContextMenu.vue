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
import {useQuasar} from 'quasar'
import {useRssInfoStore} from "stores/rssInfoStore";

const $q = useQuasar()

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
const onCopyFeedUrl = async () => {
  const url = props.rssInfo.feedUrl
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    $q.notify({ message: '复制成功!', position: 'top' })
  } catch {
    $q.notify({ message: '复制失败', color: 'negative', position: 'top' })
  }
}
const onDeleted = async () => {
  try {
    // store signature: (folderName, rssInfoItem) — throws on failure
    await removeRssSubscription(props.folderName, props.rssInfo)
    $q.notify({
      message: '订阅已删除',
      color: 'positive',
      position: 'top',
    })
  } catch (error) {
    $q.notify({
      message: error instanceof Error ? error.message : '删除失败',
      color: 'negative',
      icon: 'announcement',
      position: 'top',
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
