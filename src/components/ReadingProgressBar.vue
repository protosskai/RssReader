<template>
  <div
    v-if="showProgressBar"
    class="reading-progress-bar"
    :class="{ 'dark': isDarkMode }"
    @click="handleClick"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <div
      class="progress-track"
      :style="{ width: `${trackWidth}%` }"
    >
      <div
        class="progress-fill"
        :style="{
          width: `${progress}%`,
          backgroundColor: progressColor
        }"
      >
        <div
          v-if="showTooltip && hoverPosition !== null"
          class="progress-tooltip"
          :style="{ left: `${hoverPosition}px` }"
        >
          {{ formatProgress(progress) }}
        </div>
      </div>
    </div>
    <div class="progress-info">
      <span class="progress-text">{{ formatProgress(progress) }}</span>
      <span v-if="showEstimatedTime" class="reading-time">
        <q-icon name="schedule" size="14px" class="q-mr-xs" />
        {{ estimatedTime }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useReadingStore } from '../stores/readingStore'
import { useThemeStore } from '../stores/themeStore'

interface Props {
  articleId: string
  showProgressBar?: boolean
  showEstimatedTime?: boolean
  showTooltip?: boolean
  height?: number
  trackWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  showProgressBar: true,
  showEstimatedTime: true,
  showTooltip: true,
  height: 4,
  trackWidth: 100
})

const readingStore = useReadingStore()
const themeStore = useThemeStore()

const hoverPosition = ref<number | null>(null)
const showTooltip = ref(false)

const progress = computed(() => {
  const progressData = readingStore.getProgress(props.articleId)
  return progressData?.progress || 0
})

const estimatedTime = computed(() => {
  const progressData = readingStore.getProgress(props.articleId)
  if (!progressData) return ''
  const remainingTime = Math.max(0, progressData.estimatedReadingTime - progressData.readingTime)
  return `剩余 ${readingStore.formatReadingTime(remainingTime)}`
})

const isDarkMode = computed(() => themeStore.isDarkMode)

const progressColor = computed(() => {
  if (progress.value < 30) {
    return '#4caf50' // 绿色
  } else if (progress.value < 70) {
    return '#ff9800' // 橙色
  } else {
    return '#f44336' // 红色
  }
})

const formatProgress = (value: number): string => {
  return `${Math.round(value)}%`
}

const handleClick = (event: MouseEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  const percent = (x / rect.width) * 100

  // 平滑滚动到指定位置
  const targetPosition = (percent / 100) * (document.documentElement.scrollHeight - window.innerHeight)
  window.scrollTo({
    top: targetPosition,
    behavior: 'smooth'
  })
}

const handleMouseMove = (event: MouseEvent) => {
  if (!props.showTooltip) return

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  hoverPosition.value = x
  showTooltip.value = true
}

const handleMouseLeave = () => {
  hoverPosition.value = null
  showTooltip.value = false
}
</script>

<style lang="scss" scoped>
.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 8px 16px 4px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.95);
    padding-bottom: 8px;
  }

  &.dark {
    background: rgba(30, 30, 30, 0.9);

    &:hover {
      background: rgba(30, 30, 30, 0.95);
    }
  }
}

.progress-track {
  height: v-bind(height)px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  position: relative;

  .dark & {
    background: rgba(255, 255, 255, 0.1);
  }
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
  position: relative;
  min-width: 2px;

  .progress-tooltip {
    position: absolute;
    bottom: 100%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;

    &::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: rgba(0, 0, 0, 0.8);
    }
  }
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);

  .dark & {
    color: rgba(255, 255, 255, 0.6);
  }
}

.progress-text {
  font-weight: 500;
}

.reading-time {
  display: flex;
  align-items: center;
}
</style>
