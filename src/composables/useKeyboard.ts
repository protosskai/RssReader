import { onMounted, onUnmounted } from 'vue'
import { useKeyboardStore } from '../stores/keyboardStore'

/**
 * 键盘快捷键Composable
 * 提供便捷的方式在组件中注册和使用键盘快捷键
 */
export const useKeyboard = () => {
  const keyboardStore = useKeyboardStore()

  /**
   * 注册键盘快捷键
   * @param options 快捷键选项
   */
  const registerShortcut = (options: {
    id: string
    label: string
    keys: string[]
    description: string
    action: () => void
    global?: boolean
  }) => {
    keyboardStore.registerShortcut(options)
  }

  /**
   * 注册多个键盘快捷键
   * @param shortcuts 快捷键数组
   */
  const registerShortcuts = (shortcuts: Array<{
    id: string
    label: string
    keys: string[]
    description: string
    action: () => void
    global?: boolean
  }>) => {
    shortcuts.forEach(shortcut => {
      keyboardStore.registerShortcut(shortcut)
    })
  }

  /**
   * 注销键盘快捷键
   * @param shortcutId 快捷键ID
   */
  const unregisterShortcut = (shortcutId: string) => {
    keyboardStore.unregisterShortcut(shortcutId)
  }

  /**
   * 监听键盘事件
   */
  const handleKeydown = (event: KeyboardEvent) => {
    keyboardStore.executeShortcut(event)
  }

  // 在组件挂载时添加键盘事件监听器
  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
    console.log('[useKeyboard] Keyboard event listener added')
  })

  // 在组件卸载时移除键盘事件监听器
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    console.log('[useKeyboard] Keyboard event listener removed')
  })

  return {
    registerShortcut,
    registerShortcuts,
    unregisterShortcut,
    shortcuts: keyboardStore.shortcuts,
    isEnabled: keyboardStore.isEnabled,
    toggleShortcuts: keyboardStore.toggleShortcuts
  }
}

/**
 * 常用快捷键键位组合
 */
export const SHORTCUT_KEYS = {
  // 导航
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  TAB: 'Tab',

  // 常用组合键
  NEW: ['ctrl', 'n'],
  SAVE: ['ctrl', 's'],
  SEARCH: ['ctrl', 'f'],
  SETTINGS: ['ctrl', ','],
  SYNC: ['ctrl', 'r'],
  FULLSCREEN: ['ctrl', 'shift', 'f'],
  DARK_MODE: ['ctrl', 'shift', 'd'],
  HELP: ['ctrl', '?'],
  PREVIOUS: ['ctrl', 'p'],
  NEXT: ['ctrl', 'n'],
  FAVORITE: ['ctrl', 'd'],
  REFRESH: ['f5'],
  MINIMIZE: ['ctrl', 'm'],
  CLOSE: ['ctrl', 'w']
} as const

/**
 * 预定义的快捷键集合
 * @param actions 动作函数
 */
export const createDefaultShortcuts = (actions: {
  onSync?: () => void
  onSearch?: () => void
  onSettings?: () => void
  onNewSubscription?: () => void
  onToggleDarkMode?: () => void
  onRefresh?: () => void
}) => {
  const shortcuts = []

  // 同步
  if (actions.onSync) {
    shortcuts.push({
      id: 'sync-all',
      label: '同步所有RSS源',
      keys: SHORTCUT_KEYS.SYNC,
      description: '手动同步所有RSS源',
      action: actions.onSync
    })
  }

  // 搜索
  if (actions.onSearch) {
    shortcuts.push({
      id: 'search',
      label: '搜索',
      keys: SHORTCUT_KEYS.SEARCH,
      description: '打开搜索框',
      action: actions.onSearch
    })
  }

  // 设置
  if (actions.onSettings) {
    shortcuts.push({
      id: 'settings',
      label: '设置',
      keys: SHORTCUT_KEYS.SETTINGS,
      description: '打开设置页面',
      action: actions.onSettings
    })
  }

  // 新建订阅
  if (actions.onNewSubscription) {
    shortcuts.push({
      id: 'new-subscription',
      label: '新建订阅',
      keys: SHORTCUT_KEYS.NEW,
      description: '添加新的RSS订阅',
      action: actions.onNewSubscription
    })
  }

  // 切换暗色主题
  if (actions.onToggleDarkMode) {
    shortcuts.push({
      id: 'toggle-dark-mode',
      label: '切换暗色主题',
      keys: SHORTCUT_KEYS.DARK_MODE,
      description: '在明暗主题之间切换',
      action: actions.onToggleDarkMode
    })
  }

  // 刷新
  if (actions.onRefresh) {
    shortcuts.push({
      id: 'refresh',
      label: '刷新',
      keys: SHORTCUT_KEYS.REFRESH,
      description: '刷新当前页面',
      action: actions.onRefresh
    })
  }

  return shortcuts
}
