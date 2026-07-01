import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'rss_reader_reading_progress';

function loadFromStorage(): Map<string, ReadingProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr: ReadingProgress[] = JSON.parse(raw);
      return new Map(arr.map((p) => [p.articleId, { ...p, lastReadAt: new Date(p.lastReadAt) }]));
    }
  } catch { /* ignore corrupt data */ }
  return new Map();
}

function saveToStorage(progressMap: Map<string, ReadingProgress>): void {
  try {
    const arr = Array.from(progressMap.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* quota exceeded */ }
}

export interface ReadingProgress {
  articleId: string
  progress: number // 0-100
  scrollPosition: number // 0-1
  lastReadAt: Date
  readingTime: number // 秒
  wordCount: number
  estimatedReadingTime: number // 估算阅读时间（秒）
  markedAsRead: boolean
}

export const useReadingStore = defineStore('reading', () => {
  // 状态 — 从 localStorage 恢复阅读进度
  const readingProgress = ref<Map<string, ReadingProgress>>(loadFromStorage())
  const currentArticleId = ref<string | null>(null)
  const isReading = ref(false)
  const readingStartTime = ref<number | null>(null)
  const autoMarkAsReadThreshold = 0.8 // 滚动到80%时自动标记为已读

  // 计算属性
  const currentProgress = computed(() => {
    if (!currentArticleId.value) return null
    return readingProgress.value.get(currentArticleId.value) || null
  })

  const currentReadingTime = computed(() => {
    if (!readingStartTime.value || !isReading.value) return 0
    return Math.floor((Date.now() - readingStartTime.value) / 1000)
  })

  // 方法
  /**
   * 开始阅读文章
   * @param articleId 文章ID
   * @param wordCount 文章字数
   */
  const startReading = (articleId: string, wordCount: number) => {
    console.log(`[readingStore] Starting to read article: ${articleId}`)
    currentArticleId.value = articleId
    isReading.value = true
    readingStartTime.value = Date.now()

    // 估算阅读时间（假设平均阅读速度为每分钟250词）
    const estimatedTime = Math.ceil(wordCount / 250 * 60)

    // 初始化或更新阅读进度
    const existingProgress = readingProgress.value.get(articleId)
    if (existingProgress) {
      existingProgress.lastReadAt = new Date()
    } else {
      readingProgress.value.set(articleId, {
        articleId,
        progress: 0,
        scrollPosition: 0,
        lastReadAt: new Date(),
        readingTime: 0,
        wordCount,
        estimatedReadingTime: estimatedTime,
        markedAsRead: false
      })
    }
    saveToStorage(readingProgress.value);
  }

  /**
   * 更新阅读进度
   * @param articleId 文章ID
   * @param scrollPosition 滚动位置 (0-1)
   */
  const updateProgress = (articleId: string, scrollPosition: number) => {
    if (articleId !== currentArticleId.value) return

    const progress = Math.min(100, Math.max(0, scrollPosition * 100))
    const existingProgress = readingProgress.value.get(articleId)

    if (existingProgress) {
      existingProgress.progress = progress
      existingProgress.scrollPosition = scrollPosition
      existingProgress.lastReadAt = new Date()

      // 更新阅读时间
      if (readingStartTime.value) {
        existingProgress.readingTime = Math.floor((Date.now() - readingStartTime.value) / 1000)
      }

      // 自动标记为已读
      if (scrollPosition >= autoMarkAsReadThreshold && !existingProgress.markedAsRead) {
        existingProgress.markedAsRead = true
        console.log(`[readingStore] Article ${articleId} automatically marked as read`)
      }
      saveToStorage(readingProgress.value);
    }
  }

  /**
   * 停止阅读
   * @param articleId 文章ID
   */
  const stopReading = (articleId: string) => {
    if (articleId !== currentArticleId.value) return

    console.log(`[readingStore] Stopped reading article: ${articleId}`)
    isReading.value = false
    readingStartTime.value = null

    const progress = readingProgress.value.get(articleId)
    if (progress && readingStartTime.value) {
      progress.readingTime = Math.floor((Date.now() - readingStartTime.value) / 1000)
    }
  }

  /**
   * 获取文章的阅读进度
   * @param articleId 文章ID
   */
  const getProgress = (articleId: string): ReadingProgress | undefined => {
    return readingProgress.value.get(articleId)
  }

  /**
   * 获取所有阅读进度
   */
  const getAllProgress = (): ReadingProgress[] => {
    return Array.from(readingProgress.value.values())
  }

  /**
   * 清空阅读进度
   * @param articleId 文章ID（不传则清空所有）
   */
  const clearProgress = (articleId?: string) => {
    if (articleId) {
      readingProgress.value.delete(articleId)
      console.log(`[readingStore] Cleared progress for article: ${articleId}`)
    } else {
      readingProgress.value.clear()
      console.log('[readingStore] Cleared all reading progress')
    }
    saveToStorage(readingProgress.value);
  }

  /**
   * 估算阅读时间（基于字数和阅读速度）
   * @param wordCount 字数
   * @param wpm 每分钟阅读词数（默认250）
   */
  const estimateReadingTime = (wordCount: number, wpm: number = 250): number => {
    return Math.ceil(wordCount / wpm * 60)
  }

  /**
   * 格式化阅读时间
   * @param seconds 秒数
   */
  const formatReadingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}秒`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
    } else {
      const hours = Math.floor(seconds / 3600)
      const remainingMinutes = Math.floor((seconds % 3600) / 60)
      return `${hours}小时${remainingMinutes}分钟`
    }
  }

  /**
   * 格式化阅读进度百分比
   * @param progress 进度百分比
   */
  const formatProgress = (progress: number): string => {
    return `${Math.round(progress)}%`
  }

  return {
    // 状态
    readingProgress,
    currentArticleId,
    isReading,
    readingStartTime,

    // 计算属性
    currentProgress,
    currentReadingTime,

    // 方法
    startReading,
    updateProgress,
    stopReading,
    getProgress,
    getAllProgress,
    clearProgress,
    estimateReadingTime,
    formatReadingTime,
    formatProgress
  }
})
