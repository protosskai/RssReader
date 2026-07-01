<template>
  <q-page class="column items-start" style="width: 100%; min-height: 100dvh; padding: 16px;">
    <!-- ========== 加载状态 - 骨架屏 ========== -->
    <transition name="fade-switch" mode="out-in">
      <div v-if="loading" key="loading" class="full-width">
        <div v-for="n in 5" :key="'skel'+n" class="post-skeleton">
          <q-card flat bordered>
            <q-card-section>
              <q-skeleton type="text" width="70%" class="text-h6"/>
              <q-skeleton type="text" width="40%" class="q-mt-sm"/>
            </q-card-section>
            <q-separator/>
            <q-card-section>
              <q-skeleton type="text" width="100%"/>
              <q-skeleton type="text" width="100%" class="q-mt-sm"/>
              <q-skeleton type="text" width="60%" class="q-mt-sm"/>
            </q-card-section>
            <q-card-section>
              <q-skeleton type="rect" width="80px" height="36px" class="rounded-borders"/>
            </q-card-section>
          </q-card>
        </div>
        <div class="text-caption text-center q-mt-md"
          :class="$q.dark.isActive ? 'text-grey-5' : 'text-grey-6'">
          正在加载文章...
        </div>
      </div>

      <!-- ========== 错误状态 ========== -->
      <div v-else-if="error" key="error" class="full-width row justify-center">
        <q-card class="error-card" style="max-width: 480px; width: 100%;">
          <q-card-section>
            <div class="text-h6 text-negative q-mb-md">
              <q-icon name="error" size="24px" class="q-mr-sm"/>
              加载失败
            </div>
            <p class="text-body2">{{ error }}</p>
            <div class="q-mt-md">
              <q-btn label="重试" color="primary" @click="retryLoad" class="q-mr-sm" icon="refresh"/>
              <q-btn label="返回" color="grey-7" flat @click="goBack" icon="home"/>
            </div>
            <div class="q-mt-md" :class="'text-caption ' + ($q.dark.isActive ? 'text-grey-5' : 'text-grey-6')">
              <p>💡 如果问题持续，请尝试：</p>
              <ul class="q-pl-md q-my-sm">
                <li>检查网络连接</li>
                <li>稍后重试（RSS源可能暂时不可用）</li>
                <li>在开发者工具中查看详细错误信息</li>
              </ul>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- ========== 空状态 ========== -->
      <div v-else-if="PostInfoList.length === 0" key="empty" class="full-width column items-center" style="padding: 40px;">
        <q-icon name="rss_feed" size="80px" :color="$q.dark.isActive ? 'grey-6' : 'grey-4'"/>
        <p class="text-subtitle1 q-mt-md" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-6'">
          此订阅源暂无文章
        </p>
        <p class="text-caption q-mt-sm" :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-5'">
          可能原因：初次订阅、同步失败或该源暂时无更新
        </p>
        <div class="q-mt-md q-gutter-sm">
          <q-btn label="刷新订阅" color="primary" @click="retryLoad" icon="refresh"/>
          <q-btn label="返回首页" color="grey-7" flat @click="goBack" icon="home"/>
        </div>
      </div>

      <!-- ========== 文章列表主区域 ========== -->
      <div v-else key="content" class="column" style="flex: 1; min-height: 0; width: 100%;">
        <!-- 搜索和操作栏 -->
        <div class="toolbar-row q-mb-md">
          <q-input
            v-model="searchQuery"
            outlined
            dense
            placeholder="搜索文章标题、作者... (按 / 聚焦)"
            class="search-input"
            clearable
            ref="searchInputRef"
          >
            <template #prepend>
              <q-icon name="search"/>
            </template>
            <template #append>
              <q-icon v-if="searchQuery" name="clear" class="cursor-pointer" @click="searchQuery = ''"/>
            </template>
          </q-input>

          <!-- 全部已读 / 全部未读 按钮 -->
          <q-btn
            :label="isFeedRead ? '全部未读' : '全部已读'"
            :color="isFeedRead ? 'warning' : 'primary'"
            flat
            :disable="!hasPosts"
            @click="toggleMarkAllRead"
            size="sm"
            :icon="isFeedRead ? 'undo' : 'done_all'"
          >
            <q-tooltip>
              {{ isFeedRead ? '将所有文章标为未读' : `将所有文章标为已读 (${unreadCount} 篇未读)` }}
            </q-tooltip>
          </q-btn>

          <q-btn
            icon="refresh"
            color="primary"
            flat
            :loading="loading"
            @click="retryLoad"
            size="sm"
          >
            <q-tooltip>刷新 (r)</q-tooltip>
          </q-btn>
        </div>

        <!-- 搜索无结果 -->
        <transition name="fade-switch">
          <div v-if="filteredPosts.length === 0 && searchQuery" key="no-results"
               class="full-width column items-center" style="flex: 1; padding: 40px;">
            <q-icon name="search_off" size="64px" :color="$q.dark.isActive ? 'grey-7' : 'grey-4'"/>
            <p class="text-subtitle1 q-mt-md" :class="$q.dark.isActive ? 'text-grey-5' : 'text-grey-6'">
              未找到匹配的文章
            </p>
            <p class="text-caption" :class="$q.dark.isActive ? 'text-grey-6' : 'text-grey-5'">
              尝试其他关键词
            </p>
          </div>
        </transition>

        <!-- 虚拟滚动文章列表 -->
        <template v-if="filteredPosts.length > 0">
          <div
            ref="virtualScrollContainerRef"
            class="virtual-scroll-wrapper"
            :class="$q.dark.isActive ? 'dark' : ''"
          >
            <q-virtual-scroll
              ref="virtualScrollRef"
              :items="filteredPosts"
              :virtual-scroll-item-size="144"
              :virtual-scroll-slice-size="20"
              :virtual-scroll-slice-ratio-before="0.5"
              :virtual-scroll-slice-ratio-after="0.5"
              style="height: 100%; width: 100%;"
              @virtual-scroll="onVirtualScroll"
            >
              <template #default="{ item, index }">
                <div
                  :key="item.guid"
                  :class="[
                    'virtual-scroll-item',
                    { 'selected-post': selectedIndex === index }
                  ]"
                >
                  <post-list-item
                    :post-info="item"
                    :rss-id="rssId"
                    @read-toggled="onReadToggled"
                  />
                </div>
              </template>
            </q-virtual-scroll>
          </div>

          <!-- 文章计数 -->
          <transition name="fade">
            <div v-if="filteredPosts.length > 0" class="post-count text-caption q-mt-sm"
              :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-6'">
              {{ filteredPosts.length }} / {{ PostInfoList.length }} 篇文章
              <span v-if="unreadCount > 0" class="text-primary"> · {{ unreadCount }} 未读</span>
            </div>
          </transition>
        </template>
      </div>
    </transition>

    <!-- 滚动到顶部按钮 -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <transition name="scale-fade">
        <q-btn
          v-if="showScrollToTop"
          fab
          icon="keyboard_arrow_up"
          color="primary"
          @click="scrollToTop"
          aria-label="滚动到顶部"
        />
      </transition>
    </q-page-sticky>
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { computed, onMounted, onUnmounted, Ref, ref, watch, nextTick } from "vue";
import PostListItem from "src/components/PostListItem.vue";
import { useQuasar } from "quasar";
import { PostIndexItem } from "src/common/models";
import { switchPage } from "src/common/util";

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const rssId = String(route.params.RssId);

const goBack = () => {
  router.push('/');
};

const PostInfoList: Ref<PostIndexItem[]> = ref([]);
const loading = ref(false);
const error = ref<string | null>(null);
const showScrollToTop = ref(false);

// Virtual scroll
const virtualScrollRef = ref<{ scrollTo: (index: number) => void; reset: () => void; refresh: () => void } | null>(null);
const virtualScrollContainerRef = ref<HTMLElement | null>(null);
const currentVirtIndex = ref(0);

// Search
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const selectedIndex = ref(-1);

// ---- Computed ----
const filteredPosts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return PostInfoList.value;
  return PostInfoList.value.filter(post =>
    post.title.toLowerCase().includes(q) ||
    (post.author && post.author.toLowerCase().includes(q)) ||
    (post.desc && post.desc.toLowerCase().includes(q))
  );
});

const unreadCount = computed(() => PostInfoList.value.filter(p => !p.read).length);
const hasPosts = computed(() => PostInfoList.value.length > 0);
const isFeedRead = computed(() => PostInfoList.value.length > 0 && PostInfoList.value.every(p => p.read));

// ---- Watchers ----
// Reset scroll position and selection when search changes
watch(searchQuery, () => {
  selectedIndex.value = -1;
  if (virtualScrollRef.value) {
    virtualScrollRef.value.scrollTo(0);
  }
});

// ---- Event Handlers ----
const onReadToggled = () => {
  // Force reactivity update by creating a new array reference
  PostInfoList.value = [...PostInfoList.value];
};

const toggleMarkAllRead = async () => {
  const isAllRead = isFeedRead.value;

  if (isAllRead) {
    // All are already read → confirm before marking as unread
    const ok = await new Promise<boolean>((resolve) => {
      $q.dialog({
        title: '全部标记为未读',
        message: `确定要将 ${PostInfoList.value.length} 篇文章全部标记为未读吗？`,
        cancel: { label: '取消', flat: true, color: 'grey-7' },
        ok: { label: '确认', color: 'warning', unelevated: true },
        persistent: true,
      }).onOk(() => resolve(true)).onCancel(() => resolve(false)).onDismiss(() => resolve(false));
    });
    if (!ok) return;

    // Show loading indicator for potentially slow bulk operation
    $q.loading.show({ message: '正在标记为未读...', boxClass: 'bg-grey-2 text-grey-9', spinnerColor: 'warning' });
    try {
      // Mark all as unread: iterate individually (no bulk unread API available)
      for (const p of PostInfoList.value) {
        if (p.read) {
          await electronClient.toggleReadStatus(p.guid);
        }
      }
      PostInfoList.value.forEach(p => { p.read = false; });
      PostInfoList.value = [...PostInfoList.value];
      $q.loading.hide();
      $q.notify({
        message: '已全部标记为未读',
        color: 'warning',
        position: 'top',
        timeout: 1500,
        icon: 'undo'
      });
    } catch (err) {
      $q.loading.hide();
      console.error('[PostList] markAllUnread error:', err);
      $q.notify({ message: '操作失败', color: 'negative', position: 'top' });
    }
  } else {
    // Mark as read
    if (unreadCount.value === 0) {
      $q.notify({ message: '没有未读文章', color: 'info', position: 'top', timeout: 1500 });
      return;
    }

    const ok = await new Promise<boolean>((resolve) => {
      $q.dialog({
        title: '全部标记为已读',
        message: `确定要将 ${unreadCount.value} 篇未读文章全部标记为已读吗？`,
        cancel: { label: '取消', flat: true, color: 'grey-7' },
        ok: { label: '确认', color: 'primary', unelevated: true },
        persistent: true,
      }).onOk(() => resolve(true)).onCancel(() => resolve(false)).onDismiss(() => resolve(false));
    });
    if (!ok) return;

    $q.loading.show({ message: '正在标记为已读...', boxClass: 'bg-grey-2 text-grey-9', spinnerColor: 'primary' });
    try {
      await electronClient.markAllAsRead({ feedId: rssId });
      PostInfoList.value.forEach(p => { p.read = true; });
      PostInfoList.value = [...PostInfoList.value];
      $q.loading.hide();
      $q.notify({
        message: '已全部标记为已读',
        color: 'positive',
        position: 'top',
        timeout: 1500,
        icon: 'done_all'
      });
    } catch (err) {
      $q.loading.hide();
      console.error('[PostList] markAllRead error:', err);
      $q.notify({ message: '操作失败', color: 'negative', position: 'top' });
    }
  }
};

// Virtual scroll event: track current index for scroll-to-top
const onVirtualScroll = (details: { index: number }) => {
  currentVirtIndex.value = details.index;
  showScrollToTop.value = details.index > 8;
};

// ---- Keyboard Shortcuts ----
const handleKeydown = (e: KeyboardEvent) => {
  // Ignore when typing in inputs (except / to focus search)
  const tag = (e.target as HTMLElement)?.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.key === '/' && !isInput) {
    e.preventDefault();
    searchInputRef.value?.focus();
    return;
  }

  if (isInput) return;

  if (e.key === 'j' || e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredPosts.value.length > 0) {
      selectedIndex.value = Math.min(selectedIndex.value + 1, filteredPosts.value.length - 1);
      scrollToSelectedInVirt();
    }
  } else if (e.key === 'k' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (filteredPosts.value.length > 0) {
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
      scrollToSelectedInVirt();
    }
  } else if (e.key === 'Enter' && selectedIndex.value >= 0) {
    e.preventDefault();
    const post = filteredPosts.value[selectedIndex.value];
    if (post) {
      switchPage('Content', { RssId: rssId, PostId: post.guid });
    }
  } else if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    retryLoad();
  } else if (e.key === 'Home') {
    e.preventDefault();
    selectedIndex.value = 0;
    scrollToSelectedInVirt();
  } else if (e.key === 'End') {
    e.preventDefault();
    selectedIndex.value = filteredPosts.value.length - 1;
    scrollToSelectedInVirt();
  }
};

const scrollToSelectedInVirt = () => {
  if (virtualScrollRef.value && selectedIndex.value >= 0) {
    virtualScrollRef.value.scrollTo(selectedIndex.value);
  }
};

// ---- Data Loading ----
const getPostListById = async (rssItemId: string): Promise<PostIndexItem[]> => {
  console.log('[PostList.vue] getPostListById called with rssItemId:', rssItemId);
  loading.value = true;
  error.value = null;
  showScrollToTop.value = false;
  currentVirtIndex.value = 0;

  try {
    console.log('[PostList.vue] Step 1: Syncing RSS feed (fetchRssIndexList)...');

    const syncTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('同步RSS源超时，请检查网络连接或RSS源是否可用')), 60000);
    });

    const syncPromise = electronClient.fetchRssIndexList(rssItemId);
    await Promise.race([syncPromise, syncTimeout]);

    console.log('[PostList.vue] Step 2: Querying article list (queryPostIndexByRssId)...');

    const queryTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('查询文章列表超时')), 30000);
    });

    const queryPromise = electronClient.queryPostIndexByRssId(rssItemId);
    const result = await Promise.race([queryPromise, queryTimeout]);

    console.log('[PostList.vue] Articles count:', result.length);

    return result;
  } catch (err: unknown) {
    console.error('[PostList.vue] Error loading post list:', err);
    const errorMessage = err instanceof Error ? err.message : '加载文章列表失败，请稍后重试';
    error.value = errorMessage;
    return [];
  } finally {
    loading.value = false;
  }
};

const retryLoad = async () => {
  PostInfoList.value = await getPostListById(rssId);
};

const scrollToTop = () => {
  if (virtualScrollRef.value) {
    virtualScrollRef.value.scrollTo(0);
  }
  showScrollToTop.value = false;
};

// ---- Lifecycle ----
onMounted(async () => {
  PostInfoList.value = await getPostListById(rssId);

  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped lang="scss">
/* ==========================================
   Loading skeleton
   ========================================== */
.post-skeleton {
  width: 100%;
  margin-bottom: 12px;
  animation: pulse 1.5s ease-in-out infinite;
  border-radius: 6px;
  overflow: hidden;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* ==========================================
   Virtual scroll container
   ========================================== */
.virtual-scroll-wrapper {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  background: transparent;

  &.dark {
    // Dark mode subtle background for the scroll area
    :deep(.q-virtual-scroll) {
      scrollbar-color: #555 transparent;
    }
  }

  :deep(.q-virtual-scroll) {
    // Custom scrollbar
    &::-webkit-scrollbar {
      width: 8px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(128, 128, 128, 0.3);
      border-radius: 4px;
      &:hover {
        background: rgba(128, 128, 128, 0.5);
      }
    }
  }

  :deep(.q-virtual-scroll__padding) {
    // Ensure padding areas don't show visible borders
    pointer-events: none;
  }
}

.virtual-scroll-item {
  padding: 2px 0;

  &.selected-post {
    > :deep(.post-item) .q-card {
      border: 2px solid var(--q-primary);
      box-shadow: 0 0 0 1px var(--q-primary);
      border-radius: 8px;
    }
  }
}

/* ==========================================
   Toolbar
   ========================================== */
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  .search-input {
    flex: 1;
    max-width: 480px;
  }
}

/* ==========================================
   Post count footer
   ========================================== */
.post-count {
  text-align: center;
  flex-shrink: 0;
}

/* ==========================================
   Transitions
   ========================================== */
.fade-switch-enter-active,
.fade-switch-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-switch-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.fade-switch-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-fade-enter-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.scale-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.scale-fade-enter-from {
  opacity: 0;
  transform: scale(0.6);
}
.scale-fade-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

/* ==========================================
   Responsive
   ========================================== */
@media (max-width: 600px) {
  .toolbar-row {
    flex-direction: column;
    align-items: stretch;

    .search-input {
      max-width: 100%;
    }
  }

  .virtual-scroll-wrapper {
    :deep(.q-virtual-scroll) {
      &::-webkit-scrollbar {
        width: 4px;
      }
    }
  }
}

@media (min-width: 1200px) {
  .toolbar-row .search-input {
    max-width: 560px;
  }
}
</style>
