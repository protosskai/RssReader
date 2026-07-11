import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  isDark: boolean
}

/**
 * Theme store — never calls useQuasar() inside actions.
 * useQuasar requires an active component instance; pinia actions
 * (and media-query listeners) often run outside setup and would throw
 * "Cannot destructure property 'proxy' of getCurrentInstance()".
 * Dark mode is applied via document class; AppLayout also syncs $q.dark.
 */
export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    mode: 'system',
    isDark: false,
  }),

  getters: {
    currentMode: (state) => state.mode,
    isDarkMode: (state) => state.isDark,
  },

  actions: {
    initializeTheme() {
      const savedMode = localStorage.getItem('themeMode') as ThemeMode | null
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
        this.mode = savedMode
      } else {
        this.mode = 'system'
      }
      this.applyTheme()
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
      if (typeof window === 'undefined' || typeof document === 'undefined') return

      let isDark = false
      if (this.mode === 'system') {
        isDark = this.detectSystemTheme()
      } else {
        isDark = this.mode === 'dark'
      }

      this.isDark = isDark

      // Native class toggles (body + html for Quasar body--dark compatibility)
      document.documentElement.classList.toggle('body--dark', isDark)
      document.documentElement.classList.toggle('dark', isDark)
      document.body.classList.toggle('body--dark', isDark)
      document.body.classList.toggle('dark', isDark)

      this.updateMetaThemeColor(isDark)

      // Best-effort Quasar dark sync without useQuasar()
      try {
        const q = (window as unknown as { $q?: { dark?: { set: (v: boolean) => void } } }).$q
        if (q?.dark?.set) {
          q.dark.set(isDark)
        }
      } catch {
        /* ignore */
      }
    },

    detectSystemTheme(): boolean {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      return false
    },

    updateMetaThemeColor(isDark: boolean) {
      if (typeof document === 'undefined') return
      const metaThemeColor = document.querySelector('meta[name=theme-color]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#121212' : '#ffffff')
      }
    },

    listenToSystemThemeChange() {
      if (typeof window === 'undefined' || !window.matchMedia) return
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (this.mode === 'system') {
            this.applyTheme()
          }
        })
    },
  },
})
