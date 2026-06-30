<template>
  <q-page class="home-page" role="main" aria-label="首页">
    <div class="home-container">
      <header class="page-header">
        <div class="title text-h3 text-weight-light">{{ SOFT_NAME }}</div>
        <div class="subtitle text-body1 text-grey-6">
          RSS阅读器 · 智能订阅 · 自动同步 · 全文搜索
        </div>
      </header>

      <!-- 快速操作按钮组 -->
      <section class="quick-actions" aria-label="快速操作">
        <div class="action-group">
          <div class="group-title">订阅管理</div>
          <div class="btn-bar">
            <q-btn
              @click="toggleSubscriptionDialog"
              color="primary"
              rounded
              unelevated
              aria-label="添加订阅"
            >
              <div class="btn-item">
                <q-icon name="rss_feed" size="24px"/>
                <span>{{ ADD_FEED }}</span>
              </div>
            </q-btn>
            <q-btn
              @click="toggleAddFolderDialog"
              color="primary"
              rounded
              unelevated
              aria-label="添加文件夹"
            >
              <div class="btn-item">
                <q-icon name="folder" size="24px"/>
                <span>{{ ADD_FOLDER }}</span>
              </div>
            </q-btn>
            <q-btn
              @click="importOpmlFile"
              color="primary"
              rounded
              unelevated
              aria-label="导入 OPML 文件"
            >
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
              :disable="isDataLoading"
              color="positive"
              rounded
              unelevated
              aria-label="同步所有订阅源"
            >
              <div class="btn-item">
                <q-icon name="sync" size="24px"/>
                <span>同步所有</span>
              </div>
            </q-btn>
            <q-btn
              @click="refreshAllFeeds"
              :loading="isRefreshing"
              :disable="isDataLoading"
              color="secondary"
              rounded
              unelevated
              aria-label="刷新所有订阅源"
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
              :color="isDarkMode ? 'grey-4' : 'grey-8'"
              round
              unelevated
              aria-label="切换主题"
            >
              <q-icon :name="isDarkMode ? 'light_mode' : 'dark_mode'" size="24px"/>
              <q-tooltip>{{ isDarkMode ? '切换到亮色主题' : '切换到暗色主题' }}</q-tooltip>
            </q-btn>
            <q-btn
              @click="showKeyboardShortcuts"
              :color="isDarkMode ? 'grey-4' : 'grey-8'"
              round
              unelevated
              aria-label="键盘快捷键"
            >
              <q-icon name="keyboard" size="24px"/>
              <q-tooltip>键盘快捷键 (Ctrl+Shift+?)</q-tooltip>
            </q-btn>
            <q-btn
              @click="openSettings"
              :color="isDarkMode ? 'grey-4' : 'grey-8'"
              round
              unelevated
              aria-label="设置"
            >
              <q-icon name="settings" size="24px"/>
              <q-tooltip>{{ SETTING }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </section>

      <!-- 同步进度条 -->
      <div
        v-if="syncProgressStore.progress.isSyncing"
        class="sync-progress q-mb-md"
        role="progressbar"
        :aria-valuenow="syncProgressStore.progressPercent()"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="同步进度"
      >
        <q-linear-progress
          :value="syncProgressStore.progressPercent() / 100"
          color="primary"
          class="q-mb-sm"
          stripe
          animated
        />
        <div class="text-caption text-grey-6 text-center">
          同步中: {{ syncProgressStore.progress.completedCount }}/{{ syncProgressStore.progress.totalSources }}
          <span v-if="syncProgressStore.progress.currentSource"> · {{ syncProgressStore.progress.currentSource }}</span>
        </div>
      </div>

      <!-- 加载骨架屏 - 使用 Transition 实现平滑淡入淡出 -->
      <Transition name="fade" mode="out-in">
        <!-- 加载状态 -->
        <div v-if="isDataLoading" key="loading" class="stats-cards" aria-label="数据加载中">
          <q-card v-for="n in 4" :key="'skel'+n" flat bordered class="stat-card stat-card--skeleton" :class="{ 'stat-card--dark': isDarkMode }">
            <q-card-section class="skeleton-content">
              <q-skeleton type="circle" size="36px" class="skeleton-icon"/>
              <div class="skeleton-text-group">
                <q-skeleton type="text" width="60%" height="32px" class="skeleton-number"/>
                <q-skeleton type="text" width="40%" height="14px" class="q-mt-sm skeleton-label"/>
              </div>
            </q-card-section>
          </q-card>
          <!-- 额外骨架行（大屏展示两行） -->
          <q-card v-for="n in 2" :key="'skel-row2-'+n" flat bordered class="stat-card stat-card--skeleton hidden-mobile" :class="{ 'stat-card--dark': isDarkMode }">
            <q-card-section class="skeleton-content">
              <q-skeleton type="circle" size="36px" class="skeleton-icon"/>
              <div class="skeleton-text-group">
                <q-skeleton type="text" width="50%" height="32px" class="skeleton-number"/>
                <q-skeleton type="text" width="35%" height="14px" class="q-mt-sm skeleton-label"/>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 无订阅源引导 -->
        <div v-else-if="!isDataLoading && stats.totalFeeds === 0 && !dataError" key="empty" class="welcome-empty">
          <div class="empty-illustration">
            <q-icon name="rss_feed" size="80px" :color="isDarkMode ? 'grey-6' : 'grey-5'"/>
            <div class="empty-ring"></div>
          </div>
          <div class="text-h5" :class="isDarkMode ? 'text-grey-3' : 'text-grey-7'">欢迎使用 {{ SOFT_NAME }}</div>
          <div class="text-body1 q-mt-sm" :class="isDarkMode ? 'text-grey-5' : 'text-grey-6'">还没有订阅源，开始添加你的第一个 RSS 订阅吧！</div>
          <div class="empty-actions q-mt-lg q-gutter-sm">
            <q-btn
              color="primary"
              icon="rss_feed"
              :label="ADD_FEED"
              @click="toggleSubscriptionDialog"
              unelevated
              size="md"
              aria-label="添加第一个订阅"
            />
            <q-btn
              color="secondary"
              icon="attachment"
              :label="IMPORT_OPML"
              @click="importOpmlFile"
              unelevated
              outline
              size="md"
              aria-label="从 OPML 文件导入"
            />
          </div>
          <div class="q-mt-lg">
            <q-chip icon="rss_feed" outline :color="isDarkMode ? 'grey-5' : 'grey-7'" text-color="" dense>
              支持 RSS 2.0 / Atom 格式
            </q-chip>
          </div>
        </div>

        <!-- 数据错误状态 -->
        <div v-else-if="dataError" key="error" class="error-section">
          <q-banner rounded class="error-banner q-mb-md" :class="isDarkMode ? 'bg-dark' : 'bg-negative text-white'">
            <template #avatar>
              <q-icon name="error" size="md" :color="isDarkMode ? 'negative' : 'white'"/>
            </template>
            <div class="text-weight-medium">加载失败</div>
            <div class="text-body2 q-mt-xs">{{ dataError }}</div>
            <template #action>
              <q-btn
                flat
                :color="isDarkMode ? 'primary' : 'white'"
                label="重试"
                @click="loadData"
                icon="refresh"
                aria-label="重试加载数据"
              />
            </template>
          </q-banner>

          <!-- 错误时仍显示操作入口 -->
          <div class="q-mt-lg text-center">
            <div class="text-body2 q-mb-md" :class="isDarkMode ? 'text-grey-5' : 'text-grey-6'">
              也可以手动添加订阅源
            </div>
            <q-btn
              color="primary"
              icon="rss_feed"
              :label="ADD_FEED"
              @click="toggleSubscriptionDialog"
              unelevated
              outline
              aria-label="手动添加订阅"
            />
          </div>
        </div>

        <!-- 统计信息卡片 -->
        <div v-else key="stats" class="stats-cards">
          <TransitionGroup name="card-stagger" tag="div" class="stats-grid">
            <q-card
              v-for="(stat, index) in statCards"
              :key="stat.label"
              flat
              bordered
              class="stat-card"
              :class="{ 'stat-card--dark': isDarkMode }"
              :style="{ transitionDelay: `${index * 50}ms` }"
            >
              <q-card-section class="stat-card-section">
                <q-icon
                  :name="stat.icon"
                  :color="stat.iconColor"
                  size="28px"
                  class="stat-card-icon"
                />
                <div class="stat-card-body">
                  <div class="stat-number text-h4" :class="`text-${stat.numberColor}`">{{ stat.value }}</div>
                  <div class="stat-label">{{ stat.label }}</div>
                </div>
              </q-card-section>
            </q-card>
          </TransitionGroup>
        </div>
      </Transition>

      <!-- 快捷键提示 -->
      <footer class="shortcuts-hint">
        <q-chip icon="keyboard" :color="isDarkMode ? 'grey-9' : 'grey-2'" :text-color="isDarkMode ? 'grey-4' : 'grey-8'" dense>
          <span class="text-caption">
            <span class="text-bold">Ctrl+R</span> 同步 ·
            <span class="text-bold">Ctrl+F</span> 搜索 ·
            <span class="text-bold">Ctrl+Shift+?</span> 帮助
          </span>
        </q-chip>
      </footer>
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
import {useSyncProgressStore} from "stores/syncProgressStore";
import {ref, computed, onMounted} from 'vue';
import {useQuasar} from 'quasar';
import {useRouter} from 'vue-router';
import KeyboardShortcutsDialog from 'src/components/KeyboardShortcutsDialog.vue';

const systemDialogStore = useSystemDialogStore()
const rssInfoStore = useRssInfoStore()
const themeStore = useThemeStore()
const syncProgressStore = useSyncProgressStore()
const router = useRouter()
const {toggleSubscriptionDialog, toggleAddFolderDialog} = systemDialogStore
const {importOpmlFile} = rssInfoStore
const $q = useQuasar();

const isDataLoading = ref(true);
const isRefreshing = ref(false);
const isSyncing = ref(false);
const dataError = ref<string | null>(null);

// 组件引用
const shortcutsDialog = ref<InstanceType<typeof KeyboardShortcutsDialog> | null>(null)

// 计算属性
const isDarkMode = computed(() => themeStore.isDarkMode);

// 统计卡片数据
const statCards = computed(() => {
  const s = stats.value;
  return [
    { label: '订阅源', value: s.totalFeeds, icon: 'rss_feed', iconColor: isDarkMode.value ? 'primary' : 'primary', numberColor: 'primary' },
    { label: '文件夹', value: s.totalFolders, icon: 'folder', iconColor: isDarkMode.value ? 'accent' : 'secondary', numberColor: 'secondary' },
    { label: '文章总数', value: s.totalArticles, icon: 'article', iconColor: isDarkMode.value ? 'positive' : 'positive', numberColor: 'positive' },
    { label: '未读文章', value: s.unreadArticles, icon: 'mark_email_unread', iconColor: isDarkMode.value ? 'warning' : 'warning', numberColor: 'warning' },
    { label: '收藏文章', value: s.favoriteArticles, icon: 'favorite', iconColor: isDarkMode.value ? 'negative' : 'negative', numberColor: 'negative' },
    { label: '已读文章', value: s.readArticles, icon: 'how_to_read', iconColor: isDarkMode.value ? 'info' : 'info', numberColor: 'info' },
  ];
});

// 统计数据
const stats = computed(() => {
  const feeds = rssInfoStore.rssFolderList.reduce((sum, folder) => sum + folder.data.length, 0);
  const folders = rssInfoStore.rssFolderList.length;
  return {
    totalFeeds: feeds,
    totalFolders: folders,
    totalArticles: rssInfoStore.totalArticleCount || 0,
    unreadArticles: rssInfoStore.unreadArticleCount || 0,
    favoriteArticles: rssInfoStore.favoriteCount || 0,
    readArticles: (rssInfoStore.totalArticleCount || 0) - (rssInfoStore.unreadArticleCount || 0),
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
  shortcutsDialog.value?.open();
};

// 打开设置页面
const openSettings = () => {
  router.push('/setting');
};

// 同步所有订阅源
const syncAllFeeds = async () => {
  isSyncing.value = true;
  syncProgressStore.startPolling(500);
  try {
    const result: { success?: boolean; stats?: { successCount?: number; failureCount?: number }; error?: string } = await window.electronAPI.syncStart();
    syncProgressStore.stopPolling();
    await rssInfoStore.refresh();
    if (result?.success) {
      $q.notify({
        type: 'positive',
        message: `同步完成！成功: ${result.stats?.successCount || 0}, 失败: ${result.stats?.failureCount || 0}`,
        position: 'top'
      });
    } else {
      throw new Error(result?.error || '同步失败');
    }
  } catch (error) {
    syncProgressStore.stopPolling();
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

const loadData = async () => {
  isDataLoading.value = true;
  dataError.value = null;
  try {
    await rssInfoStore.refresh();
  } catch (err) {
    dataError.value = (err as Error).message || '加载数据失败';
  } finally {
    isDataLoading.value = false;
  }
};

// 生命周期
onMounted(() => {
  themeStore.initializeTheme();
  loadData();
});
</script>

<style scoped lang="scss">
// ==========================================================================
// CSS Custom Properties for dark mode
// ==========================================================================
:root {
  --stat-label-color: #666;
  --stat-card-shadow: rgba(0, 0, 0, 0.1);
  --empty-border: rgba(0, 0, 0, 0.08);
  --skeleton-bg: transparent;
}

.body--dark {
  --stat-label-color: #999;
  --stat-card-shadow: rgba(0, 0, 0, 0.3);
  --empty-border: rgba(255, 255, 255, 0.1);
}

// ==========================================================================
// Layout
// ==========================================================================
.home-page {
  width: 100%;
  min-height: 100%;
}

.home-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 16px;
}

.page-header {
  margin-bottom: 8px;
}

.title {
  text-align: center;
}

// ==========================================================================
// Quick Actions
// ==========================================================================
.quick-actions {
  margin: 20px 0;
}

.action-group {
  margin-bottom: 16px;
}

.group-title {
  font-size: 13px;
  font-weight: 500;
  color: #999;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.btn-bar {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .q-btn {
    margin: 0;
  }

  .btn-item {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
  }
}

// ==========================================================================
// Shortcuts Hint
// ==========================================================================
.shortcuts-hint {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  margin-bottom: 32px;
}

// ==========================================================================
// Empty State
// ==========================================================================
.welcome-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-illustration {
  position: relative;
  margin-bottom: 8px;
}

.empty-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120px;
  height: 120px;
  transform: translate(-50%, -50%);
  border: 2px solid var(--empty-border);
  border-radius: 50%;
  animation: pulse-ring 2s ease-in-out infinite;
}

@keyframes pulse-ring {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 0.5;
  }
}

.empty-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

// ==========================================================================
// Error State
// ==========================================================================
.error-section {
  max-width: 600px;
  margin: 0 auto;
}

.error-banner {
  transition: transform 0.2s ease;
}

// ==========================================================================
// Stats Cards
// ==========================================================================
.stats-cards {
  margin-top: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px var(--stat-card-shadow);
  }

  &:focus-within {
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.3);
  }
}

.stat-card--dark {
  background: #1e1e1e;
  border-color: #333;

  &:hover {
    border-color: #555;
  }
}

.stat-card-section {
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-card-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.stat-card-body {
  flex: 1;
  min-width: 0;
}

.stat-number {
  font-weight: 600;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--stat-label-color);
  margin-top: 2px;
}

// ==========================================================================
// Skeleton
// ==========================================================================
.stat-card--skeleton {
  pointer-events: none;
}

.skeleton-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.skeleton-icon {
  flex-shrink: 0;
}

.skeleton-text-group {
  flex: 1;
  min-width: 0;
}

// ==========================================================================
// Transition Animations
// ==========================================================================

// Fade transition for state switching (loading/empty/error/stats)
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

// Staggered card entrance animation
.card-stagger-enter-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.card-stagger-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.card-stagger-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}

.card-stagger-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}

// ==========================================================================
// Responsive
// ==========================================================================

/* Show on desktop, hide on mobile */
@media (max-width: 599px) {
  .hidden-mobile {
    display: none !important;
  }

  .home-container {
    padding: 16px 12px;
  }

  .btn-bar {
    gap: 6px;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .stat-card-section {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }

  .stat-card-icon {
    display: none;
  }

  .welcome-empty {
    padding: 40px 16px;
  }
}

/* Special handling for very narrow screens */
@media (max-width: 380px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
