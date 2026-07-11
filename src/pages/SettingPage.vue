<template>
  <q-page class="ink-settings">
    <div class="ink-settings__panel">
      <!-- 设置页面标题 -->
      <div class="ink-settings__header">
        <h2 class="ink-settings__title">Settings</h2>
        <p class="ink-settings__sub">Preferences for reading, sync, and appearance</p>
      </div>

      <!-- 设置选项卡 -->
      <q-tabs
        v-model="tab"
        dense
        class="ink-settings__tabs"
        active-color="primary"
        indicator-color="primary"
        align="left"
      >
        <q-tab name="general" label="通用" icon="settings" />
        <q-tab name="appearance" label="外观" icon="palette" />
        <q-tab name="sync" label="同步" icon="sync" />
        <q-tab name="notifications" label="通知" icon="notifications" />
        <q-tab name="advanced" label="高级" icon="code" />
      </q-tabs>

      <!-- 设置内容区域 -->
      <div class="ink-settings__content">
        <!-- 加载骨架屏 -->
        <div v-if="isLoading" class="settings-loading">
          <q-skeleton v-for="n in 6" :key="'setSk'+n" type="rect" class="q-mb-md skeleton-card"/>
          <div class="text-center text-grey-6 q-mt-md">正在加载设置...</div>
        </div>

        <!-- 加载错误 -->
        <div v-else-if="loadError" class="settings-error">
          <q-banner rounded class="bg-negative text-white">
            <template #avatar><q-icon name="error"/></template>
            <div class="text-weight-medium">加载设置失败</div>
            <div>{{ loadError }}</div>
            <template #action>
              <q-btn flat color="white" label="重试" @click="loadSettings"/>
            </template>
          </q-banner>
        </div>

        <!-- 通用设置 -->
        <template v-else>
        <q-tab-panels v-model="tab" animated>
          <q-tab-panel name="general" class="settings-panel">
            <div class="panel-header">
              <h3>通用设置</h3>
              <p>基本应用设置和首选项</p>
            </div>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">语言</div>
                    <div class="setting-description">选择界面显示语言</div>
                  </div>
                  <q-select
                    v-model="settings.language"
                    :options="languageOptions"
                    outlined
                    dense
                    emit-value
                    map-options
                    class="setting-control"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">自动启动应用</div>
                    <div class="setting-description">开机时自动启动RSS阅读器</div>
                  </div>
                  <q-toggle
                    v-model="settings.autoStart"
                    color="primary"
                    class="setting-control"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">最小化到系统托盘</div>
                    <div class="setting-description">关闭窗口时最小化到托盘而非退出</div>
                  </div>
                  <q-toggle
                    v-model="settings.minimizeToTray"
                    color="primary"
                    class="setting-control"
                  />
                </div>
              </q-card-section>
            </q-card>
          </q-tab-panel>

          <!-- 外观设置 -->
          <q-tab-panel name="appearance" class="settings-panel">
            <div class="panel-header">
              <h3>外观设置</h3>
              <p>自定义界面外观和阅读体验</p>
            </div>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">主题模式</div>
                    <div class="setting-description">选择浅色或深色主题</div>
                  </div>
                  <q-btn-toggle
                    :model-value="themeStore.currentMode"
                    @update:model-value="(val) => themeStore.setMode(val as ThemeMode)"
                    :options="[
                      {label: '浅色', value: 'light'},
                      {label: '深色', value: 'dark'},
                      {label: '跟随系统', value: 'system'}
                    ]"
                    rounded
                    unelevated
                    color="grey"
                    text-color="white"
                    class="setting-control"
                  />
                  <div class="theme-preview">
                    <q-chip
                      :color="themeStore.isDarkMode ? 'primary' : 'grey-3'"
                      :text-color="themeStore.isDarkMode ? 'white' : 'dark'"
                      size="sm"
                    >
                      {{ themeStore.isDarkMode ? '当前：深色' : '当前：浅色' }}
                    </q-chip>
                  </div>
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">字体大小</div>
                    <div class="setting-description">调整文章阅读字体大小</div>
                  </div>
                  <q-slider
                    v-model="settings.fontSize"
                    :min="12"
                    :max="24"
                    :step="1"
                    label
                    color="primary"
                    class="setting-control"
                    style="width: 200px;"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">文章列表密度</div>
                    <div class="setting-description">控制文章列表的紧凑程度</div>
                  </div>
                  <q-btn-toggle
                    v-model="settings.listDensity"
                    :options="[
                      {label: '紧凑', value: 'compact'},
                      {label: '舒适', value: 'comfortable'},
                      {label: '宽松', value: 'spacious'}
                    ]"
                    rounded
                    unelevated
                    color="grey"
                    text-color="white"
                    class="setting-control"
                  />
                </div>
              </q-card-section>
            </q-card>
          </q-tab-panel>

          <!-- 同步设置 -->
          <q-tab-panel name="sync" class="settings-panel">
            <div class="panel-header">
              <h3>同步设置</h3>
              <p>管理RSS源同步和更新选项</p>
            </div>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">自动同步</div>
                    <div class="setting-description">自动从RSS源获取最新文章</div>
                  </div>
                  <q-toggle
                    v-model="syncConfig.enabled"
                    @update:model-value="updateSyncConfig"
                    color="primary"
                    class="setting-control"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">同步间隔</div>
                    <div class="setting-description">设置自动同步的间隔时间</div>
                  </div>
                  <q-select
                    v-model="syncConfig.interval"
                    @update:model-value="updateSyncConfig"
                    :options="syncIntervalOptions"
                    outlined
                    dense
                    emit-value
                    map-options
                    class="setting-control"
                    :disable="!syncConfig.enabled"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">后台同步</div>
                    <div class="setting-description">应用在后台时也能同步RSS源</div>
                  </div>
                  <q-toggle
                    v-model="syncConfig.backgroundSync"
                    @update:model-value="updateSyncConfig"
                    color="primary"
                    class="setting-control"
                    :disable="!syncConfig.enabled"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">新文章通知</div>
                    <div class="setting-description">有新文章时显示桌面通知</div>
                  </div>
                  <q-toggle
                    v-model="syncConfig.notification"
                    @update:model-value="updateSyncConfig"
                    color="primary"
                    class="setting-control"
                    :disable="!syncConfig.enabled"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">启动时同步</div>
                    <div class="setting-description">应用启动时自动同步一次</div>
                  </div>
                  <q-toggle
                    v-model="syncConfig.syncOnStartup"
                    @update:model-value="updateSyncConfig"
                    color="primary"
                    class="setting-control"
                    :disable="!syncConfig.enabled"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section class="text-center">
                <div class="sync-status" v-if="syncStatus">
                  <q-chip :color="syncStatus.isRunning ? 'positive' : 'grey'">
                    {{ syncStatus.isRunning ? '自动同步运行中' : '自动同步已停止' }}
                  </q-chip>
                  <q-chip v-if="syncStatus.isSyncing" color="primary" class="q-ml-sm">
                    同步中...
                  </q-chip>
                </div>
                <q-btn
                  color="primary"
                  label="立即同步所有RSS源"
                  icon="sync"
                  @click="syncAllFeeds"
                  :loading="syncing"
                  unelevated
                  class="q-mt-md"
                />
              </q-card-section>
            </q-card>
          </q-tab-panel>

          <!-- 通知设置 -->
          <q-tab-panel name="notifications" class="settings-panel">
            <div class="panel-header">
              <h3>通知设置</h3>
              <p>管理新文章到达时的通知选项</p>
            </div>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">桌面通知</div>
                    <div class="setting-description">有新文章时显示桌面通知</div>
                  </div>
                  <q-toggle
                    v-model="settings.desktopNotifications"
                    color="primary"
                    class="setting-control"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">声音提醒</div>
                    <div class="setting-description">有新文章时播放提示音</div>
                  </div>
                  <q-toggle
                    v-model="settings.soundNotifications"
                    color="primary"
                    class="setting-control"
                    :disable="!settings.desktopNotifications"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">仅在后台时通知</div>
                    <div class="setting-description">仅在应用不在前台时发送通知</div>
                  </div>
                  <q-toggle
                    v-model="settings.notificationsOnlyWhenHidden"
                    color="primary"
                    class="setting-control"
                    :disable="!settings.desktopNotifications"
                  />
                </div>
              </q-card-section>
            </q-card>
          </q-tab-panel>

          <!-- 高级设置 -->
          <q-tab-panel name="advanced" class="settings-panel">
            <div class="panel-header">
              <h3>高级设置</h3>
              <p>专家用户的高级选项</p>
            </div>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">缓存大小限制</div>
                    <div class="setting-description">限制本地缓存数据的大小（MB）</div>
                  </div>
                  <q-input
                    v-model.number="settings.cacheSizeLimit"
                    type="number"
                    outlined
                    dense
                    class="setting-control"
                    style="width: 150px;"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="setting-item">
                  <div class="setting-info">
                    <div class="setting-title">启用开发者模式</div>
                    <div class="setting-description">显示额外的调试信息和选项</div>
                  </div>
                  <q-toggle
                    v-model="settings.developerMode"
                    color="primary"
                    class="setting-control"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="setting-card danger-zone">
              <q-card-section>
                <div class="danger-zone-header">
                  <q-icon name="warning" color="negative" size="sm" />
                  <span class="danger-zone-title">危险操作</span>
                </div>
              </q-card-section>
              <q-separator />
              <q-card-section>
                <div class="danger-actions">
                  <q-btn
                    color="negative"
                    label="清空所有数据"
                    icon="delete_sweep"
                    outline
                    @click="confirmClearAllData"
                    class="danger-btn"
                  />
                  <q-btn
                    color="negative"
                    label="重置所有设置"
                    icon="restart_alt"
                    outline
                    @click="confirmResetSettings"
                    class="danger-btn"
                  />
                </div>
              </q-card-section>
            </q-card>
          </q-tab-panel>
        </q-tab-panels>
        </template>
      </div>

      <!-- 保存按钮 -->
      <div class="ink-settings__footer">
        <q-btn
          color="primary"
          label="保存设置"
          icon="save"
          @click="saveSettings"
          :loading="saving"
          unelevated
          size="lg"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { electronClient } from 'src/services/electronClient';
import { useQuasar } from 'quasar';
import { useThemeStore, type ThemeMode } from 'stores/themeStore';

const $q = useQuasar();
const themeStore = useThemeStore();

// 标签页
const tab = ref('general');

// 加载状态
const saving = ref(false);
const syncing = ref(false);
const isLoading = ref(true);
const loadError = ref<string | null>(null);

// 语言选项
const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
  { label: '繁體中文', value: 'zh-TW' }
];

// 同步间隔选项
const syncIntervalOptions = [
  { label: '5分钟', value: 5 },
  { label: '10分钟', value: 10 },
  { label: '15分钟', value: 15 },
  { label: '30分钟', value: 30 },
  { label: '1小时', value: 60 },
  { label: '2小时', value: 120 },
  { label: '6小时', value: 360 },
  { label: '12小时', value: 720 },
  { label: '24小时', value: 1440 }
];

// 设置数据
const settings = reactive({
  language: 'zh-CN',
  autoStart: false,
  minimizeToTray: true,
  fontSize: 14,
  listDensity: 'comfortable',
  desktopNotifications: true,
  soundNotifications: false,
  notificationsOnlyWhenHidden: true,
  cacheSizeLimit: 500,
  developerMode: false
});

// 同步配置
const syncConfig = reactive({
  enabled: false,
  interval: 30,
  backgroundSync: true,
  systemTray: true,
  syncOnStartup: true,
  notification: true
})

// 同步状态
const syncStatus = ref<any>(null)

// 加载设置
const loadSettings = async () => {
  isLoading.value = true;
  loadError.value = null;
  try {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      const parsedSettings = JSON.parse(saved);
      Object.assign(settings, parsedSettings);
    }

    // 加载同步配置
    const syncResult = await electronClient.syncGetConfig()
    if (syncResult) {
      Object.assign(syncConfig, syncResult)
    }

    // 获取同步状态
    await refreshSyncStatus()
  } catch (error) {
    console.error('加载设置失败:', error);
    loadError.value = (error as Error).message || '加载设置失败';
  } finally {
    isLoading.value = false;
  }
};

// 更新同步配置
const updateSyncConfig = async () => {
  try {
    await electronClient.syncUpdateConfig(syncConfig)
    await refreshSyncStatus()
    $q.notify({
      type: 'positive',
      message: '同步设置已保存',
      position: 'top'
    })
  } catch (error) {
    console.error('保存同步设置失败:', error)
    $q.notify({
      type: 'negative',
      message: '保存同步设置失败',
      position: 'top'
    })
  }
}

// 刷新同步状态
const refreshSyncStatus = async () => {
  try {
    syncStatus.value = await electronClient.syncGetStatus()
  } catch (error) {
    console.error('获取同步状态失败:', error)
  }
}

// 保存设置
const saveSettings = async () => {
  saving.value = true;
  try {
    localStorage.setItem('appSettings', JSON.stringify(settings));

    // 联动阅读页字体：设置里的 12–24px 映射为 contentFontSize 百分比（基准 14px = 100%）
    const pct = Math.max(60, Math.min(200, Math.round((settings.fontSize / 14) * 100)));
    localStorage.setItem('contentFontSize', String(pct));

    $q.notify({
      type: 'positive',
      message: '设置已保存',
      position: 'top',
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '保存设置失败',
      position: 'top',
    });
  } finally {
    saving.value = false;
  }
};

// 同步所有RSS源
const syncAllFeeds = async () => {
  syncing.value = true;
  try {
    const result = await electronClient.syncStart()

    if (result.success) {
      const { stats } = result
      $q.notify({
        type: 'positive',
        message: `同步完成！成功: ${stats.successCount}, 失败: ${stats.failureCount}`,
        position: 'top',
        timeout: 3000
      });
      await refreshSyncStatus()
    } else {
      throw new Error(result.error || '同步失败')
    }
  } catch (error) {
    console.error('同步失败:', error)
    $q.notify({
      type: 'negative',
      message: `同步失败: ${error instanceof Error ? error.message : String(error)}`,
      position: 'top'
    });
  } finally {
    syncing.value = false;
  }
};

const DEFAULT_SETTINGS = {
  language: 'zh-CN',
  autoStart: false,
  minimizeToTray: true,
  fontSize: 14,
  listDensity: 'comfortable',
  desktopNotifications: true,
  soundNotifications: false,
  notificationsOnlyWhenHidden: true,
  cacheSizeLimit: 500,
  developerMode: false,
};

// 确认清空所有数据（订阅源 + 文章 + 收藏，保留本地应用设置）
const confirmClearAllData = () => {
  $q.dialog({
    title: '确认操作',
    message: '将删除全部订阅源、文章与收藏，此操作不可撤销！是否继续？',
    cancel: { label: '取消', flat: true, color: 'grey-7' },
    ok: { label: '清空全部', color: 'negative', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    $q.loading.show({ message: '正在清空数据...', spinnerColor: 'negative' });
    try {
      // 先清空收藏标记，再逐个删除订阅源（会级联删文章）
      try {
        await electronClient.clearAllFavorites();
      } catch (e) {
        console.warn('[Settings] clearAllFavorites:', e);
      }

      const feeds = await electronClient.getFeeds();
      for (const feed of feeds || []) {
        if (feed?.id) {
          await electronClient.removeFeed(feed.id);
        }
      }

      // 删除非默认文件夹
      try {
        const folders = await electronClient.getFolders();
        for (const folder of folders || []) {
          const name = (folder as { name?: string }).name;
          if (name && name !== '默认') {
            await electronClient.removeFolderV2(name);
          }
        }
      } catch (e) {
        console.warn('[Settings] remove folders:', e);
      }

      // 阅读进度等本地缓存
      try {
        localStorage.removeItem('readingProgress');
        localStorage.removeItem('readingSettings');
      } catch {
        /* ignore */
      }

      $q.notify({
        type: 'positive',
        message: '所有订阅与文章数据已清空',
        position: 'top',
      });
    } catch (error) {
      console.error('[Settings] clearAllData failed:', error);
      $q.notify({
        type: 'negative',
        message: `清空失败: ${error instanceof Error ? error.message : String(error)}`,
        position: 'top',
      });
    } finally {
      $q.loading.hide();
    }
  });
};

// 确认重置设置（仅应用/同步偏好，不动订阅数据）
const confirmResetSettings = () => {
  $q.dialog({
    title: '确认操作',
    message: '将恢复默认应用设置与主题，不会删除订阅与文章。',
    cancel: { label: '取消', flat: true, color: 'grey-7' },
    ok: { label: '重置设置', color: 'negative', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    try {
      Object.assign(settings, { ...DEFAULT_SETTINGS });
      localStorage.setItem('appSettings', JSON.stringify(settings));
      localStorage.setItem('contentFontSize', '100');
      localStorage.removeItem('themeMode');
      themeStore.setMode('system');

      // 同步配置恢复为安全默认（自动同步关闭，避免误刷）
      Object.assign(syncConfig, {
        enabled: false,
        interval: 30,
        backgroundSync: true,
        systemTray: true,
        syncOnStartup: true,
        notification: true,
      });
      try {
        await electronClient.syncUpdateConfig({ ...syncConfig });
        await refreshSyncStatus();
      } catch (e) {
        console.warn('[Settings] reset sync config:', e);
      }

      $q.notify({
        type: 'positive',
        message: '设置已重置为默认',
        position: 'top',
      });
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: `重置失败: ${error instanceof Error ? error.message : String(error)}`,
        position: 'top',
      });
    }
  });
};

// 初始化
onMounted(() => {
  loadSettings();
  // 监听主题变化
  watch(() => themeStore.currentMode, (newMode) => {
    console.log('主题模式已切换为:', newMode);
  });
});
</script>


<style lang="scss" scoped>
.ink-settings {
  min-height: calc(100vh - var(--ink-header-h));
  background: var(--ink-neutral);
  padding: var(--ink-space-xl) var(--ink-space-md);
}
.ink-settings__panel {
  max-width: 820px;
  margin: 0 auto;
  background: var(--ink-surface);
  border: 1px solid var(--ink-border);
  border-radius: var(--ink-radius-lg);
  overflow: hidden;
}
.ink-settings__header {
  padding: var(--ink-space-xl) var(--ink-space-lg) var(--ink-space-lg);
  background: var(--ink-primary);
  color: var(--ink-on-primary);
}
.ink-settings__title {
  margin: 0;
  font-family: var(--ink-font-serif);
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink-on-primary);
}
.ink-settings__sub {
  margin: 8px 0 0;
  opacity: 0.85;
  font-size: 0.9rem;
  color: var(--ink-on-primary);
}
.ink-settings__tabs {
  padding: 0 var(--ink-space-md);
  border-bottom: 1px solid var(--ink-border);
  background: var(--ink-surface);
}
.ink-settings__content {
  padding: var(--ink-space-lg);
  background: var(--ink-neutral);
}
.settings-panel, .settings-panel .panel-header h3 {
  font-family: var(--ink-font-serif);
  color: var(--ink-primary);
}
.panel-header p { color: var(--ink-secondary); font-size: 0.9rem; }
.setting-card {
  background: var(--ink-surface) !important;
  border: 1px solid var(--ink-border) !important;
  border-radius: var(--ink-radius-md) !important;
  margin-bottom: 12px;
  box-shadow: none !important;
}
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.setting-title { font-weight: 600; color: var(--ink-primary); }
.setting-description { font-size: 0.85rem; color: var(--ink-secondary); margin-top: 2px; }
.ink-settings__footer {
  padding: var(--ink-space-md) var(--ink-space-lg);
  border-top: 1px solid var(--ink-border);
  background: var(--ink-surface);
  display: flex;
  justify-content: flex-end;
}
.danger-zone {
  border-color: color-mix(in srgb, var(--ink-negative) 35%, var(--ink-border)) !important;
}
.danger-zone-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-negative);
  font-weight: 600;
}
.danger-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
