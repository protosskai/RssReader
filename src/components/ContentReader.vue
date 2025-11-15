<template>
  <div
    class="content-reader"
    :class="{ 'dark': isDarkMode }"
    :style="readerStyles"
  >
    <ReadingProgressBar
      v-if="showProgressBar"
      :article-id="articleId"
      :show-estimated-time="showEstimatedTime"
    />

    <div class="reader-container">
      <div class="reader-header">
        <h1 class="article-title">{{ title }}</h1>
        <div class="article-meta">
          <span v-if="author" class="article-author">
            <q-icon name="person" size="16px" class="q-mr-xs" />
            {{ author }}
          </span>
          <span v-if="updateTime" class="article-time">
            <q-icon name="schedule" size="16px" class="q-mr-xs" />
            {{ formatDate(updateTime) }}
          </span>
          <span v-if="estimatedTime" class="reading-time">
            <q-icon name="timer" size="16px" class="q-mr-xs" />
            预计阅读 {{ estimatedTime }}
          </span>
        </div>
      </div>

      <div
        ref="contentRef"
        class="article-content"
        v-html="processedContent"
      />

      <div class="reader-footer">
        <div class="reading-stats">
          <q-chip
            v-if="showReadingTime"
            icon="timer"
            :label="`已读 ${formatReadingTime(currentReadingTime)}`"
            color="primary"
            text-color="white"
            dense
          />
          <q-chip
            v-if="showProgress"
            icon="view_list"
            :label="`进度 ${formatProgress(progress)}`"
            color="secondary"
            text-color="white"
            dense
          />
        </div>

        <div class="reading-controls">
          <q-btn
            flat
            round
            icon="keyboard_arrow_up"
            @click="scrollToTop"
          >
            <q-tooltip>回到顶部</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            icon="keyboard_arrow_down"
            @click="scrollToBottom"
          >
            <q-tooltip>到底部</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            icon="bookmark_border"
            @click="toggleBookmark"
          >
            <q-tooltip>{{ isBookmarked ? '取消收藏' : '收藏文章' }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            icon="share"
            @click="shareArticle"
          >
            <q-tooltip>分享</q-tooltip>
          </q-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useReadingStore } from '../stores/readingStore'
import { useThemeStore } from '../stores/themeStore'
import { useReadingExperience, useReadingSettings } from '../composables/useReadingExperience'
import ReadingProgressBar from './ReadingProgressBar.vue'

interface Props {
  articleId: string
  title: string
  content: string
  author?: string
  updateTime?: string
  link?: string
  isBookmarked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isBookmarked: false
})

const emit = defineEmits<{
  toggleBookmark: []
  share: [link: string]
}>()

const readingStore = useReadingStore()
const themeStore = useThemeStore()
const { settings, updateSetting } = useReadingSettings()

const contentRef = ref<HTMLElement | null>(null)
const isBookmarked = ref(props.isBookmarked)

const {
  scrollPosition,
  startReading,
  stopReading,
  scrollToTop,
  scrollToBottom,
  calculateWordCount
} = useReadingExperience(props.articleId, props.content)

// 计算属性
const isDarkMode = computed(() => themeStore.isDarkMode)

const progress = computed(() => {
  const progressData = readingStore.getProgress(props.articleId)
  return progressData?.progress || 0
})

const currentReadingTime = computed(() => {
  return readingStore.currentReadingTime
})

const estimatedTime = computed(() => {
  const wordCount = calculateWordCount(props.content)
  const estimatedSeconds = readingStore.estimateReadingTime(wordCount)
  return readingStore.formatReadingTime(estimatedSeconds)
})

const showProgressBar = computed(() => settings.value.readingProgressBar)
const showEstimatedTime = computed(() => settings.value.estimatedReadingTime)
const showReadingTime = computed(() => progress.value > 0)
const showProgress = computed(() => progress.value > 0)

const readerStyles = computed(() => ({
  '--reader-font-size': `${settings.value.fontSize}px`,
  '--reader-line-height': settings.value.lineHeight,
  '--reader-font-family': settings.value.fontFamily
}))

const processedContent = computed(() => {
  // 对内容进行处理，添加平滑滚动等样式
  let processed = props.content

  // 添加图片懒加载
  processed = processed.replace(
    /<img([^>]+)src="([^"]+)"([^>]*)>/g,
    '<img$1src="$2"$3 loading="lazy">'
  )

  // 为内容段落添加间距
  processed = processed.replace(/<p>/g, '<p class="content-paragraph">')

  return processed
})

// 方法
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatProgress = (value: number): string => {
  return `${Math.round(value)}%`
}

const formatReadingTime = (seconds: number): string => {
  return readingStore.formatReadingTime(seconds)
}

const toggleBookmark = () => {
  isBookmarked.value = !isBookmarked.value
  emit('toggleBookmark')
}

const shareArticle = () => {
  emit('share', props.link || window.location.href)
}

// 生命周期
onMounted(() => {
  startReading()
})

// 监听组件卸载
watch(() => props.articleId, (newId, oldId) => {
  if (oldId) {
    stopReading()
  }
  if (newId) {
    startReading()
  }
})
</script>

<style lang="scss" scoped>
.content-reader {
  min-height: 100vh;
  background: #fafafa;
  transition: all 0.3s ease;

  &.dark {
    background: #121212;
    color: #e0e0e0;
  }
}

.reader-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px 80px;
}

.reader-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e0e0e0;

  .dark & {
    border-bottom-color: #333;
  }

  .article-title {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.3;
    margin: 0 0 16px 0;
    color: #333;

    .dark & {
      color: #e0e0e0;
    }
  }

  .article-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 14px;
    color: #666;

    .dark & {
      color: #aaa;
    }

    span {
      display: flex;
      align-items: center;
    }
  }
}

.article-content {
  font-size: var(--reader-font-size);
  line-height: var(--reader-line-height);
  font-family: var(--reader-font-family);
  color: #333;
  word-break: break-word;

  .dark & {
    color: #e0e0e0;
  }

  :deep(.content-paragraph) {
    margin-bottom: 1.5em;

    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 16px 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      .dark & {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
    }

    a {
      color: #1976d2;
      text-decoration: none;
      transition: color 0.2s;

      &:hover {
        color: #1565c0;
        text-decoration: underline;
      }
    }

    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;

      .dark & {
        background: #2d2d2d;
      }
    }

    pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;

      .dark & {
        background: #2d2d2d;
      }

      code {
        background: transparent;
        padding: 0;
      }
    }
  }
}

.reader-footer {
  position: sticky;
  bottom: 0;
  background: white;
  border-top: 1px solid #e0e0e0;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 32px;

  .dark & {
    background: #1e1e1e;
    border-top-color: #333;
  }

  .reading-stats {
    display: flex;
    gap: 8px;
  }

  .reading-controls {
    display: flex;
    gap: 8px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .reader-container {
    padding: 16px 12px 80px;
  }

  .article-title {
    font-size: 1.5rem !important;
  }

  .reader-footer {
    flex-direction: column;
    gap: 12px;

    .reading-stats,
    .reading-controls {
      width: 100%;
      justify-content: center;
    }
  }
}
</style>
