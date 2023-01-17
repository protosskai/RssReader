<template>
  <div class="q-pa-sm">
    <q-list>
      <q-item
        v-for="rssInfo in RssInfoList"
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
        <sub-subscription-item-context-menu :id="rssInfo.id"/>
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">

import {inject} from "vue";
import {RSS_INFO_LIST_REF} from "src/const/InjectionKey";
import {QItem} from "quasar";
import SubSubscriptionItemContextMenu from "components/SubSubscriptionItemContextMenu.vue";

const RssInfoList = inject(RSS_INFO_LIST_REF)
</script>
