<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card class="shortcuts-card">
      <q-card-section class="dialog-header">
        <div class="text-h6">键盘快捷键</div>
        <q-btn
          icon="close"
          flat
          round
          dense
          v-close-popup
          class="close-btn"
        />
      </q-card-section>

      <q-card-section class="dialog-content">
        <div class="shortcuts-grid">
          <div
            v-for="shortcut in shortcuts"
            :key="shortcut.id"
            class="shortcut-item"
          >
            <div class="shortcut-label">{{ shortcut.label }}</div>
            <div class="shortcut-keys">
              <q-chip
                v-for="(key, index) in shortcut.keys"
                :key="index"
                :label="key.toUpperCase()"
                dense
                class="key-chip"
              />
            </div>
            <div class="shortcut-description">{{ shortcut.description }}</div>
          </div>
        </div>

        <q-separator class="q-my-md" />

        <div class="tips-section">
          <div class="text-subtitle2 q-mb-sm">提示</div>
          <ul class="tips-list">
            <li>在输入框中仅支持 Ctrl/Cmd+F 搜索快捷键</li>
            <li>按 Ctrl+Shift+? 查看此帮助对话框</li>
            <li>键盘快捷键仅在应用获得焦点时生效</li>
          </ul>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          label="关闭"
          color="primary"
          v-close-popup
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKeyboardStore } from '../stores/keyboardStore'

const keyboardStore = useKeyboardStore()

const isOpen = ref(false)

const shortcuts = computed(() => keyboardStore.enabledShortcuts)

const open = () => {
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
}

// 暴露方法给父组件
defineExpose({
  open,
  close
})
</script>

<style lang="scss" scoped>
.shortcuts-card {
  min-width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;

    .close-btn {
      color: white;
    }
  }

  .dialog-content {
    flex: 1;
    overflow-y: auto;
  }
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.shortcut-item {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;

  .shortcut-label {
    font-weight: 600;
    margin-bottom: 8px;
    color: #333;
  }

  .shortcut-keys {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;

    .key-chip {
      font-size: 11px;
      padding: 4px 8px;
      background: #e0e0e0;
      color: #333;
      font-weight: 600;
    }
  }

  .shortcut-description {
    font-size: 12px;
    color: #666;
    line-height: 1.4;
  }
}

.tips-section {
  background: #f0f7ff;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #1976d2;

  .tips-list {
    margin: 0;
    padding-left: 20px;

    li {
      margin-bottom: 6px;
      color: #555;
      font-size: 13px;
    }
  }
}

.body--dark {
  .shortcut-item {
    background: #2d2d2d;
    border-color: #444;

    .shortcut-label {
      color: #e0e0e0;
    }

    .shortcut-description {
      color: #aaa;
    }

    .key-chip {
      background: #444;
      color: #e0e0e0;
    }
  }

  .tips-section {
    background: #1a2332;
    border-left-color: #1976d2;

    .tips-list li {
      color: #ccc;
    }
  }
}
</style>
