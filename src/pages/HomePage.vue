<template>
  <q-page class="row items-center justify-evenly">
    <div>
      <div class="title text-h3 text-weight-light">{{ SOFT_NAME }}</div>
      <div class="btn-bar">
        <q-btn @click="toggleSubscriptionDialog">
          <div class="btn-item">
            <q-icon name="rss_feed" size="24px"/>
            <span>{{ ADD_FEED }}</span>
          </div>
        </q-btn>
        <q-btn @click="toggleAddFolderDialog">
          <div class="btn-item">
            <q-icon name="folder" size="24px"/>
            <span>{{ ADD_FOLDER }}</span></div>
        </q-btn>
        <q-btn @click="importOpmlFile">
          <div class="btn-item">
            <q-icon name="attachment" size="24px"/>
            <span>{{ IMPORT_OPML }}</span></div>
        </q-btn>
        <q-btn @click="refreshAllFeeds" :loading="isRefreshing">
          <div class="btn-item">
            <q-icon name="refresh" size="24px"/>
            <span>刷新所有</span></div>
        </q-btn>
        <q-btn>
          <div class="btn-item">
            <q-icon name="settings" size="24px"/>
            <span>{{ SETTING }}</span></div>
        </q-btn>
      </div>
    </div>
  </q-page>
</template>
<script setup lang="ts">
import {SOFT_NAME, ADD_FOLDER, ADD_FEED, IMPORT_OPML, SETTING} from "src/const/string";
import {useSystemDialogStore} from "stores/systemDialogStore";
import {useRssInfoStore} from "stores/rssInfoStore";
import {ref} from 'vue';
import {useQuasar} from 'quasar';

const systemDialogStore = useSystemDialogStore()
const rssInfoStore = useRssInfoStore()
const {toggleSubscriptionDialog, toggleAddFolderDialog} = systemDialogStore
const {importOpmlFile} = rssInfoStore
const $q = useQuasar();
const isRefreshing = ref(false);

const refreshAllFeeds = async () => {
  isRefreshing.value = true;
  try {
    await rssInfoStore.refresh();
    $q.notify({
      type: 'positive',
      message: '所有订阅源已刷新',
      position: 'top'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '刷新失败: ' + (error as Error).message,
      position: 'top'
    });
  } finally {
    isRefreshing.value = false;
  }
};

</script>

<style scoped lang="scss">
.title {
  text-align: center;
}

.btn-bar {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin: 20px 0;

  .q-btn {
    margin: 0 8px;
  }

  .btn-item {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
  }
}
</style>
