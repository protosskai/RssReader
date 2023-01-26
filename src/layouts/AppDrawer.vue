<template>
  <q-drawer v-model="leftDrawerOpen" side="left" elevated overlay>
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
import {computed, inject, onMounted, provide, Ref, ref} from "vue";
import {RSS_FOLDER_LIST_REF, TOGGLE_LAYOUT_LEFT_DRAWER_REF} from "src/const/InjectionKey";
import SubscriptionList from "components/SubscriptionList.vue";
import {userRssInfoStore} from "stores/rssInfoStore";

const store = userRssInfoStore()
const search = ref('')
const leftDrawerOpen = inject(TOGGLE_LAYOUT_LEFT_DRAWER_REF)
provide(RSS_FOLDER_LIST_REF, computed(() => store.rssFolderList))
</script>
