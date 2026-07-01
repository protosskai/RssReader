<template>
  <q-header elevated class="bg-primary text-white">
    <q-bar class="q-electron-drag" style="height: 45px">
      <q-toolbar>
        <!-- Sidebar toggle -->
        <q-btn
          dense flat round icon="menu"
          @click="toggleLeftDrawer"
          aria-label="切换侧边栏"
          tabindex="0"
        >
          <q-tooltip>侧边栏</q-tooltip>
        </q-btn>

        <!-- App title -->
        <q-toolbar-title>
          {{ SOFT_NAME }}
        </q-toolbar-title>

        <!-- Refresh button with loading indicator -->
        <q-btn
          flat round color="white" icon="refresh"
          @click="handleRefresh"
          :disable="rssInfoStore.isLoading"
          aria-label="刷新订阅列表"
        >
          <q-tooltip>{{ rssInfoStore.isLoading ? '刷新中...' : '刷新订阅' }}</q-tooltip>
          <q-spinner
            v-if="rssInfoStore.isLoading"
            color="white" size="1.2em"
            class="absolute-center"
            aria-label="加载中"
          />
        </q-btn>

        <!-- Add button with menu -->
        <q-btn
          flat round color="white" icon="add"
          aria-label="添加订阅或文件夹"
        >
          <q-menu
            transition-show="jump-down"
            transition-hide="jump-up"
          >
            <q-list style="min-width: 180px" role="menu">
              <q-item
                clickable v-close-popup
                @click="openAddSubscription"
                role="menuitem"
                aria-label="添加订阅源"
              >
                <q-item-section avatar>
                  <q-icon name="rss_feed" />
                </q-item-section>
                <q-item-section>添加订阅源</q-item-section>
              </q-item>
              <q-separator />
              <q-item
                clickable v-close-popup
                @click="openAddFolder"
                role="menuitem"
                aria-label="新建文件夹"
              >
                <q-item-section avatar>
                  <q-icon name="create_new_folder" />
                </q-item-section>
                <q-item-section>新建文件夹</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <!-- Home button -->
        <q-btn
          flat round color="white" icon="home"
          @click="openHomePage"
          aria-label="返回主页"
        >
          <q-tooltip>主页</q-tooltip>
        </q-btn>
      </q-toolbar>

      <!-- Electron window controls -->
      <q-btn
        dense flat icon="minimize"
        @click="minimize"
        aria-label="最小化窗口"
      >
        <q-tooltip>最小化</q-tooltip>
      </q-btn>
      <q-btn
        dense flat icon="close"
        @click="closeApp"
        aria-label="关闭应用"
      >
        <q-tooltip>关闭</q-tooltip>
      </q-btn>
    </q-bar>

    <!-- Refresh error banner with slide transition -->
    <q-slide-transition>
      <div
        v-if="refreshError"
        class="bg-negative text-white text-center q-py-xs cursor-pointer"
        style="font-size: 12px; line-height: 1.6"
        role="alert"
        aria-live="polite"
        @click="handleRefresh"
      >
        <q-icon name="error_outline" size="14px" class="q-mr-xs" />
        {{ refreshError }}
        <q-btn
          flat dense rounded color="white"
          icon="refresh" size="sm"
          class="q-ml-sm"
          aria-label="重试刷新订阅"
          @click.stop="handleRefresh"
        >
          <q-tooltip>点击重试</q-tooltip>
        </q-btn>
      </div>
    </q-slide-transition>

    <!-- Dialogs -->
    <add-subscription-dialog />
    <add-folder-dialog />
  </q-header>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue';
import { electronClient } from 'src/services/electronClient';
import { TOGGLE_LAYOUT_LEFT_DRAWER_FUNC } from 'src/const/InjectionKey';
import AddSubscriptionDialog from 'components/AddSubscriptionDialog.vue';
import { switchPage } from 'src/common/util';
import { SOFT_NAME } from 'src/const/string';
import AddFolderDialog from 'components/AddFolderDialog.vue';
import { useSystemDialogStore } from 'stores/systemDialogStore';
import { useRssInfoStore } from 'stores/rssInfoStore';
import { useQuasar } from 'quasar';

const $q = useQuasar();
const rssInfoStore = useRssInfoStore();
const systemDialogStore = useSystemDialogStore();
const { openAddSubscriptionDialog, openAddFolderDialog } = systemDialogStore;
const toggleLeftDrawer = inject(TOGGLE_LAYOUT_LEFT_DRAWER_FUNC);

/** Local error banner state for refresh failures */
const refreshError = ref<string | null>(null);

/** Open the add-subscription dialog */
const openAddSubscription = () => {
  openAddSubscriptionDialog();
};

/** Open the add-folder dialog */
const openAddFolder = () => {
  openAddFolderDialog();
};

/** Handle refresh button: call store refresh, show success/error feedback */
const handleRefresh = async () => {
  refreshError.value = null;
  await rssInfoStore.refresh();
  if (rssInfoStore.error) {
    refreshError.value = rssInfoStore.error;
    $q.notify({
      message: '刷新失败：' + rssInfoStore.error,
      color: 'negative',
      position: 'top',
      timeout: 3000,
      icon: 'error_outline',
    });
  } else {
    $q.notify({
      message: '订阅列表已刷新',
      color: 'positive',
      position: 'top',
      timeout: 1500,
      icon: 'check_circle',
    });
  }
};

/** Navigate to home page */
const openHomePage = () => {
  switchPage('Home');
};

/** Close the Electron app */
const closeApp = () => {
  if (process.env.MODE === 'electron') {
    electronClient.close();
  }
};

/** Minimize the Electron window */
const minimize = () => {
  if (process.env.MODE === 'electron') {
    electronClient.minimize();
  }
};
</script>
