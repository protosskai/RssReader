import { ref, onMounted, onUnmounted } from 'vue'
import { useReadingStore } from '../stores/readingStore'
import { extractTextFromHtml } from '../../src-electron/util/string'

/**
 * 阅读体验Composable
 * 提供阅读进度跟踪、自动标记已读等功能
 */
export const useReadingExperience = (articleId: string, content: string) => {
  const readingStore = useReadingStore()
  const scrollPosition = ref(0)
  const isScrolling = ref(false)
  let scrollTimeoutId: number | null = null

  /**
   * 计算文章字数
   * @param htmlContent HTML内容
   */
  const calculateWordCount = (htmlContent: string): number => {
    const plainText = extractTextFromHtml(htmlContent)
    return plainText.length
  }

  /**
   * 更新阅读进度
   */
  const updateReadingProgress = () => {
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    const scrollPercent = docHeight > 0 ? scrollTop / docHeight : 0

    scrollPosition.value = scrollPercent
    readingStore.updateProgress(articleId, scrollPercent)
  }

  /**
   * 处理滚动事件（防抖）
   */
  const handleScroll = () => {
    isScrolling.value = true
    updateReadingProgress()

    // 清除之前的定时器
    if (scrollTimeoutId) {
      clearTimeout(scrollTimeoutId)
    }

    // 500ms后停止滚动状态
    scrollTimeoutId = window.setTimeout(() => {
      isScrolling.value = false
    }, 500)
  }

  /**
   * 开始阅读
   */
  const startReading = () => {
    const wordCount = calculateWordCount(content)
    console.log(`[useReadingExperience] Starting reading: ${articleId}, word count: ${wordCount}`)
    readingStore.startReading(articleId, wordCount)
  }

  /**
   * 停止阅读
   */
  const stopReading = () => {
    console.log(`[useReadingExperience] Stopping reading: ${articleId}`)
    readingStore.stopReading(articleId)
  }

  /**
   * 平滑滚动到顶部
   */
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  /**
   * 平滑滚动到底部
   */
  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    })
  }

  /**
   * 跳转到指定百分比位置
   * @param percent 百分比 (0-100)
   */
  const scrollToPercent = (percent: number) => {
    const targetPosition = (percent / 100) * (document.documentElement.scrollHeight - window.innerHeight)
    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    })
  }

  // 组件挂载时添加滚动监听
  onMounted(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    console.log(`[useReadingExperience] Scroll listener added for article: ${articleId}`)
  })

  // 组件卸载时移除滚动监听
  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
    stopReading()
    if (scrollTimeoutId) {
      clearTimeout(scrollTimeoutId)
    }
    console.log(`[useReadingExperience] Scroll listener removed for article: ${articleId}`)
  })

  return {
    scrollPosition,
    isScrolling,
    updateReadingProgress,
    startReading,
    stopReading,
    scrollToTop,
    scrollToBottom,
    scrollToPercent,
    calculateWordCount
  }
}

/**
 * 平滑滚动Composable
 * 提供跨组件的平滑滚动功能
 */
export const useSmoothScroll = () => {
  /**
   * 平滑滚动到指定元素
   * @param selector CSS选择器
   * @param offset 偏移量
   */
  const scrollToElement = (selector: string, offset: number = 0) => {
    const element = document.querySelector(selector) as HTMLElement
    if (element) {
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      })
    }
  }

  /**
   * 平滑滚动到顶部
   */
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  /**
   * 平滑滚动到底部
   */
  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    })
  }

  return {
    scrollToElement,
    scrollToTop,
    scrollToBottom
  }
}

/**
 * 阅读设置Composable
 * 管理阅读相关的用户设置
 */
export const useReadingSettings = () => {
  const settings = ref({
    fontSize: 16, // 字体大小
    lineHeight: 1.6, // 行高
    fontFamily: 'system-ui', // 字体家族
    theme: 'auto', // 主题 (light/dark/auto)
    readingProgressBar: true, // 是否显示阅读进度条
    autoMarkAsRead: true, // 是否自动标记已读
    estimatedReadingTime: true // 是否显示估算阅读时间
  })

  /**
   * 从localStorage加载设置
   */
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('readingSettings')
      if (saved) {
        const parsed = JSON.parse(saved)
        settings.value = { ...settings.value, ...parsed }
      }
    } catch (error) {
      console.error('[useReadingSettings] Failed to load settings:', error)
    }
  }

  /**
   * 保存设置到localStorage
   */
  const saveSettings = () => {
    try {
      localStorage.setItem('readingSettings', JSON.stringify(settings.value))
    } catch (error) {
      console.error('[useReadingSettings] Failed to save settings:', error)
    }
  }

  /**
   * 更新单个设置
   * @param key 设置键
   * @param value 设置值
   */
  const updateSetting = <K extends keyof typeof settings.value>(
    key: K,
    value: typeof settings.value[K]
  ) => {
    settings.value[key] = value
    saveSettings()
  }

  /**
   * 重置设置为默认值
   */
  const resetSettings = () => {
    settings.value = {
      fontSize: 16,
      lineHeight: 1.6,
      fontFamily: 'system-ui',
      theme: 'auto',
      readingProgressBar: true,
      autoMarkAsRead: true,
      estimatedReadingTime: true
    }
    saveSettings()
  }

  // 加载设置
  loadSettings()

  return {
    settings,
    loadSettings,
    saveSettings,
    updateSetting,
    resetSettings
  }
}
