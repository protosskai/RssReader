<template>
  <q-page class="row items-center justify-evenly">
    <div>
      <div class="title text-h3 text-weight-light">{{ SOFT_NAME }}</div>
      <div class="btn-bar">
        <q-btn>
          <div class="btn-item">
            <q-icon name="rss_feed" size="24px"/>
            <span>{{ ADD_FEED }}</span>
          </div>
        </q-btn>
        <q-btn>
          <div class="btn-item">
            <q-icon name="folder" size="24px"/>
            <span>{{ ADD_FOLDER }}</span></div>
        </q-btn>
        <q-btn>
          <div class="btn-item">
            <q-icon name="attachment" size="24px"/>
            <span>{{ IMPORT_OPML }}</span></div>
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
