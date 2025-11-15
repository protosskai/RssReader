<template>
  <div v-if="visible" class="loading-overlay">
    <div class="loading-content">
      <!-- 旋转图标 -->
      <div class="loading-spinner">
        <svg width="50" height="50" viewBox="0 0 50 50">
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray="31.416"
            stroke-dashoffset="31.416"
            class="spinner-path"
          />
        </svg>
      </div>

      <!-- 加载文本 -->
      <div class="loading-text">
        <div class="loading-label">{{ label }}</div>
        <div v-if="subLabel" class="loading-sublabel">{{ subLabel }}</div>
      </div>

      <!-- 进度条（可选） -->
      <div v-if="showProgress && progress >= 0" class="loading-progress">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
        <div class="progress-text">{{ progress }}%</div>
      </div>

      <!-- 取消按钮（可选） -->
      <div v-if="cancellable" class="loading-actions">
        <q-btn
          flat
          label="取消"
          color="white"
          @click="$emit('cancel')"
          size="sm"
        />
      </div>
    </div>

    <!-- 背景遮罩 -->
    <div class="loading-backdrop"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  visible: boolean;
  label?: string;
  subLabel?: string;
  progress?: number;
  showProgress?: boolean;
  cancellable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  label: '加载中...',
  subLabel: '',
  progress: -1,
  showProgress: false,
  cancellable: false
});

defineEmits<{
  cancel: [];
}>();

const label = computed(() => props.label);
const subLabel = computed(() => props.subLabel);
const showProgress = computed(() => props.showProgress);
const progress = computed(() => props.progress);
const cancellable = computed(() => props.cancellable);
const visible = computed(() => props.visible);
</script>

<style lang="scss" scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none; /* 允许点击背景 */
}

.loading-content {
  position: relative;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 16px;
  padding: 32px 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-width: 200px;
  pointer-events: auto; /* 允许点击内容 */
  animation: loadingSlideIn 0.3s ease-out;
}

.loading-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  animation: backdropFadeIn 0.3s ease-out;
}

.loading-spinner {
  position: relative;
  color: #1976d2;
}

.spinner-path {
  animation: spinnerRotate 1.5s linear infinite;
  stroke-dasharray: 31.416;
  stroke-dashoffset: 23.562;
  animation: spinnerDash 1.5s ease-in-out infinite;
}

@keyframes spinnerRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes spinnerDash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

.loading-text {
  text-align: center;
}

.loading-label {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.loading-sublabel {
  font-size: 14px;
  color: #666;
}

.loading-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1976d2, #42a5f5);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.loading-actions {
  margin-top: 8px;
}

/* 深色模式适配 */
:global(.body--dark) .loading-content {
  background: rgba(30, 30, 30, 0.95);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

:global(.body--dark) .loading-label {
  color: #e0e0e0;
}

:global(.body--dark) .loading-sublabel,
:global(.body--dark) .progress-text {
  color: #aaa;
}

:global(.body--dark) .progress-bar {
  background: #444;
}

/* 动画 */
@keyframes loadingSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes backdropFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .loading-content {
    margin: 0 16px;
    padding: 24px 32px;
  }

  .loading-label {
    font-size: 16px;
  }

  .loading-sublabel {
    font-size: 13px;
  }
}
</style>
