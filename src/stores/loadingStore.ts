/**
 * 全局加载状态管理
 * 用于管理全应用的加载状态，防止重复操作
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface LoadingTask {
  id: string;
  label: string;
  timestamp: number;
}

export const useLoadingStore = defineStore('loading', () => {
  // 状态
  const loadingTasks = ref<Map<string, LoadingTask>>(new Map());
  const globalLoading = ref(false);

  // 计算属性
  const isLoading = computed(() => {
    return loadingTasks.value.size > 0;
  });

  const loadingCount = computed(() => {
    return loadingTasks.value.size;
  });

  const currentTask = computed(() => {
    if (loadingTasks.value.size === 0) return null;
    // 返回最新的任务
    const tasks = Array.from(loadingTasks.value.values());
    return tasks.sort((a, b) => b.timestamp - a.timestamp)[0];
  });

  // 方法
  const startLoading = (id: string, label: string = '加载中...') => {
    loadingTasks.value.set(id, {
      id,
      label,
      timestamp: Date.now()
    });
    updateGlobalLoading();
  };

  const stopLoading = (id: string) => {
    loadingTasks.value.delete(id);
    updateGlobalLoading();
  };

  const stopAllLoading = () => {
    loadingTasks.value.clear();
    updateGlobalLoading();
  };

  const updateLoadingLabel = (id: string, label: string) => {
    const task = loadingTasks.value.get(id);
    if (task) {
      task.label = label;
      loadingTasks.value.set(id, { ...task });
    }
  };

  const isTaskLoading = (id: string) => {
    return loadingTasks.value.has(id);
  };

  const updateGlobalLoading = () => {
    globalLoading.value = loadingTasks.value.size > 0;
  };

  // 带promise的便捷方法
  const withLoading = async <T>(
    id: string,
    label: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    try {
      startLoading(id, label);
      const result = await operation();
      return result;
    } finally {
      stopLoading(id);
    }
  };

  // 带重试的加载操作
  const withRetry = async <T>(
    id: string,
    label: string,
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> => {
    let lastError: Error;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        const retryLabel = i > 0 ? `${label} (重试 ${i}/${maxRetries})` : label;
        return await withLoading(id, retryLabel, operation);
      } catch (error) {
        lastError = error as Error;
        if (i === maxRetries) {
          throw lastError;
        }
        // 等待一段时间再重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw lastError!;
  };

  return {
    // 状态
    loadingTasks,
    globalLoading,

    // 计算属性
    isLoading,
    loadingCount,
    currentTask,

    // 方法
    startLoading,
    stopLoading,
    stopAllLoading,
    updateLoadingLabel,
    isTaskLoading,
    withLoading,
    withRetry
  };
});
