<template>
  <q-drawer v-model="leftDrawerOpen" side="left" elevated>
    <q-toolbar class="bg-grey-2">
      <q-input rounded outlined dense class="WAL__field full-width" bg-color="white" v-model="search"
               placeholder="搜索订阅源">
        <template v-slot:prepend>
          <q-icon name="search"/>
        </template>
      </q-input>
    </q-toolbar>
    <subscription-list :rss-info-list="rssListInfo"/>
  </q-drawer>
</template>

<script setup lang="ts">
import {inject, provide, ref} from "vue";
import {TOGGLE_LAYOUT_LEFT_DRAWER_REF, RSS_INFO_LIST_REF} from "src/const/InjectionKey";
import SubscriptionList from "components/SubscriptionList.vue";

const search = ref('')
const leftDrawerOpen = inject(TOGGLE_LAYOUT_LEFT_DRAWER_REF)
const rssListInfo = ref([
  {
    id: 1,
    avatar: 'https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/6c61ae65d1c41ae8221a670fa32d05aa.svg',
    title: '稀土掘金',
    unread: 0,
    lastUpdateTime: '2022-01-03'
  },
  {
    id: 2,
    avatar: 'https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/6c61ae65d1c41ae8221a670fa32d05aa.svg',
    title: '稀土掘金',
    unread: 9,
    lastUpdateTime: '2022-01-03'
  },
  {
    id: 3,
    avatar: 'https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/6c61ae65d1c41ae8221a670fa32d05aa.svg',
    title: '稀土掘金',
    unread: 12,
    lastUpdateTime: '2022-01-03'
  },
])
provide(RSS_INFO_LIST_REF, rssListInfo)
</script>
