<template>
  <q-page class="ink-fav">
    <div class="ink-stage ink-fav__inner">
      <header class="ink-fav__header">
        <p class="ink-eyebrow">Library</p>
        <h1 class="ink-title" style="font-size: var(--ink-h1-size); margin: 4px 0 0">Favorites</h1>
      </header>

      <div v-if="loading" class="ink-fav__list">
        <div v-for="n in 5" :key="'sk'+n" class="ink-fav-card ink-fav-card--skel">
          <q-skeleton type="text" width="70%" />
          <q-skeleton type="text" width="40%" class="q-mt-sm" />
          <q-skeleton type="text" width="95%" class="q-mt-md" />
        </div>
      </div>

      <div v-else-if="error" class="ink-empty">
        <q-icon name="wifi_off" size="48px" class="ink-empty__icon" color="negative" />
        <h2 class="ink-empty__title">Couldn’t load favorites</h2>
        <p class="ink-empty__desc">{{ error }}</p>
        <q-btn class="ink-btn-primary" unelevated no-caps icon="refresh" label="Retry" @click="loadFavoritePosts" />
      </div>

      <div v-else-if="favoritePosts.length === 0" class="ink-empty">
        <q-icon name="star_outline" size="56px" class="ink-empty__icon" />
        <h2 class="ink-empty__title">No favorites yet</h2>
        <p class="ink-empty__desc">Star an article while reading — it will appear here for later.</p>
        <q-btn class="ink-btn-primary" unelevated no-caps icon="home" label="Browse feeds" @click="goToHome" />
      </div>

      <div v-else class="ink-fav__list">
        <article
          v-for="post in favoritePosts"
          :key="post.guid"
          class="ink-fav-card"
          tabindex="0"
          role="button"
          @click="openContentPage(post)"
          @keydown.enter="openContentPage(post)"
        >
          <div class="ink-fav-card__top">
            <div class="ink-fav-card__text">
              <h3 class="ink-fav-card__title">{{ post.title }}</h3>
              <p class="ink-meta">{{ post.author }} · {{ formatRelativeTime(post.updateTime) }}</p>
            </div>
            <q-btn flat round dense icon="star" color="amber" @click.stop="unfavoritePost(post)" aria-label="Unfavorite" />
          </div>
          <p class="ink-fav-card__desc">{{ extractTextFromHtml(post.desc) }}</p>
          <div class="ink-fav-card__actions" @click.stop>
            <q-btn dense no-caps unelevated class="ink-btn-primary" label="Read" @click="openContentPage(post)" />
            <q-btn dense flat round icon="open_in_new" @click="openInBrowser(post)" />
          </div>
        </article>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import {ref, onMounted} from "vue";
import { electronClient } from "src/services/electronClient";
import {useQuasar} from "quasar";
import {extractTextFromHtml, formatRelativeTime} from "src/common/util";
import {useFavoriteStore} from "src/stores/favoriteStore";
import {useRssInfoStore} from "src/stores/rssInfoStore";
import type {PostIndexItem} from "src/common/models";
import {useRouter} from "vue-router";

const $q = useQuasar();
const router = useRouter();
const favoriteStore = useFavoriteStore();

const favoritePosts = ref<PostIndexItem[]>([]);
const loading = ref(true);
const error = ref('');
const focusedGuid = ref<string | null>(null);

// 加载收藏文章
const loadFavoritePosts = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const posts = await favoriteStore.getFavoritePosts();
    // 按更新时间倒序排序
    favoritePosts.value = posts.sort((a, b) => {
      return new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime();
    });
  } catch (err) {
    console.error('加载收藏文章失败:', err);
    error.value = '无法加载收藏文章，请稍后重试';
  } finally {
    loading.value = false;
  }
};

// 取消收藏
const unfavoritePost = async (post: PostIndexItem) => {
  try {
    // 先在UI上移除，提升用户体验
    const index = favoritePosts.value.findIndex(p => p.guid === post.guid);
    if (index !== -1) {
      favoritePosts.value.splice(index, 1);
    }
    
    // 设置isFavorite为false并调用toggleFavorite
    const postToToggle = { ...post, isFavorite: false };
    await favoriteStore.toggleFavorite(postToToggle);
    
    $q.notify({
      type: 'info',
      message: '已取消收藏',
      position: 'top-right',
      timeout: 1200
    });
  } catch (err) {
    console.error('取消收藏失败:', err);
    // 如果失败，重新加载列表
    await loadFavoritePosts();
    $q.notify({
      type: 'negative',
      message: '操作失败，请重试',
      position: 'top-right'
    });
  }
};

// 打开文章内容页面
const openContentPage = (post: PostIndexItem) => {
  try {
    // 自动标记为已读
    if (!post.read) {
      post.read = true;
    }
    
    void router.push({
      name: 'Content',
      query: {
        rssId: post.rssId || 'favorite',
        postId: post.guid,
      },
    });
  } catch (error) {
    console.error('打开文章失败:', error);
    $q.notify({
      type: 'negative',
      message: '打开文章失败',
      position: 'top-right'
    });
  }
};

// 在浏览器中打开
const openInBrowser = async (post: PostIndexItem) => {
  if (post.link) {
    electronClient.openLink(post.link);
    
    // 自动标记为已读并同步到数据库
    if (!post.read) {
      try {
        await electronClient.setReadStatus(post.guid, true);
        post.read = true;
        
        // 刷新 RSS Info Store 以更新侧边栏未读数量
        const rssInfoStore = useRssInfoStore();
        void rssInfoStore.refresh();
      } catch (err) {
        console.error('[FavoritePage] setReadStatus error:', err);
      }
    }
  } else {
    $q.notify({
      type: 'negative',
      message: '文章没有链接可打开',
      position: 'top-right'
    });
  }
};

// 跳转到首页
const goToHome = () => {
  void router.push({ name: 'Home' });
};

// 组件挂载时加载数据
onMounted(() => {
  loadFavoritePosts();
});
</script>


<style scoped lang="scss">
.ink-fav {
  min-height: calc(100vh - var(--ink-header-h));
  background: var(--ink-neutral);
}
.ink-fav__header { margin-bottom: var(--ink-space-lg); }
.ink-fav__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
}
.ink-fav-card {
  background: var(--ink-surface);
  border: 1px solid var(--ink-border);
  border-radius: var(--ink-radius-md);
  padding: 16px 18px;
  cursor: pointer;
  transition: border-color 0.15s ease;
  &:hover { border-color: color-mix(in srgb, var(--ink-tertiary) 45%, var(--ink-border)); }
  &--skel { min-height: 100px; cursor: default; }
  &__top { display: flex; gap: 12px; align-items: flex-start; }
  &__text { flex: 1; min-width: 0; }
  &__title {
    font-family: var(--ink-font-serif);
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--ink-primary);
    line-height: 1.3;
  }
  &__desc {
    margin: 10px 0 0;
    font-size: var(--ink-body-sm);
    color: var(--ink-secondary);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  &__actions {
    margin-top: 12px;
    display: flex;
    gap: 4px;
    align-items: center;
  }
}
</style>
