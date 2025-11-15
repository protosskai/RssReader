import { defineStore } from 'pinia'
import { useQuasar } from 'quasar'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  isDark: boolean
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    mode: 'system',
    isDark: false
  }),

  getters: {
    currentMode: (state) => state.mode,
    isDarkMode: (state) => state.isDark
  },

  actions: {
    initializeTheme() {
      const savedMode = localStorage.getItem('themeMode') as ThemeMode
      if (savedMode) {
        this.mode = savedMode
        this.applyTheme()
      } else {
        // 默认跟随系统
        this.mode = 'system'
        this.detectSystemTheme()
      }
    },

    setMode(mode: ThemeMode) {
      this.mode = mode
      localStorage.setItem('themeMode', mode)
      this.applyTheme()
    },

    toggleMode() {
      if (this.mode === 'light') {
        this.setMode('dark')
      } else if (this.mode === 'dark') {
        this.setMode('system')
      } else {
        this.setMode('light')
      }
    },

    applyTheme() {
      // 检查是否在浏览器环境中
      if (typeof window === 'undefined') return

      // 尝试获取Quasar实例
      let $q: any = null
      try {
        $q = useQuasar()
      } catch (e) {
        console.warn('[themeStore] useQuasar not available, using document class')
      }

      let isDark = false

      if (this.mode === 'system') {
        isDark = this.detectSystemTheme()
      } else {
        isDark = this.mode === 'dark'
      }

      this.isDark = isDark

      // 使用Quasar或原生方法设置暗色模式
      if ($q && $q.dark) {
        $q.dark.set(isDark)
      } else {
        // 回退到原生方法
        document.documentElement.classList.toggle('dark', isDark)
      }

      // 设置meta主题色
      this.updateMetaThemeColor(isDark)
    },

    detectSystemTheme(): boolean {
      if (typeof window !== 'undefined') {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      return false
    },

    updateMetaThemeColor(isDark: boolean) {
      if (typeof document !== 'undefined') {
        const metaThemeColor = document.querySelector('meta[name=theme-color]')
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', isDark ? '#121212' : '#ffffff')
        }
      }
    },

    listenToSystemThemeChange() {
      if (typeof window !== 'undefined') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (this.mode === 'system') {
            this.applyTheme()
          }
        })
      }
    }
  }
})
