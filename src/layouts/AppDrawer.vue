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
    <div class="q-pa-sm">
      <q-list>
        <q-item
          v-for="rssInfo in rssListInfo"
          :key="rssInfo.id"
          clickable
          v-ripple
        >
          <q-item-section avatar>
            <q-avatar>
              <img :src="rssInfo.avatar">
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label lines="1">
              {{ rssInfo.title }}
            </q-item-label>
            <q-item-label class="conversation__summary" caption v-if="rssInfo.unread !== 0">
              <q-icon name="mark_chat_unread" color="red-6"/>
              {{ rssInfo.unread }}未读
            </q-item-label>
            <q-item-label class="conversation__summary" caption v-else>
              <q-icon name="check"/>
              已读
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-item-label caption>
              {{ rssInfo.lastUpdateTime }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import {inject, ref} from "vue";
import {TOGGLE_LAYOUT_LEFT_DRAWER_REF} from "src/const/InjectionKey";

const search = ref('')
const leftDrawerOpen = inject(TOGGLE_LAYOUT_LEFT_DRAWER_REF)
const rssListInfo = [
  {
    id: 1,
    avatar: 'https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/6c61ae65d1c41ae8221a670fa32d05aa.svg',
    title: '稀土掘金',
    unread: 0,
    lastUpdateTime: '2022-01-03'
  }
]
</script>
