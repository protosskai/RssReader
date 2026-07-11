<template>
  <q-page class="ink-reader">
    <ReadingProgressBar
      :article-id="postId"
      :show-estimated-time="true"
      :show-progress-bar="true"
    />

    <div class="ink-reader__toolbar">
      <q-btn flat round dense icon="arrow_back" aria-label="Back" @click="goBack">
        <q-tooltip>Back (Backspace)</q-tooltip>
      </q-btn>
      <q-space />
      <q-btn
        flat round dense
        :icon="isFavorite ? 'star' : 'star_border'"
        :color="isFavorite ? 'amber' : undefined"
        :disable="!curContentInfo.title"
        @click="toggleFavoriteHandler"
      >
        <q-tooltip>{{ isFavorite ? 'Unfavorite' : 'Favorite' }}</q-tooltip>
      </q-btn>
      <q-separator vertical class="q-mx-xs" />
      <q-btn flat round dense icon="text_decrease" @click="decreaseFontSize" />
      <span class="ink-reader__fontpct ink-meta">{{ fontSize }}%</span>
      <q-btn flat round dense icon="text_increase" @click="increaseFontSize" />
      <q-separator vertical class="q-mx-xs" />
      <q-btn flat round dense icon="open_in_new" :disable="!curContentInfo.link" @click="openInBrowser">
        <q-tooltip>Open original (F)</q-tooltip>
      </q-btn>
    </div>

    <div class="ink-reader-measure ink-reader__stage">
      <div v-if="loading" key="loading" class="ink-reader__skel">
        <q-skeleton type="text" width="80%" height="32px" />
        <q-skeleton type="text" width="40%" class="q-mt-md" />
        <q-skeleton type="text" width="100%" class="q-mt-lg" />
        <q-skeleton type="text" width="100%" class="q-mt-sm" />
        <q-skeleton type="text" width="90%" class="q-mt-sm" />
        <q-skeleton type="text" width="95%" class="q-mt-sm" />
      </div>

      <div v-else-if="error" key="error" class="ink-empty">
        <q-icon name="mood_bad" size="48px" class="ink-empty__icon" color="negative" />
        <h2 class="ink-empty__title">Couldn’t load article</h2>
        <p class="ink-empty__desc">{{ error }}</p>
        <div class="row q-gutter-sm justify-center">
          <q-btn class="ink-btn-primary" unelevated no-caps icon="refresh" label="Retry" @click="retryLoad" />
          <q-btn flat no-caps icon="arrow_back" label="Back" @click="goBack" />
        </div>
      </div>

      <div v-else-if="!curContentInfo.title && !loading" key="empty" class="ink-empty">
        <q-icon name="auto_stories" size="48px" class="ink-empty__icon" />
        <h2 class="ink-empty__title">No content</h2>
        <p class="ink-empty__desc">This article has no body text.</p>
        <q-btn flat no-caps icon="arrow_back" label="Back" @click="goBack" />
      </div>

      <article v-else key="content" class="ink-reader__article">
        <header class="ink-reader__header">
          <p v-if="curContentInfo.rssSource" class="ink-eyebrow ink-reader__source" @click="openUrl(curContentInfo.rssSource.htmlUrl)">
            {{ curContentInfo.rssSource.name }}
          </p>
          <h1 class="ink-reader__title" @click="openUrl(curContentInfo.link)">
            {{ curContentInfo.title }}
          </h1>
          <p class="ink-reader__meta ink-meta">
            <span v-if="curContentInfo.author">{{ curContentInfo.author }}</span>
            <span v-if="curContentInfo.author && curContentInfo.updateTime"> · </span>
            <span v-if="curContentInfo.updateTime">{{ formatDate(curContentInfo.updateTime) }}</span>
            <span v-if="estimatedTime"> · {{ estimatedTime }} read</span>
          </p>
        </header>

        <div
          class="ink-reader__body"
          :style="contentStyles"
          v-html="sanitizeHtml(curContentInfo.content)"
        />

        <footer class="ink-reader__footer">
          <div class="ink-reader__stats">
            <span v-if="progress > 0" class="ink-chip">{{ Math.round(progress) }}% read</span>
            <span v-if="progress > 0" class="ink-chip ink-chip--muted">{{ formatReadingTime }}</span>
          </div>
          <div class="ink-reader__footer-actions">
            <q-btn flat dense round icon="keyboard_arrow_up" @click="scrollToTop" />
            <q-btn flat dense round icon="keyboard_arrow_down" @click="scrollToBottom" />
            <q-btn flat dense round :icon="isFavorite ? 'star' : 'star_border'" @click="toggleFavoriteHandler" />
            <q-btn flat dense round icon="open_in_new" @click="shareArticle" />
          </div>
        </footer>
        <div class="ink-reader__spacer" />
      </article>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { electronClient } from 'src/services/electronClient';
import type { ContentInfo, PostIndexItem } from 'src/common/models';
import { computed, onMounted, onUnmounted, ref, type Ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { sanitizeHtml } from 'src/utils/sanitize';
import { useFavoriteStore } from 'src/stores/favoriteStore';
import { unwrapOrThrow } from 'src/common/ErrorMsg';
import { useReadingStore } from 'src/stores/readingStore';
import { useReadingExperience, useReadingSettings } from 'src/composables/useReadingExperience';
import ReadingProgressBar from 'src/components/ReadingProgressBar.vue';

const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const favoriteStore = useFavoriteStore();
const readingStore = useReadingStore();
const { settings: readingSettings } = useReadingSettings();

// Prefer query (new), fall back to path params (legacy links)
// Must be computed: guids are URLs and route changes on next/prev article
const rssId = computed(() =>
  String(route.query.rssId || route.params.RssId || ''),
);
const postId = computed(() => {
  const raw = String(route.query.postId || route.params.PostId || '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
});

// ── 加载 & 错误状态 ──
const loading = ref(false);
const error = ref<string | null>(null);

// ── 字体大小控制 ──
const fontSize = ref(100);

const contentStyles = computed(() => ({
  fontSize: `${fontSize.value}%`,
  '--reader-line-height': `${readingSettings.value.lineHeight}`,
  '--reader-font-family': readingSettings.value.fontFamily,
}));

const increaseFontSize = () => {
  if (fontSize.value < 200) {
    fontSize.value += 10;
    localStorage.setItem('contentFontSize', fontSize.value.toString());
  }
};

const decreaseFontSize = () => {
  if (fontSize.value > 60) {
    fontSize.value -= 10;
    localStorage.setItem('contentFontSize', fontSize.value.toString());
  }
};

// ── 收藏状态 ──
const isFavorite = ref(false);

const toggleFavoriteHandler = async () => {
  const id = postId.value;
  if (!id || !curContentInfo.value.title) return;

  try {
    // Single source of truth: article:toggleFavorite on post_info
    const newFavorite = await electronClient.toggleFavorite(id);
    isFavorite.value = !!newFavorite;

    // Best-effort: refresh favorite list store so FavoritePage stays current
    void favoriteStore.loadFavoritePosts().catch(() => undefined);

    $q.notify({
      type: isFavorite.value ? 'positive' : 'info',
      message: isFavorite.value ? '已收藏' : '已取消收藏',
      position: 'top',
      timeout: 1200,
    });
  } catch (err) {
    console.warn('[Content.vue] toggleFavorite error:', err);
    $q.notify({
      type: 'negative',
      message: '收藏操作失败: ' + (err instanceof Error ? err.message : String(err)),
      position: 'top',
    });
  }
};

// Re-load when navigating between articles without unmounting
watch(
  postId,
  async (nextId, prevId) => {
    if (nextId && nextId !== prevId) {
      await getContentById(nextId);
    }
  },
);

// ── 阅读进度追踪 (from ContentReader + useReadingExperience) ──

const {
  startReading,
  stopReading,
} = useReadingExperience(postId.value, ''); // content gets set after load

const progress = computed(() => {
  if (!postId.value) return 0;
  const p = readingStore.getProgress(postId.value);
  return p?.progress || 0;
});

const estimatedTime = computed(() => {
  if (!postId.value || !curContentInfo.value.content) return '';
  const text = curContentInfo.value.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const wordCount = text.length;
  const seconds = readingStore.estimateReadingTime(wordCount);
  return readingStore.formatReadingTime(seconds);
});

const formatReadingTime = computed(() => {
  return readingStore.formatReadingTime(readingStore.currentReadingTime);
});

const getScrollRoot = (): HTMLElement | Window => {
  if (typeof document === 'undefined') return window;
  const candidates = [
    document.scrollingElement as HTMLElement | null,
    document.querySelector('.q-page-container') as HTMLElement | null,
    document.documentElement,
    document.body,
  ].filter(Boolean) as HTMLElement[];
  for (const el of candidates) {
    if (el.scrollHeight > el.clientHeight + 8) return el;
  }
  return window;
};

const scrollToTop = () => {
  const root = getScrollRoot();
  if (root === window) window.scrollTo({ top: 0, behavior: 'smooth' });
  else (root as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
};

const scrollToBottom = () => {
  const root = getScrollRoot();
  if (root === window) {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  } else {
    const el = root as HTMLElement;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }
};

// ── 文章数据 ──

const curContentInfo: Ref<ContentInfo> = ref({
  title: '',
  content: '',
  author: '',
  updateTime: '',
  link: '',
  rssId: rssId.value || '',
  rssSource: {
    rssId: rssId.value || '',
    url: '',
    name: '',
    folder: '',
    avatar: '',
    htmlUrl: '',
  },
});

const getContentById = async (postIdToFetch: string): Promise<void> => {
  console.log('[Content.vue] getContentById called with postId:', postIdToFetch);

  if (!postIdToFetch || postIdToFetch === 'undefined' || postIdToFetch === 'null') {
    error.value = '无效的文章 ID';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // Legacy API returns ApiResponse<ContentInfo> after secureInvoke unwraps the IPC envelope
    const raw = await electronClient.queryPostContentByGuid(postIdToFetch);
    const result = unwrapOrThrow(raw);
    console.log('[Content.vue] content loaded:', result?.title);

    if (!result || !result.title) {
      error.value = '文章内容不存在';
      return;
    }

    // Normalize rssSource
    if (result.rssSource) {
      const src = result.rssSource;
      result.rssSource = {
        rssId: src.rssId || '',
        url: src.url || '',
        name: src.name || '',
        folder: src.folder || '',
        avatar: src.avatar || '',
        htmlUrl: src.htmlUrl || '',
      };
    }

    // 初始化收藏状态
    if (result.favorite !== undefined) {
      isFavorite.value = result.favorite === 1;
    } else {
      try {
        isFavorite.value = await electronClient.isPostFavorite(postIdToFetch);
      } catch {
        isFavorite.value = false;
      }
    }

    curContentInfo.value = result as ContentInfo;

    // Single source of truth for open→read: idempotent set (never toggle).
    // List click must not also call IPC toggle — concurrent toggles flip unread.
    if (!result.read) {
      void electronClient
        .setReadStatus(postIdToFetch, true)
        .then(() => {
          if (curContentInfo.value) {
            (curContentInfo.value as ContentInfo & { read?: number }).read = 1;
          }
        })
        .catch(() => undefined);
    }
  } catch (err: unknown) {
    console.error('[Content.vue] getContentById error:', err);
    error.value = err instanceof Error ? err.message : '加载文章失败';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  const rssIdStr = rssId.value;
  if (rssIdStr && rssIdStr !== 'search' && rssIdStr !== '' && rssIdStr !== 'undefined') {
    router.push({ name: 'PostList', params: { RssId: rssIdStr } });
  } else {
    router.push({ name: 'Home' });
  }
};

const retryLoad = async () => {
  await getContentById(postId.value);
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const openUrl = (url: string) => {
  if (url && typeof url === 'string' && url.trim()) {
    electronClient.openLink(url);
  }
};

const openInBrowser = () => {
  if (curContentInfo.value?.link) {
    electronClient.openLink(curContentInfo.value.link);
  }
};

const shareArticle = () => {
  const url = curContentInfo.value?.link || window.location.href;
  electronClient.openLink(url);
};

// ── Keyboard shortcuts ──
const handleContentKeydown = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement)?.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (isInput) return;

  if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    goBack();
  } else if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    openInBrowser();
  } else if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    toggleFavoriteHandler();
  } else if (e.key === 'Home') {
    e.preventDefault();
    scrollToTop();
  } else if (e.key === 'End') {
    e.preventDefault();
    scrollToBottom();
  }
};

// ── Watch content for reading progress ──
watch(
  () => curContentInfo.value.content,
  (newContent) => {
    const id = postId.value;
    if (newContent && id && id !== 'undefined') {
      // Restart reading tracking with the actual content
      const text = newContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      readingStore.startReading(id, text.length);
      // 恢复上次阅读位置
      const savedProgress = readingStore.getProgress(id);
      if (savedProgress && savedProgress.scrollPosition > 0) {
        requestAnimationFrame(() => {
          const root = getScrollRoot();
          if (root === window) {
            const max = Math.max(
              document.documentElement.scrollHeight - window.innerHeight,
              0,
            );
            window.scrollTo({ top: savedProgress.scrollPosition * max });
          } else {
            const el = root as HTMLElement;
            const max = Math.max(el.scrollHeight - el.clientHeight, 0);
            el.scrollTo({ top: savedProgress.scrollPosition * max });
          }
        });
      }
    }
  },
);

// ── Lifecycle ──
onMounted(async () => {
  console.log('[Content.vue] onMounted:', { rssId: rssId.value, postId: postId.value });

  // 恢复字体大小
  const saved = localStorage.getItem('contentFontSize');
  if (saved) {
    fontSize.value = parseInt(saved, 10);
  }

  await getContentById(postId.value);

  // 键盘快捷键
  document.addEventListener('keydown', handleContentKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleContentKeydown);
  if (postId.value && postId.value !== 'undefined' && postId.value !== 'null') {
    stopReading();
  }
});
</script>


<style scoped lang="scss">
.ink-reader {
  min-height: calc(100vh - var(--ink-header-h));
  background: var(--ink-surface);
  color: var(--ink-on-surface);
  width: 100%;
}

.ink-reader__toolbar {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: var(--ink-reader-max);
  margin: 0 auto;
  padding: 8px 20px;
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--ink-surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--ink-border);
}

.ink-reader__fontpct {
  min-width: 40px;
  text-align: center;
}

.ink-reader__stage {
  padding: 24px 20px 64px;
}

.ink-reader__header {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--ink-border);
}

.ink-reader__source {
  cursor: pointer;
  margin-bottom: 12px;
  color: var(--ink-tertiary);
  &:hover { text-decoration: underline; }
}

.ink-reader__title {
  font-family: var(--ink-font-serif);
  font-size: clamp(1.6rem, 2.5vw, 2.1rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin: 0 0 12px;
  color: var(--ink-primary);
  cursor: pointer;
  &:hover { color: var(--ink-tertiary); }
}

.ink-reader__meta {
  margin: 0;
}

.ink-reader__body {
  font-family: var(--ink-font-serif);
  font-size: 1.125rem; /* 18px base for optimal reading */
  line-height: var(--ink-reader-lh);
  color: var(--ink-on-surface);
  word-break: break-word;

  :deep(p) { margin: 0 0 1.2em; }
  :deep(h1), :deep(h2), :deep(h3), :deep(h4) {
    font-family: var(--ink-font-serif);
    font-weight: 600;
    letter-spacing: -0.015em;
    line-height: 1.3;
    margin: 1.8em 0 0.8em;
    color: var(--ink-primary);
  }
  :deep(a) {
    color: var(--ink-tertiary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  :deep(img), :deep(video), :deep(iframe) {
    max-width: 100%;
    height: auto;
    border-radius: var(--ink-radius-md);
    display: block;
    margin: 1.5em auto; /* Center images elegantly */
  }
  :deep(figure) {
    margin: 1.5em 0;
  }
  :deep(figcaption) {
    text-align: center;
    font-size: 0.85em;
    color: var(--ink-muted);
    margin-top: 0.5em;
  }
  :deep(blockquote) {
    margin: 1.5em 0;
    padding: 0.5em 0 0.5em 1.2em;
    border-left: 4px solid var(--ink-border);
    color: var(--ink-secondary);
    font-style: italic;
  }
  :deep(pre), :deep(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em;
  }
  :deep(pre) {
    background: var(--ink-neutral);
    border: 1px solid var(--ink-border);
    border-radius: var(--ink-radius-sm);
    padding: 12px 14px;
    overflow-x: auto;
  }
  :deep(ul), :deep(ol) { padding-left: 1.4em; margin: 0 0 1.1em; }
  :deep(li) { margin-bottom: 0.35em; }
}

.ink-reader__footer {
  margin-top: 36px;
  padding-top: 16px;
  border-top: 1px solid var(--ink-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ink-reader__stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ink-chip {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: var(--ink-radius-full);
  background: var(--ink-tertiary);
  color: var(--ink-on-tertiary);
  &--muted {
    background: var(--ink-neutral);
    color: var(--ink-secondary);
    border: 1px solid var(--ink-border);
  }
}

.ink-reader__footer-actions {
  display: flex;
  gap: 2px;
}

.ink-reader__spacer { height: 48px; }

.ink-reader__skel { padding: 24px 0; }
</style>
