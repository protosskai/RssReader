<template>
  <div v-if="error" class="error-boundary">
    <div class="error-boundary__content">
      <q-icon name="error_outline" size="48px" color="negative" />
      <h3 class="text-h6 q-mt-md">出错了</h3>
      <p class="text-grey-7">{{ errorMessage }}</p>
      <q-btn
        color="primary"
        label="重试"
        icon="refresh"
        @click="retry"
        class="q-mt-md"
      />
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const error = ref<Error | null>(null)
const errorMessage = ref('发生了一个未知错误')

onErrorCaptured((err: Error) => {
  error.value = err
  errorMessage.value = err.message || '发生了一个未知错误'
  console.error('[ErrorBoundary] captured:', err)
  // 返回 false 阻止错误继续向上传播
  return false
})

const retry = () => {
  error.value = null
  errorMessage.value = '发生了一个未知错误'
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}
.error-boundary__content {
  max-width: 400px;
  padding: 24px;
}
</style>
