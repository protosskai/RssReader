/**
 * Folder Store - 基于新架构的文件夹管理Store
 * 使用Service层而不是直接调用electronAPI
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Folder } from 'src-electron/domain/models/Article';

export const useFolderStore = defineStore('folder', () => {
  // 状态
  const folders = ref<Folder[]>([]);
  const currentFolder = ref<Folder | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const folderNames = computed(() => folders.value.map(folder => folder.name));
  const defaultFolderExists = computed(() =>
    folders.value.some(folder => folder.name === '默认')
  );

  // 加载文件夹列表
  const loadFolders = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      folders.value = await window.electronAPI.getFolders();
    } catch (err: any) {
      console.error('加载文件夹失败:', err);
      error.value = err.message || '加载文件夹失败';
      folders.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  // 加载单个文件夹
  const loadFolder = async (name: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      currentFolder.value = await window.electronAPI.getFolder(name);
    } catch (err: any) {
      console.error('加载文件夹失败:', err);
      error.value = err.message || '加载文件夹失败';
      currentFolder.value = null;
    } finally {
      isLoading.value = false;
    }
  };

  // 添加文件夹
  const addFolder = async (name: string) => {
    try {
      await window.electronAPI.addFolderV2(name);
      await loadFolders(); // 重新加载列表
    } catch (err: any) {
      console.error('添加文件夹失败:', err);
      throw new Error(err.message || '添加文件夹失败');
    }
  };

  // 删除文件夹
  const removeFolder = async (name: string) => {
    try {
      await window.electronAPI.removeFolderV2(name);
      await loadFolders(); // 重新加载列表
    } catch (err: any) {
      console.error('删除文件夹失败:', err);
      throw new Error(err.message || '删除文件夹失败');
    }
  };

  // 重命名文件夹
  const renameFolder = async (oldName: string, newName: string) => {
    try {
      await window.electronAPI.renameFolder(oldName, newName);
      await loadFolders(); // 重新加载列表
    } catch (err: any) {
      console.error('重命名文件夹失败:', err);
      throw new Error(err.message || '重命名文件夹失败');
    }
  };

  // 检查文件夹是否存在
  const folderExists = (name: string) => {
    return folders.value.some(folder => folder.name === name);
  };

  // 获取文件夹（本地查找）
  const getFolderByName = (name: string) => {
    return folders.value.find(folder => folder.name === name);
  };

  return {
    // 状态
    folders,
    currentFolder,
    isLoading,
    error,

    // 计算属性
    folderNames,
    defaultFolderExists,

    // 方法
    loadFolders,
    loadFolder,
    addFolder,
    removeFolder,
    renameFolder,
    folderExists,
    getFolderByName
  };
});
