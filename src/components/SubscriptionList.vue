<template>
  <div class="q-pa-sm">
    <q-tree
      :nodes="nodes"
      node-key="label"
      no-connectors
      dense
    >
      <template #default-header="props">
        <div v-if="!props.node.data">
          <q-item>
            <q-item-section avatar>
              <q-icon name="folder"/>
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ props.node.label }}
              </q-item-label>
            </q-item-section>
            <folder-context-menu :folder-name="props.node.label"/>
          </q-item>
        </div>
        <div v-else></div>
      </template>
      <template #default-body="prop">
        <q-item
          v-if="prop.node.data"
          clickable
          v-ripple
          @click="openPostList(prop.node.data.id)"
        >
          <q-item-section avatar>
            <q-avatar>
              <img :src="prop.node.data.avatar">
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label lines="1">
              {{ prop.node.data.title }}
            </q-item-label>
            <q-item-label class="conversation__summary" caption v-if="prop.node.data.unread !== 0">
              <q-icon name="mark_chat_unread" color="red-6"/>
              {{ prop.node.data.unread }}未读
            </q-item-label>
            <q-item-label class="conversation__summary" caption v-else>
              <q-icon name="check"/>
              已读
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-item-label caption>
              {{ prop.node.data.lastUpdateTime }}
            </q-item-label>
          </q-item-section>
          <sub-subscription-item-context-menu :rss-info="prop.node.data" :folder-name="prop.node.folderName"/>
        </q-item>
      </template>
    </q-tree>
  </div>
</template>

<script setup lang="ts">

import {computed, inject, onMounted} from "vue";
import {RSS_FOLDER_LIST_REF} from "src/const/InjectionKey";
import {QItem} from "quasar";
import SubSubscriptionItemContextMenu from "components/SubSubscriptionItemContextMenu.vue";
import {switchPage} from "src/common/util";
import FolderContextMenu from "components/FolderContextMenu.vue";


const RssFolderList = inject(RSS_FOLDER_LIST_REF)
const nodes = computed(() => (
  RssFolderList?.value.map(item => ({
    label: item.folderName,
    icon: 'folder',
    children: item.data.map(item1 => ({
      label: item1.title,
      avatar: item1.avatar,
      data: item1,
      folderName: item.folderName
    }))
  })) ?? []
))
const openPostList = (RssId: number) => {
  switchPage('PostList', {
    RssId
  })
}

</script>
