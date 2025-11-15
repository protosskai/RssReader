<template>
  <q-page class="settings-page">
    <div class="settings-container">
      <!-- 设置页面标题 -->
      <div class="settings-header">
        <h2 class="settings-title">设置</h2>
        <p class="settings-subtitle">自定义您的RSS阅读体验</p>
      </div>

      <!-- 设置选项卡 -->
      <q-tabs
        v-model="tab"
        dense
        class="settings-tabs"
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
      <div class="settings-content">
        <!-- 通用设置 -->
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
      </div>

      <!-- 保存按钮 -->
      <div class="settings-footer">
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
import { useQuasar } from 'quasar';
import { useThemeStore, type ThemeMode } from 'stores/themeStore';

const $q = useQuasar();
const themeStore = useThemeStore();

// 标签页
const tab = ref('general');

// 加载状态
const saving = ref(false);
const syncing = ref(false);

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
  try {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      const parsedSettings = JSON.parse(saved);
      Object.assign(settings, parsedSettings);
    }

    // 加载同步配置
    const syncResult = await window.electronAPI.syncGetConfig()
    if (syncResult) {
      Object.assign(syncConfig, syncResult)
    }

    // 获取同步状态
    await refreshSyncStatus()
  } catch (error) {
    console.error('加载设置失败:', error);
  }
};

// 更新同步配置
const updateSyncConfig = async () => {
  try {
    await window.electronAPI.syncUpdateConfig(syncConfig)
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
    syncStatus.value = await window.electronAPI.syncGetStatus()
  } catch (error) {
    console.error('获取同步状态失败:', error)
  }
}

// 保存设置
const saveSettings = async () => {
  saving.value = true;
  try {
    // 保存到localStorage
    localStorage.setItem('appSettings', JSON.stringify(settings));

    $q.notify({
      type: 'positive',
      message: '设置已保存',
      position: 'top'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '保存设置失败',
      position: 'top'
    });
  } finally {
    saving.value = false;
  }
};

// 同步所有RSS源
const syncAllFeeds = async () => {
  syncing.value = true;
  try {
    const result = await window.electronAPI.syncStart()

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

// 确认清空所有数据
const confirmClearAllData = () => {
  $q.dialog({
    title: '确认操作',
    message: '确定要清空所有数据吗？此操作不可撤销！',
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(() => {
    // TODO: 实现清空数据逻辑
    $q.notify({
      type: 'info',
      message: '数据已清空',
      position: 'top'
    });
  });
};

// 确认重置设置
const confirmResetSettings = () => {
  $q.dialog({
    title: '确认操作',
    message: '确定要重置所有设置吗？',
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(() => {
    // TODO: 实现重置设置逻辑
    $q.notify({
      type: 'info',
      message: '设置已重置',
      position: 'top'
    });
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
.settings-page {
  background: $grey-3;
  min-height: 100vh;
  padding: 20px;

  .body--dark & {
    background: $dark;
  }
}

.settings-container {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;

  .body--dark & {
    background: $dark-page;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}

.settings-header {
  padding: 32px 24px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.settings-title {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
}

.settings-subtitle {
  margin: 8px 0 0;
  opacity: 0.9;
  font-size: 14px;
}

.settings-tabs {
  background: #fafafa;
  border-bottom: 1px solid #e0e0e0;

  .body--dark & {
    background: $dark-page;
    border-bottom-color: $dark-separator;
  }

  :deep(.q-tab) {
    min-height: 56px;
    font-weight: 500;

    .body--dark & {
      color: $grey-5;
    }
  }
}

.settings-content {
  padding: 24px;
}

.settings-panel {
  padding: 0;
}

.panel-header {
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;

  .body--dark & {
    border-bottom-color: $dark-separator;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 20px;
    color: #333;

    .body--dark & {
      color: $grey-2;
    }
  }

  p {
    margin: 0;
    color: #666;
    font-size: 14px;

    .body--dark & {
      color: $grey-6;
    }
  }
}

.setting-card {
  margin-bottom: 16px;
  border-radius: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;

  .body--dark & {
    color: $grey-2;
  }
}

.setting-description {
  font-size: 13px;
  color: #666;

  .body--dark & {
    color: $grey-6;
  }
}

.setting-control {
  min-width: 200px;
}

.theme-preview {
  margin-left: 12px;
}

.danger-zone {
  margin-top: 32px;
  border-color: #ffcdd2 !important;

  .danger-zone-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #d32f2f;
  }

  .danger-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .danger-btn {
    flex: 1;
    min-width: 150px;
  }
}

.settings-footer {
  padding: 24px;
  background: #fafafa;
  border-top: 1px solid #e0e0e0;
  text-align: center;

  .body--dark & {
    background: $dark-page;
    border-top-color: $dark-separator;
  }
}

.sync-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

// 响应式设计
@media (max-width: 768px) {
  .settings-page {
    padding: 12px;
  }

  .settings-header {
    padding: 24px 16px 16px;
  }

  .settings-title {
    font-size: 24px;
  }

  .settings-content {
    padding: 16px;
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .setting-control {
    width: 100%;
  }

  .danger-actions {
    flex-direction: column;
  }

  .danger-btn {
    width: 100%;
  }
}
</style>
