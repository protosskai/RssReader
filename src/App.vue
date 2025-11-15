<template>
  <router-view />
  <KeyboardShortcutsDialog ref="shortcutsDialog" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useThemeStore } from './stores/themeStore'
import { useKeyboard, createDefaultShortcuts, SHORTCUT_KEYS } from './composables/useKeyboard'
import KeyboardShortcutsDialog from './components/KeyboardShortcutsDialog.vue'

const themeStore = useThemeStore()
const keyboard = useKeyboard()
const shortcutsDialog = ref<InstanceType<typeof KeyboardShortcutsDialog> | null>(null)

onMounted(() => {
  // 初始化主题
  themeStore.initializeTheme()
  themeStore.listenToSystemThemeChange()

  // 注册默认键盘快捷键
  keyboard.registerShortcuts(
    createDefaultShortcuts({
      onSync: () => {
        console.log('[App] Sync shortcut triggered')
        // 触发同步操作
        window.electronAPI?.syncStart?.()
      },
      onSearch: () => {
        console.log('[App] Search shortcut triggered')
        // 触发搜索操作
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      },
      onSettings: () => {
        console.log('[App] Settings shortcut triggered')
        // 触发设置页面
      },
      onNewSubscription: () => {
        console.log('[App] New subscription shortcut triggered')
        // 触发新建订阅
      },
      onToggleDarkMode: () => {
        console.log('[App] Toggle dark mode shortcut triggered')
        themeStore.toggleMode()
      },
      onRefresh: () => {
        console.log('[App] Refresh shortcut triggered')
        // 触发刷新操作
        window.location.reload()
      }
    })
  )

  // 注册帮助快捷键 (Ctrl+Shift+?)
  keyboard.registerShortcut({
    id: 'help',
    label: '帮助',
    keys: SHORTCUT_KEYS.HELP,
    description: '打开键盘快捷键帮助',
    action: () => {
      console.log('[App] Help shortcut triggered')
      shortcutsDialog.value?.open()
    }
  })

  console.log(`[App] Keyboard shortcuts initialized (${keyboard.shortcuts.length} shortcuts registered)`)
})
</script>
