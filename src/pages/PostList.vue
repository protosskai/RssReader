<template>
  <q-page class="ink-postlist">
    <div class="ink-stage ink-postlist__inner">
      <transition name="ink-fade" mode="out-in">
        <div v-if="loading" key="loading" class="ink-postlist__skel">
          <div v-for="n in 6" :key="'s'+n" class="ink-skel-row">
            <q-skeleton type="text" width="70%" />
            <q-skeleton type="text" width="40%" class="q-mt-sm" />
            <q-skeleton type="text" width="90%" class="q-mt-sm" />
          </div>
          <p class="ink-meta text-center q-mt-md">Loading articles…</p>
        </div>

        <div v-else-if="error" key="error" class="ink-empty">
          <q-icon name="error_outline" size="48px" class="ink-empty__icon" color="negative" />
          <h2 class="ink-empty__title">Couldn’t load feed</h2>
          <p class="ink-empty__desc">{{ error }}</p>
          <div class="row q-gutter-sm justify-center">
            <q-btn class="ink-btn-primary" unelevated no-caps icon="refresh" label="Retry" @click="retryLoad" />
            <q-btn flat no-caps icon="home" label="Home" @click="goBack" />
          </div>
        </div>

        <div v-else-if="PostInfoList.length === 0" key="empty" class="ink-empty">
          <q-icon name="rss_feed" size="48px" class="ink-empty__icon" />
          <h2 class="ink-empty__title">No articles yet</h2>
          <p class="ink-empty__desc">This feed has no cached posts. Try refreshing, or check the source later.</p>
          <div class="row q-gutter-sm justify-center">
            <q-btn class="ink-btn-primary" unelevated no-caps icon="refresh" label="Refresh" @click="retryLoad" />
            <q-btn flat no-caps icon="home" label="Home" @click="goBack" />
          </div>
        </div>

        <div v-else key="content" class="ink-postlist__content">
          <div class="ink-postlist__toolbar">
            <q-input
              v-model="searchQuery"
              outlined dense clearable
              placeholder="Filter titles… (/)"
              class="ink-postlist__search"
              ref="searchInputRef"
            >
              <template #prepend><q-icon name="search" size="18px" /></template>
            </q-input>
            <q-btn
              dense no-caps outline
              class="ink-outline-btn"
              :label="isFeedRead ? 'Mark all unread' : 'Mark all read'"
              :disable="!hasPosts"
              @click="toggleMarkAllRead"
            />
            <q-btn dense flat round icon="refresh" :loading="loading" @click="retryLoad" aria-label="Refresh" />
          </div>

          <div v-if="filteredPosts.length === 0 && searchQuery" class="ink-empty" style="padding: 48px 16px">
            <q-icon name="search_off" size="40px" class="ink-empty__icon" />
            <h2 class="ink-empty__title">No matches</h2>
            <p class="ink-empty__desc">Try another keyword.</p>
          </div>

          <template v-if="filteredPosts.length > 0">
            <div ref="virtualScrollContainerRef" class="ink-postlist__scroll">
              <q-virtual-scroll
                ref="virtualScrollRef"
                :items="filteredPosts"
                :virtual-scroll-item-size="64"
                :virtual-scroll-slice-size="24"
                style="height: 100%; width: 100%;"
                @virtual-scroll="onVirtualScroll"
              >
                <template #default="{ item, index }">
                  <div
                    :key="item.guid"
                    class="ink-postlist__item"
                    :class="{ 'ink-postlist__item--selected': selectedIndex === index }"
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
            <p class="ink-meta ink-postlist__count">
              {{ filteredPosts.length }} / {{ PostInfoList.length }} articles
              <span v-if="unreadCount > 0"> · {{ unreadCount }} unread</span>
            </p>
          </template>
        </div>
      </transition>
    </div>

    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <q-btn v-if="showScrollToTop" fab icon="keyboard_arrow_up" class="ink-btn-primary" @click="scrollToTop" aria-label="Scroll to top" />
    </q-page-sticky>
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { electronClient } from "src/services/electronClient";
import { computed, onMounted, onUnmounted, Ref, ref, watch, nextTick } from "vue";
import PostListItem from "src/components/PostListItem.vue";
import { useQuasar } from "quasar";
import { PostIndexItem } from "src/common/models";
import { unwrapOrThrow } from "src/common/ErrorMsg";

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
      // Mark all as unread: idempotent setReadStatus (never toggle — avoids flip races)
      for (const p of PostInfoList.value) {
        if (p.read) {
          await electronClient.setReadStatus(p.guid, false);
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
      void router.push({
        name: 'Content',
        query: { rssId, postId: post.guid },
      });
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
/**
 * Load posts from local DB first (instant), then refresh feed in background.
 * Legacy IPC methods return ApiResponse — must unwrap before use.
 */
const getPostListById = async (
  rssItemId: string,
  options: { forceSync?: boolean } = {},
): Promise<PostIndexItem[]> => {
  console.log('[PostList.vue] getPostListById called with rssItemId:', rssItemId);
  loading.value = true;
  error.value = null;
  showScrollToTop.value = false;
  currentVirtIndex.value = 0;

  try {
    // 1) Always read local cache first for a responsive UI
    const cachedRaw = await electronClient.queryPostIndexByRssId(rssItemId);
    const cached = unwrapOrThrow(cachedRaw);
    console.log('[PostList.vue] Cached articles:', cached.length);

    // Show cache immediately if we have data and are not force-syncing for empty feed
    if (cached.length > 0 && !options.forceSync) {
      loading.value = false;
      // Background silent sync — then refresh list
      void (async () => {
        try {
          await Promise.race([
            electronClient.fetchRssIndexList(rssItemId),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('sync timeout')), 60000),
            ),
          ]);
          const freshRaw = await electronClient.queryPostIndexByRssId(rssItemId);
          const fresh = unwrapOrThrow(freshRaw);
          PostInfoList.value = fresh;
          console.log('[PostList.vue] Background sync updated list:', fresh.length);
        } catch (syncErr) {
          console.warn('[PostList.vue] Background sync failed (cache kept):', syncErr);
        }
      })();
      return cached;
    }

    // 2) Empty cache or force refresh — sync then query
    console.log('[PostList.vue] Syncing RSS feed then querying…');
    await Promise.race([
      electronClient.fetchRssIndexList(rssItemId),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('同步RSS源超时，请检查网络连接或RSS源是否可用')),
          60000,
        ),
      ),
    ]);

    const freshRaw = await electronClient.queryPostIndexByRssId(rssItemId);
    const result = unwrapOrThrow(freshRaw);
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
  PostInfoList.value = await getPostListById(rssId, { forceSync: true });
};

const scrollToTop = () => {
  if (virtualScrollRef.value) {
    virtualScrollRef.value.scrollTo(0);
  }
  showScrollToTop.value = false;
};

// ---- Lifecycle ----
onMounted(async () => {
  document.addEventListener('keydown', handleKeydown);
  PostInfoList.value = await getPostListById(String(route.params.RssId || rssId));
});

// Re-load when navigating between feeds (same component instance possible)
watch(
  () => String(route.params.RssId || ''),
  async (id, prev) => {
    if (id && id !== prev) {
      PostInfoList.value = await getPostListById(id);
    }
  },
);

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>


<style scoped lang="scss">
.ink-postlist {
  min-height: calc(100vh - var(--ink-header-h));
  background: var(--ink-neutral);
}
.ink-postlist__inner {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--ink-header-h) - 32px);
  max-width: 820px;
}
.ink-postlist__skel { width: 100%; }
.ink-skel-row {
  padding: 16px 0;
  border-bottom: 1px solid var(--ink-border);
}
.ink-postlist__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}
.ink-postlist__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 8px 0;
  background: var(--ink-neutral);
  border-bottom: 1px solid var(--ink-border);
}
.ink-postlist__search {
  flex: 1;
  min-width: 180px;
  :deep(.q-field__control) {
    background: var(--ink-surface);
    border-radius: var(--ink-radius-sm);
  }
}
.ink-outline-btn {
  border-color: var(--ink-border) !important;
  color: var(--ink-primary) !important;
  background: var(--ink-surface) !important;
}
.ink-postlist__scroll {
  flex: 1;
  min-height: 420px;
  height: calc(100vh - 220px);
  background: var(--ink-surface);
  border-radius: var(--ink-radius-sm);
  overflow: hidden;
  padding: 0;
}
.ink-postlist__item--selected {
  /* Selection styling is now fully delegated to PostListItem.vue */
}
.ink-postlist__count {
  margin-top: 10px;
  text-align: right;
}
.ink-fade-enter-active { transition: opacity 0.15s ease; }
.ink-fade-enter-from { opacity: 0; }
.ink-fade-leave-active { transition: none; display: none; }
</style>
