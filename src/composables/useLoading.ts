/**
 * 全局Loading Composable
 * 提供便捷的方法来管理全局加载状态
 */

import { useLoadingStore } from 'src/stores/loadingStore';
import { useQuasar } from 'quasar';
import { ref, readonly } from 'vue';

/**
 * 使用全局Loading状态
 */
export function useGlobalLoading() {
  const loadingStore = useLoadingStore();
  const $q = useQuasar();

  /**
   * 显示全局加载
   * @param message 加载消息
   * @param delay 延迟显示时间（毫秒），避免闪烁
   */
  const showLoading = (message: string = '加载中...', delay: number = 300) => {
    const timer = setTimeout(() => {
      $q.loading.show({
        message,
        spinnerColor: 'primary',
        messageColor: 'dark',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        delay
      });
    }, delay);

    return () => {
      clearTimeout(timer);
      $q.loading.hide();
    };
  };

  /**
   * 隐藏全局加载
   */
  const hideLoading = () => {
    $q.loading.hide();
  };

  /**
   * 带加载状态的操作
   */
  const withLoading = async <T>(
    message: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const hide = showLoading(message);
    try {
      return await operation();
    } finally {
      hide();
    }
  };

  /**
   * 显示进度加载
   */
  const showProgressLoading = (
    message: string,
    progress: number = 0
  ) => {
    $q.loading.show({
      message: `${message} (${progress}%)`,
      spinnerColor: 'primary',
      messageColor: 'dark',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      progress: {
        color: 'primary',
        value: progress
      }
    });
  };

  /**
   * 更新进度
   */
  const updateProgress = (progress: number, message?: string) => {
    $q.loading.update({
      progress: {
        color: 'primary',
        value: progress
      },
      message: message || `加载中... (${progress}%)`
    });
  };

  /**
   * 显示通知消息
   */
  const notify = (type: 'positive' | 'negative' | 'warning' | 'info', message: string) => {
    $q.notify({
      type,
      message,
      position: 'top',
      timeout: 2500
    });
  };

  return {
    // Store属性
    isLoading: loadingStore.isLoading,
    loadingCount: loadingStore.loadingCount,
    currentTask: loadingStore.currentTask,

    // 方法
    showLoading,
    hideLoading,
    withLoading,
    showProgressLoading,
    updateProgress,
    notify,
    startLoading: loadingStore.startLoading,
    stopLoading: loadingStore.stopLoading,
    stopAllLoading: loadingStore.stopAllLoading,
    withRetry: loadingStore.withRetry
  };
}

/**
 * 防抖加载 - 避免快速重复操作
 */
export function useDebouncedLoading(delay: number = 500) {
  const timer = ref<number | null>(null);
  const loadingStore = useLoadingStore();

  const showDebouncedLoading = (
    id: string,
    label: string,
    operation: () => Promise<any>
  ) => {
    // 清除之前的定时器
    if (timer.value) {
      clearTimeout(timer.value);
    }

    // 设置新的定时器
    timer.value = setTimeout(async () => {
      try {
        await loadingStore.withLoading(id, label, operation);
      } catch (error) {
        console.error('Loading operation failed:', error);
        throw error;
      }
    }, delay) as unknown as number;
  };

  const cancel = () => {
    if (timer.value) {
      clearTimeout(timer.value);
      timer.value = null;
    }
  };

  return {
    showDebouncedLoading,
    cancel
  };
}

/**
 * 页面级加载状态管理
 */
export function usePageLoading() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const $q = useQuasar();

  const withPageLoading = async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    loading.value = true;
    error.value = null;

    try {
      const result = await operation();
      return result;
    } catch (err) {
      const message = (err as Error).message || '操作失败';
      error.value = message;
      $q.notify({
        type: 'negative',
        message,
        position: 'top'
      });
      return null;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading: readonly(loading),
    error: readonly(error),
    withPageLoading
  };
}
