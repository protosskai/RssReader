import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface KeyboardShortcut {
  id: string
  label: string
  keys: string[]
  description: string
  action: () => void
  global?: boolean // 是否为全局快捷键
}

export const useKeyboardStore = defineStore('keyboard', () => {
  // 状态
  const shortcuts = ref<KeyboardShortcut[]>([])
  const isEnabled = ref(true)

  // 计算属性
  const enabledShortcuts = computed(() => shortcuts.value.filter(s => isEnabled.value))
  const shortcutCount = computed(() => shortcuts.value.length)

  // 方法
  /**
   * 注册键盘快捷键
   * @param shortcut 快捷键配置
   */
  const registerShortcut = (shortcut: KeyboardShortcut) => {
    // 检查是否已存在相同的快捷键
    const exists = shortcuts.value.some(s => s.id === shortcut.id)
    if (!exists) {
      shortcuts.value.push(shortcut)
      console.log(`[keyboardStore] Registered shortcut: ${shortcut.label} (${shortcut.keys.join('+')})`)
    }
  }

  /**
   * 注销键盘快捷键
   * @param shortcutId 快捷键ID
   */
  const unregisterShortcut = (shortcutId: string) => {
    const index = shortcuts.value.findIndex(s => s.id === shortcutId)
    if (index > -1) {
      const shortcut = shortcuts.value[index]
      shortcuts.value.splice(index, 1)
      console.log(`[keyboardStore] Unregistered shortcut: ${shortcut.label}`)
    }
  }

  /**
   * 执行快捷键
   * @param event 键盘事件
   */
  const executeShortcut = (event: KeyboardEvent) => {
    if (!isEnabled.value) return

    // 忽略在输入框中的快捷键
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      // 但是允许Ctrl/Cmd+F搜索快捷键
      const isSearchShortcut =
        (event.ctrlKey || event.metaKey) && event.key === 'f'
      if (!isSearchShortcut) {
        return
      }
    }

    // 构建当前按键组合
    const currentKeys: string[] = []
    if (event.ctrlKey || event.metaKey) currentKeys.push('ctrl')
    if (event.altKey) currentKeys.push('alt')
    if (event.shiftKey) currentKeys.push('shift')
    currentKeys.push(event.key.toLowerCase())

    // 查找匹配的快捷键
    const matchedShortcut = shortcuts.value.find(shortcut => {
      return shortcut.keys.every(key => currentKeys.includes(key)) &&
             shortcut.keys.length === currentKeys.length
    })

    if (matchedShortcut) {
      event.preventDefault()
      event.stopPropagation()
      console.log(`[keyboardStore] Executing shortcut: ${matchedShortcut.label}`)
      matchedShortcut.action()
    }
  }

  /**
   * 启用/禁用键盘快捷键
   */
  const toggleShortcuts = () => {
    isEnabled.value = !isEnabled.value
    console.log(`[keyboardStore] Keyboard shortcuts ${isEnabled.value ? 'enabled' : 'disabled'}`)
  }

  /**
   * 清空所有快捷键
   */
  const clearAllShortcuts = () => {
    shortcuts.value = []
    console.log('[keyboardStore] All shortcuts cleared')
  }

  /**
   * 获取快捷键帮助文本
   */
  const getShortcutHelp = () => {
    return shortcuts.value.map(shortcut => ({
      label: shortcut.label,
      keys: shortcut.keys.join('+').toUpperCase(),
      description: shortcut.description
    }))
  }

  return {
    // 状态
    shortcuts,
    isEnabled,

    // 计算属性
    enabledShortcuts,
    shortcutCount,

    // 方法
    registerShortcut,
    unregisterShortcut,
    executeShortcut,
    toggleShortcuts,
    clearAllShortcuts,
    getShortcutHelp
  }
})
