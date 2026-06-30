/**
 * useFavorite — 收藏管理
 */
import { ref, computed } from 'vue';
import type { PostIndexItem } from 'src/common/models';
import { electronClient } from 'src/services/electronClient';

export function useFavorite() {
  const favoritePosts = ref<PostIndexItem[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const favoriteCount = computed(() => favoritePosts.value.length);

  const loadFavoritePosts = async (): Promise<PostIndexItem[]> => {
    isLoading.value = true; error.value = null;
    try { const p = await electronClient.getFavoritePosts(); favoritePosts.value = p; return p; }
    catch (e) { error.value = e instanceof Error ? e.message : '加载收藏失败'; favoritePosts.value = []; throw e; }
    finally { isLoading.value = false; }
  };

  const toggleFavorite = async (post: PostIndexItem): Promise<{ favorited: boolean }> => {
    error.value = null;
    try {
      const isCurrently = await isFavorite(post);
      if (isCurrently) {
        await electronClient.removeFavoritePost(post.guid);
        const idx = favoritePosts.value.findIndex((p) => p.guid === post.guid);
        if (idx > -1) favoritePosts.value.splice(idx, 1);
        return { favorited: false };
      }
      const postToAdd = { ...post, isFavorite: true };
      await electronClient.addFavoritePost(postToAdd);
      favoritePosts.value.push(postToAdd);
      return { favorited: true };
    } catch (e) { error.value = e instanceof Error ? e.message : '切换收藏失败'; throw e; }
  };

  const isFavorite = async (post: PostIndexItem): Promise<boolean> => {
    try { return await electronClient.isPostFavorite(post.guid); }
    catch { return favoritePosts.value.some((p) => p.guid === post.guid); }
  };

  const clearAllFavorites = async () => {
    isLoading.value = true; error.value = null;
    try {
      const guids = favoritePosts.value.map((p) => p.guid);
      await Promise.all(guids.map((g) => electronClient.removeFavoritePost(g)));
      favoritePosts.value = [];
    } catch (e) { error.value = e instanceof Error ? e.message : '清空收藏失败'; throw e; }
    finally { isLoading.value = false; }
  };

  return { favoritePosts, isLoading, error, favoriteCount, loadFavoritePosts, toggleFavorite, isFavorite, clearAllFavorites };
}
