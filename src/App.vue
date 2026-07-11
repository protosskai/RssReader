<template>
  <ErrorBoundary>
    <div v-if="showBrowserBanner" class="ink-browser-banner" role="status">
      Running in browser preview — feed data requires the Electron desktop app
      (<code>yarn dev:electron</code>). UI shell still loads for styling checks.
    </div>
    <router-view />
  </ErrorBoundary>
  <KeyboardShortcutsDialog ref="shortcutsDialog" />
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { useThemeStore } from './stores/themeStore'
import { useKeyboard, createDefaultShortcuts, SHORTCUT_KEYS } from './composables/useKeyboard'
import KeyboardShortcutsDialog from './components/KeyboardShortcutsDialog.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'

const themeStore = useThemeStore()
const keyboard = useKeyboard()
const router = useRouter()
const shortcutsDialog = ref<InstanceType<typeof KeyboardShortcutsDialog> | null>(null)
const hasElectron = ref(false)

const showBrowserBanner = computed(
  () => !hasElectron.value && process.env.MODE !== 'electron',
)

// Ensure global router bridge is always available for switchPage()
if (typeof window !== 'undefined') {
  (window as unknown as { __APP_ROUTER__?: Router }).__APP_ROUTER__ = router
}

onMounted(() => {
  hasElectron.value =
    typeof window !== 'undefined' && !!(window as unknown as { electronAPI?: unknown }).electronAPI

  // 初始化主题
  themeStore.initializeTheme()
  themeStore.listenToSystemThemeChange()

  // 注册默认键盘快捷键
  keyboard.registerShortcuts(
    createDefaultShortcuts({
      onSync: () => {
        console.log('[App] Sync shortcut triggered')
        void import('src/services/electronClient').then(({ electronClient }) => {
          void electronClient.syncStart()
        })
      },
      onSearch: () => {
        console.log('[App] Search shortcut triggered')
        // Prefer dedicated search field; fall back to first text input in drawer/search UI
        const searchInput =
          (document.querySelector('.search-input, input[type="search"], input[placeholder*="搜索"]') as HTMLInputElement | null)
        if (searchInput) {
          searchInput.focus()
          searchInput.select?.()
        }
      },
      onSettings: () => {
        console.log('[App] Settings shortcut triggered')
        void router.push({ name: 'Setting' })
      },
      onNewSubscription: () => {
        console.log('[App] New subscription shortcut triggered')
        void import('src/stores/systemDialogStore').then(({ useSystemDialogStore }) => {
          useSystemDialogStore().openAddSubscriptionDialog()
        })
      },
      onToggleDarkMode: () => {
        console.log('[App] Toggle dark mode shortcut triggered')
        themeStore.toggleMode()
      },
      onRefresh: () => {
        console.log('[App] Refresh shortcut triggered')
        void import('src/stores/rssInfoStore').then(({ useRssInfoStore }) => {
          void useRssInfoStore().refresh()
        })
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

  console.log(`[App] Keyboard shortcuts initialized (${keyboard.shortcuts.value.length} shortcuts registered)`)
  console.log(`[App] electronAPI present: ${hasElectron.value}`)

  // 全局键盘监听
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    keyboard.execute(event);
  })
})
</script>

<style scoped>
.ink-browser-banner {
  position: sticky;
  top: 0;
  z-index: 5000;
  background: #b8422e;
  color: #fff;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  padding: 6px 12px;
  font-family: system-ui, sans-serif;
}
.ink-browser-banner code {
  background: rgba(0, 0, 0, 0.2);
  padding: 1px 6px;
  border-radius: 3px;
}
</style>
