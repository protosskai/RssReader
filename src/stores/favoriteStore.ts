import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { PostIndexItem } from 'src/common/models';
import { electronClient } from 'src/services/electronClient';

/**
 * Favorite store – manages persisted favorite posts.
 *
 * IMPORTANT: This store returns operation results as plain values
 * instead of showing Quasar notifications directly.  Components
 * should use the returned result to decide whether to notify.
 */
export const useFavoriteStore = defineStore('favorite', () => {
  // ── State ────────────────────────────────────────────────
  const favoritePosts = ref<PostIndexItem[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // ── Computed ─────────────────────────────────────────────
  const favoriteCount = computed(() => favoritePosts.value.length);

  // ── Actions ──────────────────────────────────────────────

  /**
   * Load all favorite posts from the database.
   * Returns the post array so callers can sort / filter.
   */
  const loadFavoritePosts = async (): Promise<PostIndexItem[]> => {
    isLoading.value = true;
    error.value = null;
    try {
      const posts = await electronClient.getFavoritePosts();
      favoritePosts.value = posts;
      return posts;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载收藏文章失败';
      error.value = msg;
      console.error('加载收藏文章失败:', err);
      favoritePosts.value = [];
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /** Alias – some call-sites use getFavoritePosts */
  const getFavoritePosts = loadFavoritePosts;

  /**
   * Toggle a post's favorite status.
   * Returns { favorited: boolean } so the caller can notify
   * and update local UI without re-fetching.
   */
  const toggleFavorite = async (
    post: PostIndexItem,
  ): Promise<{ favorited: boolean }> => {
    error.value = null;
    try {
      const isCurrentlyFavorite = await isFavorite(post);

      if (isCurrentlyFavorite) {
        await electronClient.removeFavoritePost(post.guid);
        const index = favoritePosts.value.findIndex((p) => p.guid === post.guid);
        if (index > -1) favoritePosts.value.splice(index, 1);
        return { favorited: false };
      } else {
        const postToAdd = { ...post, isFavorite: true };
        await electronClient.addFavoritePost(postToAdd);
        favoritePosts.value.push(postToAdd);
        return { favorited: true };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '切换收藏状态失败';
      error.value = msg;
      console.error('切换收藏状态失败:', err);
      throw err;
    }
  };

  /**
   * Check whether a post is favorited.
   * Falls back to local state if the IPC call fails.
   */
  const isFavorite = async (post: PostIndexItem): Promise<boolean> => {
    try {
      return await electronClient.isPostFavorite(post.guid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '检查收藏状态失败';
      error.value = msg;
      console.error('检查收藏状态失败:', err);
      return favoritePosts.value.some((p) => p.guid === post.guid);
    }
  };

  /**
   * Remove all favorites.  Uses Promise.all for concurrency
   * instead of sequential awaits.
   */
  const clearAllFavorites = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    try {
      const guids = favoritePosts.value.map((p) => p.guid);
      await Promise.all(
        guids.map((guid) => electronClient.removeFavoritePost(guid)),
      );
      favoritePosts.value = [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : '清空收藏失败';
      error.value = msg;
      console.error('清空收藏失败:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Reset store to initial state.
   * Call on logout / app-close / user-data clear.
   */
  const $reset = (): void => {
    favoritePosts.value = [];
    isLoading.value = false;
    error.value = null;
  };

  return {
    // state
    favoritePosts,
    isLoading,
    error,
    // getters
    favoriteCount,
    // actions
    loadFavoritePosts,
    getFavoritePosts,
    toggleFavorite,
    isFavorite,
    clearAllFavorites,
    $reset,
  };
});
