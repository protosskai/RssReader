<template>
  <q-header elevated class="bg-primary text-white">
    <q-toolbar>
      <q-btn dense flat round icon="menu" @click="toggleLeftDrawer"/>

      <q-toolbar-title>
        <q-avatar>
          <img src="https://cdn.quasar.dev/logo-v2/svg/logo-mono-white.svg">
        </q-avatar>
        Rss Reader
      </q-toolbar-title>
      <q-btn flat round color="white" icon="add" @click="addSubscription">
        <q-tooltip>
          添加订阅源
        </q-tooltip>
      </q-btn>
      <q-btn flat round color="white" icon="refresh">
        <q-tooltip>
          刷新订阅
        </q-tooltip>
      </q-btn>
      <q-btn flat round color="white" icon="settings">
        <q-tooltip>
          设置
        </q-tooltip>
      </q-btn>
    </q-toolbar>
    <subscribe-dialog/>
  </q-header>
</template>

<script setup lang="ts">
import {inject, provide, ref} from "vue";
import {TOGGLE_LAYOUT_LEFT_DRAWER_FUNC, SUBSCRIBE_DIALOG_REF} from "src/const/InjectionKey";
import SubscribeDialog from "components/SubscribeDialog.vue";

const toggleLeftDrawer = inject(TOGGLE_LAYOUT_LEFT_DRAWER_FUNC)
const showSubscribeDialog = ref(false);
provide(SUBSCRIBE_DIALOG_REF, showSubscribeDialog);
const addSubscription = () => {
  showSubscribeDialog.value = true
}
</script>
