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
  <!-- :key forces full remount of the app tree after retry -->
  <slot v-else :key="remountKey" />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const error = ref<Error | null>(null)
const errorMessage = ref('发生了一个未知错误')
const remountKey = ref(0)

onErrorCaptured((err: Error, _instance, info) => {
  error.value = err
  errorMessage.value = err.message || '发生了一个未知错误'
  console.error('[ErrorBoundary] captured:', err?.message, info, err?.stack)
  return false
})

const retry = () => {
  error.value = null
  errorMessage.value = '发生了一个未知错误'
  remountKey.value += 1
  // Hard navigation back to home if needed
  if (!location.hash || location.hash === '#/__retry__') {
    location.hash = '#/'
  }
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
