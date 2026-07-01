<template>
  <q-page class="favorite-page" :class="{ 'dark-mode': $q.dark.isActive }">
    <q-toolbar class="bg-primary text-white">
      <q-toolbar-title class="text-center">我的收藏</q-toolbar-title>
    </q-toolbar>

    <transition name="page-fade" mode="out-in">
      <div class="favorite-container" :key="loading + '-' + favoritePosts.length + '-' + error">
        <!-- 加载状态 -->
        <template v-if="loading">
          <div
            v-for="n in 6"
            :key="'skel-' + n"
            class="skeleton-card"
            :style="{ animationDelay: (n - 1) * 0.08 + 's' }"
          >
            <q-card flat bordered class="favorite-skeleton">
              <q-card-section>
                <q-item>
                  <q-item-section>
                    <q-skeleton type="text" width="70%" class="q-mb-sm" />
                    <q-skeleton type="text" width="40%" />
                  </q-item-section>
                  <q-item-section side>
                    <q-skeleton type="circle" size="32px" />
                  </q-item-section>
                </q-item>
                <q-separator class="q-my-sm" />
                <q-skeleton type="text" width="100%" class="q-mb-xs" />
                <q-skeleton type="text" width="90%" class="q-mb-xs" />
                <q-skeleton type="text" width="60%" />
              </q-card-section>
              <q-card-actions>
                <q-skeleton type="QBtn" />
                <q-space />
                <q-skeleton type="QBtn" />
              </q-card-actions>
            </q-card>
          </div>
        </template>

        <!-- 空状态 -->
        <div v-else-if="favoritePosts.length === 0" class="empty-state">
          <div class="empty-illustration">
            <q-icon name="auto_awesome" size="40px" class="empty-sparkle sparkle-1" />
            <q-icon name="star" size="100px" color="amber-4" class="empty-star" />
            <q-icon name="auto_awesome" size="30px" class="empty-sparkle sparkle-2" />
          </div>
          <h3 class="text-h4 empty-title q-mt-md">暂无收藏</h3>
          <p class="empty-desc">浏览文章时点击 <q-icon name="star_border" size="20px" color="amber" class="q-mx-xs" /> 收藏，收藏的文章会显示在这里</p>
          <q-btn
            color="primary"
            label="浏览文章"
            unelevated
            class="q-mt-md"
            @click="goToHome"
            icon="arrow_forward"
            rounded
          />
        </div>

        <!-- 收藏文章列表 -->
        <div v-else class="favorite-list">
          <transition-group name="card-stagger" tag="div" class="favorite-list-inner">
            <q-card
              v-for="post in favoritePosts"
              :key="post.guid"
              class="favorite-card"
              :class="{
                'favorite-card-focused': focusedGuid === post.guid
              }"
              :tabindex="0"
              role="button"
              :aria-label="'打开文章：' + (post.title || '无标题')"
              @click="openContentPage(post)"
              @keydown.enter="openContentPage(post)"
              @keydown.space.prevent="openContentPage(post)"
              @focus="focusedGuid = post.guid"
              @blur="focusedGuid = null"
            >
              <q-card-section>
                <div class="favorite-card-header">
                  <q-item-section>
                    <q-item-label lines="2" class="favorite-card-title">
                      {{ post.title }}
                    </q-item-label>
                    <q-item-label lines="1" class="favorite-card-meta">
                      <q-icon name="person" size="14px" class="q-mr-xs" />
                      {{ post.author }} · {{ formatRelativeTime(post.updateTime) }}
                    </q-item-label>
                  </q-item-section>
                  <q-btn
                    icon="star"
                    color="amber"
                    size="sm"
                    round
                    flat
                    class="favorite-icon"
                    @click.stop="unfavoritePost(post)"
                    :aria-label="'取消收藏：' + (post.title || '无标题')"
                  >
                    <q-tooltip anchor="center left" self="center right">取消收藏</q-tooltip>
                  </q-btn>
                </div>

                <q-separator class="q-my-sm" />

                <q-item-label lines="3" class="favorite-card-desc">
                  {{ extractTextFromHtml(post.desc) }}
                </q-item-label>
              </q-card-section>

              <q-card-actions class="favorite-card-actions">
                <q-btn
                  flat
                  label="阅读全文"
                  color="primary"
                  icon="menu_book"
                  :tabindex="0"
                />
                <q-space />
                <q-btn
                  flat
                  icon="open_in_new"
                  color="grey-6"
                  :tabindex="0"
                  @click.stop="openInBrowser(post)"
                >
                  <q-tooltip>在浏览器中打开</q-tooltip>
                </q-btn>
              </q-card-actions>
            </q-card>
          </transition-group>
        </div>

        <!-- 错误状态 -->
        <div v-if="error" class="error-state">
          <q-icon name="wifi_off" size="72px" color="negative" />
          <h3 class="text-h4 error-title q-mt-md">加载失败</h3>
          <p class="error-desc">{{ error }}</p>
          <q-btn
            color="primary"
            label="重试"
            unelevated
            class="q-mt-md"
            @click="loadFavoritePosts"
            icon="refresh"
            rounded
          />
        </div>
      </div>
    </transition>
  </q-page>
</template>

<script setup lang="ts">
import {ref, onMounted} from "vue";
import {useQuasar} from "quasar";
import {switchPage, extractTextFromHtml, formatRelativeTime} from "src/common/util";
import {useFavoriteStore} from "src/stores/favoriteStore";
import type {PostIndexItem} from "src/common/models";

const $q = useQuasar();
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
    
    switchPage('Content', {
      RssId: post.rssId,
      PostId: post.guid
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
const openInBrowser = (post: PostIndexItem) => {
  if (post.link) {
    electronClient.openLink(post.link);
    
    // 自动标记为已读
    if (!post.read) {
      post.read = true;
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
  switchPage('Home');
};

// 组件挂载时加载数据
onMounted(() => {
  loadFavoritePosts();
});
</script>

<style scoped lang="scss">
.favorite-page {
  height: 100%;
  background-color: rgba(0, 0, 0, 0.02);

  &.dark-mode {
    background-color: rgba(255, 255, 255, 0.03);
  }
}

.favorite-container {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 400px;
}

/* ---- 骨架屏 ---- */
.skeleton-card {
  margin-bottom: 16px;
  animation: skeletonPulse 0.8s ease-in-out infinite alternate;

  .favorite-skeleton {
    border-radius: 10px;
  }

  @for $i from 1 through 6 {
    &:nth-child(#{$i}) {
      animation-delay: #{$i * 0.08}s;
    }
  }
}

@keyframes skeletonPulse {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 0.9;
  }
}

/* ---- 空状态 ---- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 450px;
  padding: 32px;
  text-align: center;
  color: #777;

  .dark-mode & {
    color: #aaa;
  }
}

.empty-illustration {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.empty-star {
  animation: starFloat 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 12px rgba(255, 193, 7, 0.35));
}

.empty-sparkle {
  position: absolute;
  color: #ffc107;

  &.sparkle-1 {
    top: -10px;
    right: -35px;
    font-size: 28px !important;
    animation: sparkleSpin 3s ease-in-out infinite;
  }

  &.sparkle-2 {
    bottom: -10px;
    left: -35px;
    font-size: 22px !important;
    animation: sparkleSpin 3s ease-in-out 0.5s infinite;
  }
}

@keyframes starFloat {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-12px) scale(1.05);
  }
}

@keyframes sparkleSpin {
  0%, 100% {
    opacity: 0.3;
    transform: rotate(0deg) scale(0.8);
  }
  50% {
    opacity: 1;
    transform: rotate(180deg) scale(1);
  }
}

.empty-title {
  font-weight: 500;
}

.empty-desc {
  font-size: 15px;
  line-height: 1.6;
  max-width: 340px;
}

/* ---- 收藏列表 ---- */
.favorite-list {
  padding: 8px 0;
}

.favorite-list-inner {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.favorite-card {
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, box-shadow;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  &:focus-visible,
  &.favorite-card-focused {
    outline: none;
    box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.5);
    transform: translateY(-2px);
  }

  .dark-mode & {
    &:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    &:focus-visible,
    &.favorite-card-focused {
      box-shadow: 0 0 0 3px rgba(100, 181, 246, 0.6);
    }
  }
}

.favorite-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.favorite-card-title {
  font-weight: 600;
  font-size: 16px;
  transition: color 0.2s ease;
  line-height: 1.4;

  &:hover {
    color: #1976d2;

    .dark-mode & {
      color: #90caf9;
    }
  }

  .dark-mode & {
    color: #e0e0e0;
  }
}

.favorite-card-meta {
  color: #888;
  font-size: 13px;
  margin-top: 4px;
  display: flex;
  align-items: center;

  .dark-mode & {
    color: #999;
  }
}

.favorite-card-desc {
  color: #666;
  line-height: 1.7;
  font-size: 14px;

  .dark-mode & {
    color: #aaa;
  }
}

.favorite-icon {
  opacity: 0.75;
  transition: all 0.2s ease;

  &:hover {
    opacity: 1;
    transform: scale(1.15);
  }
}

.favorite-card-actions {
  padding-top: 0;
}

/* ---- 错误状态 ---- */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 32px;
  text-align: center;
  color: #777;

  .dark-mode & {
    color: #aaa;
  }
}

.error-title {
  font-weight: 500;
}

.error-desc {
  font-size: 15px;
  max-width: 360px;
  line-height: 1.6;
}

/* ---- 页面过渡动画 ---- */
.page-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-fade-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 1, 1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-fade-leave-to {
  opacity: 0;
}

/* ---- 卡片入场队列动画 ---- */
.card-stagger-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-stagger-leave-active {
  transition: all 0.25s ease-in;
  position: absolute;
}

.card-stagger-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.card-stagger-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
}

.card-stagger-move {
  transition: transform 0.35s ease;
}

/* ---- 响应式设计 ---- */
@media (max-width: 1024px) {
  .favorite-list-inner {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }
}

@media (max-width: 768px) {
  .favorite-container {
    padding: 12px;
  }

  .favorite-list-inner {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .favorite-card-title {
    font-size: 15px;
  }

  .empty-state,
  .error-state {
    min-height: 350px;
    padding: 24px;
  }

  .empty-desc {
    font-size: 14px;
  }
}

/* 超小屏 */
@media (max-width: 400px) {
  .favorite-container {
    padding: 8px;
  }

  .favorite-list-inner {
    gap: 8px;
  }
}
</style>