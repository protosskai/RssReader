<template>
  <q-page class="content-page">
    <!-- 阅读进度条 (fixed top bar - merged from ContentReader) -->
    <ReadingProgressBar
      :article-id="postId"
      :show-estimated-time="true"
      :show-progress-bar="true"
    />

    <!-- 工具栏 -->
    <div class="toolbar" :class="{ 'dark': $q.dark.isActive }">
      <q-btn icon="arrow_back" flat round @click="goBack">
        <q-tooltip>返回 (Backspace)</q-tooltip>
      </q-btn>

      <q-space />

      <!-- 收藏按钮 -->
      <q-btn
        :icon="isFavorite ? 'bookmark' : 'bookmark_border'"
        :color="isFavorite ? 'warning' : undefined"
        flat
        round
        :disable="!curContentInfo.title"
        :aria-label="isFavorite ? '取消收藏' : '添加收藏'"
        @click="toggleFavoriteHandler"
      >
        <q-tooltip>{{ isFavorite ? '取消收藏' : '添加收藏' }}</q-tooltip>
      </q-btn>
      <q-separator vertical class="q-mx-xs" />

      <!-- 字体控制 -->
      <q-btn icon="text_decrease" flat round @click="decreaseFontSize">
        <q-tooltip>减小字体</q-tooltip>
      </q-btn>
      <span class="q-mx-xs text-caption" :class="{ 'text-grey-4': $q.dark.isActive }">{{ fontSize }}%</span>
      <q-btn icon="text_increase" flat round @click="increaseFontSize">
        <q-tooltip>增大字体</q-tooltip>
      </q-btn>
      <q-separator vertical class="q-mx-xs" />

      <q-btn icon="open_in_new" flat round @click="openInBrowser" :disable="!curContentInfo.link">
        <q-tooltip>在浏览器中打开 (F)</q-tooltip>
      </q-btn>
    </div>

    <!-- 主内容区 with transition -->
    <transition
      enter-active-class="animated fadeIn"
      leave-active-class="animated fadeOut"
      mode="out-in"
      :duration="200"
    >
      <!-- 加载状态 - 骨架屏 -->
      <div v-if="loading" key="loading" class="loading-container">
        <div class="skeleton-wrapper" :class="{ 'dark': $q.dark.isActive }">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line skeleton-meta"></div>
          <div class="skeleton-divider"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" key="error" class="state-wrapper">
        <q-card class="error-card" :class="{ 'dark-card': $q.dark.isActive }">
          <q-card-section class="text-center">
            <q-icon
              name="mood_bad"
              size="64px"
              :color="$q.dark.isActive ? 'orange-4' : 'negative'"
              class="q-mb-md"
            />
            <div class="text-h6" :class="$q.dark.isActive ? 'text-orange-4' : 'text-negative'">
              加载失败
            </div>
            <p class="text-body2 q-mt-sm" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-7'">
              {{ error }}
            </p>
            <div class="q-mt-lg q-gutter-sm">
              <q-btn label="重试" color="primary" icon="refresh" @click="retryLoad" />
              <q-btn
                label="返回列表"
                :color="$q.dark.isActive ? 'grey-4' : 'grey-7'"
                flat
                @click="goBack"
                icon="arrow_back"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- 空内容状态 -->
      <div v-else-if="!curContentInfo.title && !loading" key="empty" class="state-wrapper">
        <q-card class="error-card" :class="{ 'dark-card': $q.dark.isActive }">
          <q-card-section class="text-center">
            <q-icon name="auto_stories" size="64px" color="grey-5" class="q-mb-md" />
            <div class="text-h6 text-grey-6">暂无内容</div>
            <p class="text-body2 text-grey-5 q-mt-sm">无法获取文章内容</p>
            <q-btn label="返回列表" color="primary" flat @click="goBack" icon="arrow_back" class="q-mt-md" />
          </q-card-section>
        </q-card>
      </div>

      <!-- 文章内容 -->
      <div v-else key="content" class="content-wrapper">
        <!-- 文章头部信息 -->
        <q-item class="article-header" :class="{ 'dark': $q.dark.isActive }">
          <q-item-section>
            <!-- RSS 来源 -->
            <q-item-label
              v-if="curContentInfo.rssSource"
              lines="1"
              class="text-subtitle1 source-label"
              @click="openUrl(curContentInfo.rssSource.htmlUrl)"
            >
              <q-badge :color="$q.dark.isActive ? 'grey-8' : 'primary'" outline class="cursor-pointer">
                {{ curContentInfo.rssSource.name }}
              </q-badge>
            </q-item-label>

            <!-- 文章标题 -->
            <q-item-label
              lines="4"
              class="article-title"
              @click="openUrl(curContentInfo.link)"
            >
              {{ curContentInfo.title }}
            </q-item-label>

            <!-- 文章元信息 (含估计阅读时间) -->
            <q-item-label lines="1" class="article-meta" v-if="curContentInfo.author || curContentInfo.updateTime">
              <span v-if="curContentInfo.author" class="meta-item">
                <q-icon name="person" size="14px" class="q-mr-xs" />
                {{ curContentInfo.author }}
              </span>
              <span v-if="curContentInfo.updateTime" class="meta-item">
                <q-icon name="schedule" size="14px" class="q-mr-xs" />
                {{ formatDate(curContentInfo.updateTime) }}
              </span>
              <span v-if="estimatedTime" class="meta-item">
                <q-icon name="timer" size="14px" class="q-mr-xs" />
                预计阅读 {{ estimatedTime }}
              </span>
            </q-item-label>
          </q-item-section>
        </q-item>

        <q-separator :class="$q.dark.isActive ? 'dark-sep' : ''" />

        <!-- 文章正文 (with fade transition on appear) -->
        <transition appear enter-active-class="animated fadeIn">
          <div
            v-html="sanitizeHtml(curContentInfo.content)"
            class="content-area"
            :class="{ 'dark': $q.dark.isActive }"
            :style="contentStyles"
          ></div>
        </transition>

        <!-- 阅读统计 & 操作 (footer merged from ContentReader) -->
        <div class="reader-footer" :class="{ 'dark': $q.dark.isActive }">
          <div class="reading-stats">
            <q-chip
              v-if="progress > 0"
              icon="timer"
              :label="`已读 ${formatReadingTime}`"
              color="primary"
              text-color="white"
              dense
              size="12px"
            />
            <q-chip
              v-if="progress > 0"
              icon="view_list"
              :label="`进度 ${Math.round(progress)}%`"
              color="secondary"
              text-color="white"
              dense
              size="12px"
            />
            <q-chip
              v-else
              icon="auto_stories"
              label="开始阅读"
              color="grey-5"
              text-color="white"
              dense
              size="12px"
            />
          </div>

          <div class="reading-controls">
            <q-btn flat round dense icon="keyboard_arrow_up" @click="scrollToTop">
              <q-tooltip>回到顶部 (Home)</q-tooltip>
            </q-btn>
            <q-btn flat round dense icon="keyboard_arrow_down" @click="scrollToBottom">
              <q-tooltip>到底部 (End)</q-tooltip>
            </q-btn>
            <q-btn
              flat round dense
              :icon="isFavorite ? 'bookmark' : 'bookmark_border'"
              :color="isFavorite ? 'warning' : undefined"
              @click="toggleFavoriteHandler"
            >
              <q-tooltip>{{ isFavorite ? '取消收藏' : '收藏文章' }}</q-tooltip>
            </q-btn>
            <q-btn flat round dense icon="share" @click="shareArticle">
              <q-tooltip>在浏览器中打开</q-tooltip>
            </q-btn>
          </div>
        </div>

        <!-- 底部留白 -->
        <div class="content-spacer"></div>
      </div>
    </transition>
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
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

const { RssId, PostId } = route.params;
const rssId = String(RssId || '');
const postId = String(PostId || '');

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
  // Check if the favorite store method exists
  if (favoriteStore.toggleFavorite) {
    const newStatus = await favoriteStore.toggleFavorite(curContentInfo.value.rssId, PostId as string);
    if (newStatus !== undefined) {
      isFavorite.value = newStatus === 1;
    } else {
      // fallback: just toggle locally
      isFavorite.value = !isFavorite.value;
    }
  } else {
    // fallback for when we can't access the store method
    isFavorite.value = !isFavorite.value;
    try {
      const rssId = curContentInfo.value.rssId || '';
      const postIdStr = PostId as string || '';
      await window.electronAPI.addFavorite(rssId, postIdStr);
    } catch (err) {
      console.warn('[Content.vue] toggleFavorite error:', err);
    }
  }
};

// ── 阅读进度追踪 (from ContentReader + useReadingExperience) ──

const {
  startReading,
  stopReading,
} = useReadingExperience(postId, ''); // content gets set after load

const progress = computed(() => {
  if (!postId) return 0;
  const p = readingStore.getProgress(postId);
  return p?.progress || 0;
});

const estimatedTime = computed(() => {
  if (!postId || !curContentInfo.value.content) return '';
  const text = curContentInfo.value.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const wordCount = text.length;
  const seconds = readingStore.estimateReadingTime(wordCount);
  return readingStore.formatReadingTime(seconds);
});

const formatReadingTime = computed(() => {
  return readingStore.formatReadingTime(readingStore.currentReadingTime);
});

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const scrollToBottom = () => {
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior: 'smooth',
  });
};

// ── 文章数据 ──

const curContentInfo: Ref<ContentInfo> = ref({
  title: '',
  content: '',
  author: '',
  updateTime: '',
  link: '',
  rssId: rssId || '',
  rssSource: {
    rssId: rssId || '',
    url: '',
    name: '',
    folder: '',
    avatar: '',
    htmlUrl: '',
  },
});

const getContentById = async (postIdToFetch: string): Promise<void> => {
  console.log('[Content.vue] getContentById called with postId:', postIdToFetch);

  loading.value = true;
  error.value = null;

  try {
    const postIndex: PostIndexItem | null = await window.electronAPI.queryPostIndexByRssId(postIdToFetch);
    console.log('[Content.vue] postIndex:', postIndex);

    if (!postIndex) {
      error.value = '文章索引不存在';
      loading.value = false;
      return;
    }

    const result = await window.electronAPI.queryPostContentByGuid(postIdToFetch);
    console.log('[Content.vue] content result:', result);

    if (!result) {
      error.value = '文章内容不存在';
      loading.value = false;
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
    }

    curContentInfo.value = result as ContentInfo;
  } catch (err: unknown) {
    console.error('[Content.vue] getContentById error:', err);
    error.value = err instanceof Error ? err.message : '加载文章失败';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  const rssIdStr = rssId;
  if (rssIdStr && rssIdStr !== 'search' && rssIdStr !== '' && rssIdStr !== 'undefined') {
    router.push({ name: 'PostList', params: { RssId: rssIdStr } });
  } else {
    router.push({ name: 'Home' });
  }
};

const retryLoad = async () => {
  await getContentById(postId);
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
    window.electronAPI.openLink(url);
  }
};

const openInBrowser = () => {
  if (curContentInfo.value?.link) {
    window.electronAPI.openLink(curContentInfo.value.link);
  }
};

const shareArticle = () => {
  const url = curContentInfo.value?.link || window.location.href;
  window.electronAPI.openLink(url);
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
    if (newContent && postId && postId !== 'undefined') {
      // Restart reading tracking with the actual content
      const text = newContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      readingStore.startReading(postId, text.length);
    }
  }
);

// ── Lifecycle ──
onMounted(async () => {
  console.log('[Content.vue] onMounted:', { RssId, PostId });

  // 恢复字体大小
  const saved = localStorage.getItem('contentFontSize');
  if (saved) {
    fontSize.value = parseInt(saved, 10);
  }

  await getContentById(postId);

  // 键盘快捷键
  document.addEventListener('keydown', handleContentKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleContentKeydown);
  if (postId && postId !== 'undefined' && postId !== 'null') {
    stopReading();
  }
});
</script>

<style scoped lang="scss">
.content-page {
  padding-left: 25px;
  padding-right: 25px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
}

// ── Toolbar ──
.toolbar {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 0;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
  transition: all 0.3s ease;

  &.dark {
    background: #121212;
    border-bottom-color: #333;
  }
}

// ── Loading skeleton ──
.loading-container {
  display: flex;
  justify-content: center;
  width: 100%;
}

.skeleton-wrapper {
  width: 100%;
  max-width: 800px;
  padding: 24px 16px;

  .skeleton-line {
    height: 16px;
    background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-radius: 6px;
    margin-bottom: 12px;
    width: 100%;

    &.short { width: 60%; }
    &.skeleton-title {
      height: 28px;
      width: 75%;
      margin-bottom: 16px;
    }
    &.skeleton-meta {
      height: 14px;
      width: 40%;
      margin-bottom: 8px;
    }
  }

  .skeleton-divider {
    height: 1px;
    background: #e0e0e0;
    margin: 20px 0;
  }

  &.dark {
    .skeleton-line {
      background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
    }
    .skeleton-divider {
      background: #333;
    }
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// ── State wrappers ──
.state-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  width: 100%;
}

.error-card {
  max-width: 450px;
  width: 100%;

  &.dark-card {
    background: #1e1e1e;
  }
}

// ── Content wrapper ──
.content-wrapper {
  width: 100%;
}

// ── Article header ──
.article-header {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 16px 0;

  &.dark {
    .q-item__label {
      color: #e0e0e0;
    }
  }
}

.source-label {
  cursor: pointer;
}

.article-title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.35;
  color: #333;
  margin: 8px 0;
  cursor: pointer;

  &:hover {
    color: $primary;
  }

  .dark & {
    color: #e0e0e0;

    &:hover {
      color: #64b5f6;
    }
  }
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #888;
  margin-top: 4px;

  .dark & {
    color: #aaa;
  }

  .meta-item {
    display: inline-flex;
    align-items: center;
  }
}

// ── Content area ──
.content-area {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 16px 0;
  font-size: 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  transition: font-size 0.2s ease;
  line-height: var(--reader-line-height, 1.8);
  font-family: var(--reader-font-family, system-ui);
  letter-spacing: 0.01em;
  color: #333;

  &.dark {
    color: #e0e0e0;
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 16px 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  :deep(h1) {
    font-size: 32px;
    margin-top: 28px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #eee;
    color: #333;

    .dark & {
      border-bottom-color: #333;
      color: #e0e0e0;
    }
  }

  :deep(h2) {
    font-size: 24px;
    margin-top: 24px;
    margin-bottom: 12px;
    color: #333;

    .dark & { color: #e0e0e0; }
  }

  :deep(h3) {
    font-size: 18px;
    margin-top: 20px;
    margin-bottom: 8px;
    color: #333;

    .dark & { color: #e0e0e0; }
  }

  :deep(h4) { font-size: 16px; color: #333; .dark & { color: #e0e0e0; } }
  :deep(h5) { font-size: 13px; color: #333; .dark & { color: #e0e0e0; } }
  :deep(h6) { font-size: 10px; color: #333; .dark & { color: #e0e0e0; } }

  :deep(a) {
    color: $primary;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }

  :deep(p) {
    margin-bottom: 1.2em;
  }

  :deep(pre) {
    background: #f5f5f5;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 16px 0;
    font-size: 0.9em;

    .dark & { background: #1e1e1e; }
  }

  :deep(code) {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;

    .dark & { background: #2d2d2d; }
  }

  :deep(blockquote) {
    border-left: 4px solid #1976d2;
    margin: 16px 0;
    padding: 8px 16px;
    color: #666;
    background: #f8f9fa;
    border-radius: 0 4px 4px 0;

    .dark & {
      color: #aaa;
      background: #1a1a2e;
    }
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;

    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;

      .dark & { border-color: #444; }
    }

    th {
      background: #f5f5f5;
      font-weight: 600;

      .dark & { background: #2d2d2d; }
    }
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid #eee;
    margin: 24px 0;

    .dark & { border-top-color: #333; }
  }

  :deep(ul), :deep(ol) {
    padding-left: 24px;
    margin-bottom: 1.2em;
  }

  :deep(li) {
    margin-bottom: 4px;
  }
}

// ── Reader footer (merged from ContentReader) ──
.reader-footer {
  position: sticky;
  bottom: 0;
  background: #fff;
  border-top: 1px solid #e0e0e0;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  width: 100%;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  transition: all 0.3s ease;

  &.dark {
    background: #1e1e1e;
    border-top-color: #333;
  }

  .reading-stats {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .reading-controls {
    display: flex;
    gap: 4px;
  }
}

.content-spacer {
  height: 40px;
  width: 100%;
}

.dark-sep {
  background: #333 !important;
}

// ── Responsive ──
@media (max-width: 600px) {
  .content-page {
    padding-left: 12px;
    padding-right: 12px;
  }

  .article-title {
    font-size: 22px !important;
  }

  .content-area {
    :deep(h1) { font-size: 24px; }
    :deep(h2) { font-size: 20px; }
    :deep(h3) { font-size: 16px; }
  }

  .reader-footer {
    flex-direction: column;
    gap: 8px;

    .reading-stats,
    .reading-controls {
      width: 100%;
      justify-content: center;
    }
  }
}
</style>
