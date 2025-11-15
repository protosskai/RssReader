<template>
  <q-page class="home-page">
    <div class="home-container">
      <div class="title text-h3 text-weight-light">{{ SOFT_NAME }}</div>
      <div class="subtitle text-body1 text-grey-6">
        RSS阅读器 · 智能订阅 · 自动同步 · 全文搜索
      </div>

      <!-- 快速操作按钮组 -->
      <div class="quick-actions">
        <div class="action-group">
          <div class="group-title">订阅管理</div>
          <div class="btn-bar">
            <q-btn @click="toggleSubscriptionDialog" color="primary" rounded unelevated>
              <div class="btn-item">
                <q-icon name="rss_feed" size="24px"/>
                <span>{{ ADD_FEED }}</span>
              </div>
            </q-btn>
            <q-btn @click="toggleAddFolderDialog" color="primary" rounded unelevated>
              <div class="btn-item">
                <q-icon name="folder" size="24px"/>
                <span>{{ ADD_FOLDER }}</span>
              </div>
            </q-btn>
            <q-btn @click="importOpmlFile" color="primary" rounded unelevated>
              <div class="btn-item">
                <q-icon name="attachment" size="24px"/>
                <span>{{ IMPORT_OPML }}</span>
              </div>
            </q-btn>
          </div>
        </div>

        <div class="action-group">
          <div class="group-title">同步更新</div>
          <div class="btn-bar">
            <q-btn
              @click="syncAllFeeds"
              :loading="isSyncing"
              color="positive"
              rounded
              unelevated
            >
              <div class="btn-item">
                <q-icon name="sync" size="24px"/>
                <span>同步所有</span>
              </div>
            </q-btn>
            <q-btn
              @click="refreshAllFeeds"
              :loading="isRefreshing"
              color="secondary"
              rounded
              unelevated
            >
              <div class="btn-item">
                <q-icon name="refresh" size="24px"/>
                <span>刷新所有</span>
              </div>
            </q-btn>
          </div>
        </div>

        <div class="action-group">
          <div class="group-title">主题与设置</div>
          <div class="btn-bar">
            <q-btn
              @click="toggleTheme"
              color="grey-8"
              round
              unelevated
            >
              <q-icon :name="isDarkMode ? 'light_mode' : 'dark_mode'" size="24px"/>
              <q-tooltip>{{ isDarkMode ? '切换到亮色主题' : '切换到暗色主题' }}</q-tooltip>
            </q-btn>
            <q-btn
              @click="showKeyboardShortcuts"
              color="grey-8"
              round
              unelevated
            >
              <q-icon name="keyboard" size="24px"/>
              <q-tooltip>键盘快捷键 (Ctrl+Shift+?)</q-tooltip>
            </q-btn>
            <q-btn
              @click="openSettings"
              color="grey-8"
              round
              unelevated
            >
              <q-icon name="settings" size="24px"/>
              <q-tooltip>{{ SETTING }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>

      <!-- 统计信息卡片 -->
      <div class="stats-cards" v-if="stats">
        <q-card flat bordered class="stat-card">
          <q-card-section>
            <div class="stat-number text-h4 text-primary">{{ stats.totalFeeds }}</div>
            <div class="stat-label">订阅源</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="stat-card">
          <q-card-section>
            <div class="stat-number text-h4 text-secondary">{{ stats.totalArticles }}</div>
            <div class="stat-label">文章总数</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="stat-card">
          <q-card-section>
            <div class="stat-number text-h4 text-positive">{{ stats.unreadArticles }}</div>
            <div class="stat-label">未读文章</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="stat-card">
          <q-card-section>
            <div class="stat-number text-h4 text-warning">{{ stats.favoriteArticles }}</div>
            <div class="stat-label">收藏文章</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- 快捷键提示 -->
      <div class="shortcuts-hint">
        <q-chip icon="keyboard" color="grey-2" text-color="grey-8" dense>
          <span class="text-caption">
            <span class="text-bold">Ctrl+R</span> 同步 ·
            <span class="text-bold">Ctrl+F</span> 搜索 ·
            <span class="text-bold">Ctrl+Shift+?</span> 帮助
          </span>
        </q-chip>
      </div>
    </div>

    <!-- 快捷键帮助对话框 -->
    <KeyboardShortcutsDialog ref="shortcutsDialog" />
  </q-page>
</template>
<script setup lang="ts">
import {SOFT_NAME, ADD_FOLDER, ADD_FEED, IMPORT_OPML, SETTING} from "src/const/string";
import {useSystemDialogStore} from "stores/systemDialogStore";
import {useRssInfoStore} from "stores/rssInfoStore";
import {useThemeStore} from "stores/themeStore";
import {useKeyboardStore} from "stores/keyboardStore";
import {ref, computed, onMounted} from 'vue';
import {useQuasar} from 'quasar';
import {useRouter} from 'vue-router';

const systemDialogStore = useSystemDialogStore()
const rssInfoStore = useRssInfoStore()
const themeStore = useThemeStore()
const keyboardStore = useKeyboardStore()
const router = useRouter()
const {toggleSubscriptionDialog, toggleAddFolderDialog} = systemDialogStore
const {importOpmlFile} = rssInfoStore
const $q = useQuasar();
const isRefreshing = ref(false);
const isSyncing = ref(false);

// 定义组件引用
const shortcutsDialog = ref<InstanceType<typeof KeyboardShortcutsDialog> | null>(null)

// 计算属性
const isDarkMode = computed(() => themeStore.isDarkMode);

// 统计数据
const stats = computed(() => {
  return {
    totalFeeds: rssInfoStore.rssFolderList.reduce((sum, folder) => sum + folder.data.length, 0),
    totalArticles: rssInfoStore.totalArticleCount || 0,
    unreadArticles: rssInfoStore.unreadArticleCount || 0,
    favoriteArticles: rssInfoStore.favoriteCount || 0
  }
});

// 主题切换
const toggleTheme = () => {
  themeStore.toggleMode();
  $q.notify({
    type: 'positive',
    message: `已切换到${themeStore.currentMode === 'light' ? '亮色' : themeStore.currentMode === 'dark' ? '暗色' : '系统'}主题`,
    position: 'top'
  });
};

// 快捷键帮助
const showKeyboardShortcuts = () => {
  // 通过ref调用子组件方法
  if (shortcutsDialog.value && shortcutsDialog.value.open) {
    shortcutsDialog.value.open();
  }
};

// 打开设置页面
const openSettings = () => {
  router.push('/setting');
};

// 同步所有订阅源
const syncAllFeeds = async () => {
  isSyncing.value = true;
  try {
    await rssInfoStore.syncAll();
    $q.notify({
      type: 'positive',
      message: '所有订阅源同步完成',
      position: 'top'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '同步失败: ' + (error as Error).message,
      position: 'top'
    });
  } finally {
    isSyncing.value = false;
  }
};

// 刷新所有订阅源
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

// 生命周期
onMounted(() => {
  // 初始化主题
  themeStore.initializeTheme();
});
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
