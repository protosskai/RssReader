import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { PostIndex } from 'src/common/ContentInfo';
import { useQuasar } from 'quasar';

export const useFavoriteStore = defineStore('favorite', () => {
  // 状态
  const favoritePosts = ref<PostIndex[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const $q = useQuasar();

  // 加载收藏文章列表
  const loadFavoritePosts = async () => {
    isLoading.value = true;
    error.value = null;
    
    try {
      // 从数据库加载收藏文章
      const posts = await window.electronAPI.getFavoritePosts();
      favoritePosts.value = posts;
    } catch (err) {
      console.error('加载收藏文章失败:', err);
      error.value = '加载收藏文章失败';
      // 如果API调用失败，使用空数组
      favoritePosts.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  // 切换收藏状态
  const toggleFavorite = async (post: PostIndex) => {
    const isCurrentlyFavorite = await isFavorite(post);
    
    try {
      if (isCurrentlyFavorite) {
        // 取消收藏
        await window.electronAPI.removeFavoritePost(post.guid);
        const index = favoritePosts.value.findIndex(p => p.guid === post.guid);
        if (index > -1) {
          favoritePosts.value.splice(index, 1);
        }
        $q.notify({
          message: '已取消收藏',
          color: 'info',
          position: 'top-right'
        });
      } else {
        // 添加收藏
        const postToAdd = { ...post, isFavorite: true };
        await window.electronAPI.addFavoritePost(postToAdd);
        favoritePosts.value.push(postToAdd);
        $q.notify({
          message: '收藏成功',
          color: 'positive',
          position: 'top-right'
        });
      }
    } catch (err) {
      console.error('收藏操作失败:', err);
      $q.notify({
        message: '操作失败，请重试',
        color: 'negative',
        position: 'top-right'
      });
      throw err;
    }
  };

  // 检查文章是否已收藏
  const isFavorite = async (post: PostIndex): Promise<boolean> => {
    try {
      // 调用electronAPI检查实际收藏状态
      return await window.electronAPI.isPostFavorite(post.guid);
    } catch (err) {
      console.error('检查收藏状态失败:', err);
      // 失败时回退到本地检查
      return favoritePosts.value.some(p => p.guid === post.guid);
    }
  };

  // 清空所有收藏
  const clearAllFavorites = async () => {
    try {
      // 清空所有收藏文章
      for (const post of favoritePosts.value) {
        await window.electronAPI.removeFavoritePost(post.guid);
      }
      favoritePosts.value = [];
      $q.notify({
        message: '已清空所有收藏',
        color: 'info',
        position: 'top-right'
      });
    } catch (err) {
      console.error('清空收藏失败:', err);
      $q.notify({
        message: '清空收藏失败',
        color: 'negative',
        position: 'top-right'
      });
      throw err;
    }
  };

  // 计算属性：收藏数量
  const favoriteCount = computed(() => favoritePosts.value.length);

  return {
    favoritePosts,
    isLoading,
    error,
    favoriteCount,
    loadFavoritePosts,
    toggleFavorite,
    isFavorite,
    clearAllFavorites
  };
});