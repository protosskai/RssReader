<template>
  <q-page class="ink-home" role="main" aria-label="Home">
    <div class="ink-stage ink-home__inner">
      <header class="ink-home__hero">
        <p class="ink-eyebrow">Desktop RSS</p>
        <h1 class="ink-home__title">{{ SOFT_NAME }}</h1>
        <p class="ink-home__lede">
          Scan feeds. Open an article. Read without noise. Return.
        </p>
      </header>

      <section class="ink-home__actions" aria-label="Quick actions">
        <q-btn class="ink-btn-primary" unelevated no-caps icon="rss_feed" :label="ADD_FEED" @click="toggleSubscriptionDialog" />
        <q-btn outline no-caps color="primary" icon="folder" :label="ADD_FOLDER" class="ink-outline-btn" @click="toggleAddFolderDialog" />
        <q-btn outline no-caps color="primary" icon="file_upload" :label="IMPORT_OPML" class="ink-outline-btn" @click="importOpmlFile" />
        <q-btn outline no-caps color="primary" icon="sync" label="Sync all" class="ink-outline-btn" :loading="isSyncing" @click="syncAllFeeds" />
        <q-btn flat round :icon="isDarkMode ? 'light_mode' : 'dark_mode'" aria-label="Toggle theme" @click="toggleTheme" />
        <q-btn flat round icon="keyboard" aria-label="Shortcuts" @click="showKeyboardShortcuts" />
        <q-btn flat round icon="settings" aria-label="Settings" @click="openSettings" />
      </section>

      <div v-if="syncProgressStore.progress.isSyncing" class="ink-home__sync" role="progressbar">
        <q-linear-progress
          :value="syncProgressStore.progressPercent() / 100"
          color="accent"
          track-color="grey-4"
          class="ink-progress"
        />
        <p class="ink-meta">
          Syncing {{ syncProgressStore.progress.completedCount }}/{{ syncProgressStore.progress.totalSources }}
          <span v-if="syncProgressStore.progress.currentSource"> · {{ syncProgressStore.progress.currentSource }}</span>
        </p>
      </div>

      <!-- Loading -->
      <div v-if="isDataLoading" class="ink-home__stats" aria-busy="true">
        <div v-for="n in 4" :key="'sk' + n" class="ink-stat ink-stat--skel">
          <q-skeleton type="text" width="40%" />
          <q-skeleton type="text" width="60%" class="q-mt-sm" />
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="stats.totalFeeds === 0 && !dataError" class="ink-empty">
        <q-icon name="auto_stories" size="56px" class="ink-empty__icon" />
        <h2 class="ink-empty__title">Your reading desk is empty</h2>
        <p class="ink-empty__desc">Add a feed or import an OPML file to start scanning headlines.</p>
        <div class="ink-home__empty-actions">
          <q-btn class="ink-btn-primary" unelevated no-caps icon="rss_feed" :label="ADD_FEED" @click="toggleSubscriptionDialog" />
          <q-btn outline no-caps color="primary" icon="file_upload" :label="IMPORT_OPML" class="ink-outline-btn" @click="importOpmlFile" />
        </div>

        <div class="ink-home__rec">
          <p class="ink-eyebrow">Suggested feeds</p>
          <div class="ink-home__rec-grid">
            <article v-for="feed in recommendedFeeds" :key="feed.url" class="ink-rec-card">
              <div class="ink-rec-card__body">
                <h3 class="ink-rec-card__title">{{ feed.title }}</h3>
                <p class="ink-rec-card__desc">{{ feed.desc }}</p>
              </div>
              <q-btn
                dense
                flat
                round
                icon="add"
                :loading="addingFeedId === feed.url"
                aria-label="Add feed"
                @click="addRecommendedFeed(feed)"
              />
            </article>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="dataError" class="ink-empty">
        <q-icon name="cloud_off" size="48px" class="ink-empty__icon" color="negative" />
        <h2 class="ink-empty__title">Couldn’t load library</h2>
        <p class="ink-empty__desc">{{ dataError }}</p>
        <q-btn class="ink-btn-primary" unelevated no-caps icon="refresh" label="Retry" @click="loadData" />
      </div>

      <!-- Stats -->
      <div v-else class="ink-home__stats">
        <div
          v-for="stat in statCards"
          :key="stat.label"
          class="ink-stat"
          :class="{ 'ink-stat--link': !!stat.route }"
          @click="stat.route && router.push(stat.route)"
        >
          <div class="ink-stat__value">{{ stat.value }}</div>
          <div class="ink-stat__label">{{ stat.label }}</div>
        </div>
      </div>

      <footer class="ink-home__footer ink-meta">
        <kbd>j</kbd>/<kbd>k</kbd> list ·
        <kbd>Enter</kbd> open ·
        <kbd>Backspace</kbd> back ·
        <kbd>/</kbd> search
      </footer>
    </div>

    <KeyboardShortcutsDialog ref="shortcutsDialog" />
  </q-page>
</template>

<script setup lang="ts">
import { SOFT_NAME, ADD_FOLDER, ADD_FEED, IMPORT_OPML } from 'src/const/string';
import { electronClient } from 'src/services/electronClient';
import { useSystemDialogStore } from 'stores/systemDialogStore';
import { useRssInfoStore } from 'stores/rssInfoStore';
import { useThemeStore } from 'stores/themeStore';
import { useSyncProgressStore } from 'stores/syncProgressStore';
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import KeyboardShortcutsDialog from 'src/components/KeyboardShortcutsDialog.vue';

const systemDialogStore = useSystemDialogStore();
const rssInfoStore = useRssInfoStore();
const themeStore = useThemeStore();
const syncProgressStore = useSyncProgressStore();
const router = useRouter();
const { toggleSubscriptionDialog, toggleAddFolderDialog } = systemDialogStore;
const { importOpmlFile } = rssInfoStore;
const $q = useQuasar();

const isDataLoading = ref(true);
const isSyncing = ref(false);
const dataError = ref<string | null>(null);
const addingFeedId = ref<string | null>(null);
const shortcutsDialog = ref<InstanceType<typeof KeyboardShortcutsDialog> | null>(null);

const recommendedFeeds = [
  { title: 'Hacker News', url: 'https://hnrss.org/frontpage', desc: 'Tech news & discussion' },
  { title: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', desc: 'World headlines' },
  { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', desc: 'Tech & culture' },
  { title: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', desc: 'Public radio news' },
  { title: 'xkcd', url: 'https://xkcd.com/atom.xml', desc: 'Webcomic of romance, sarcasm, math' },
  { title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', desc: 'Tech policy & analysis' },
];

const isDarkMode = computed(() => themeStore.isDarkMode);

const stats = computed(() => {
  const feeds = rssInfoStore.rssFolderList.reduce((sum, folder) => sum + folder.data.length, 0);
  const folders = rssInfoStore.rssFolderList.length;
  return {
    totalFeeds: feeds,
    totalFolders: folders,
    totalArticles: rssInfoStore.totalArticleCount || 0,
    unreadArticles: rssInfoStore.unreadArticleCount || 0,
    favoriteArticles: rssInfoStore.favoriteCount || 0,
    readArticles: Math.max(0, (rssInfoStore.totalArticleCount || 0) - (rssInfoStore.unreadArticleCount || 0)),
  };
});

const statCards = computed(() => {
  const s = stats.value;
  return [
    { label: 'Feeds', value: s.totalFeeds, route: null as string | null },
    { label: 'Folders', value: s.totalFolders, route: null },
    { label: 'Articles', value: s.totalArticles, route: null },
    { label: 'Unread', value: s.unreadArticles, route: null },
    { label: 'Favorites', value: s.favoriteArticles, route: '/favorite' },
    { label: 'Read', value: s.readArticles, route: null },
  ];
});

const toggleTheme = () => {
  themeStore.toggleMode();
  $q.notify({
    type: 'positive',
    message: `Theme: ${themeStore.currentMode}`,
    position: 'top',
    timeout: 1000,
  });
};

const showKeyboardShortcuts = () => shortcutsDialog.value?.open();
const openSettings = () => {
  void router.push({ name: 'Setting' });
};

const addRecommendedFeed = async (feed: { title: string; url: string; desc: string }) => {
  addingFeedId.value = feed.url;
  try {
    await rssInfoStore.addRssSubscription(feed.url, feed.title, '默认');
    $q.notify({ type: 'positive', message: `Added: ${feed.title}`, position: 'top' });
  } catch (err) {
    const msg = (err as Error).message;
    if (/already exists|已存在|duplicate/i.test(msg)) {
      $q.notify({ type: 'info', message: `${feed.title} already subscribed`, position: 'top' });
    } else {
      $q.notify({ type: 'negative', message: `Failed: ${msg}`, position: 'top' });
    }
  } finally {
    addingFeedId.value = null;
  }
};

const syncAllFeeds = async () => {
  isSyncing.value = true;
  syncProgressStore.startPolling(500);
  try {
    const result = (await electronClient.syncStart()) as {
      success?: boolean;
      stats?: { successCount?: number; failureCount?: number };
      error?: string;
    } | null | undefined;
    syncProgressStore.stopPolling();
    await rssInfoStore.refresh();
    if (result && result.success === false) throw new Error(result.error || 'Sync failed');
    $q.notify({
      type: 'positive',
      message: `Sync done · ok ${result?.stats?.successCount ?? 0} · fail ${result?.stats?.failureCount ?? 0}`,
      position: 'top',
    });
  } catch (error) {
    syncProgressStore.stopPolling();
    $q.notify({
      type: 'negative',
      message: 'Sync failed: ' + (error as Error).message,
      position: 'top',
    });
  } finally {
    isSyncing.value = false;
  }
};

const loadData = async () => {
  isDataLoading.value = true;
  dataError.value = null;
  await rssInfoStore.init();
  dataError.value = rssInfoStore.error || null;
  isDataLoading.value = false;
};

onMounted(() => {
  themeStore.initializeTheme();
  void loadData();
});
</script>

<style scoped lang="scss">
.ink-home {
  min-height: calc(100vh - var(--ink-header-h));
  background: var(--ink-neutral);
}

.ink-home__inner {
  padding-top: var(--ink-space-2xl);
  padding-bottom: var(--ink-space-2xl);
}

.ink-home__hero {
  text-align: center;
  margin-bottom: var(--ink-space-xl);
}

.ink-home__title {
  font-family: var(--ink-font-serif);
  font-size: var(--ink-display-size);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink-primary);
  margin: 8px 0;
  line-height: 1.1;
}

.ink-home__lede {
  font-family: var(--ink-font-serif);
  font-size: var(--ink-body-lg);
  color: var(--ink-secondary);
  max-width: 36ch;
  margin: 0 auto;
  line-height: 1.5;
}

.ink-home__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  align-items: center;
  margin-bottom: var(--ink-space-xl);
}

.ink-outline-btn {
  border-color: var(--ink-border) !important;
  color: var(--ink-primary) !important;
  background: var(--ink-surface) !important;
}

.ink-home__sync {
  max-width: 420px;
  margin: 0 auto var(--ink-space-lg);
  text-align: center;
}

.ink-progress {
  border-radius: 2px;
  height: 3px;
  margin-bottom: 8px;
}

.ink-home__stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--ink-space-md);
  margin-bottom: var(--ink-space-xl);
}

.ink-stat {
  background: var(--ink-surface);
  border: 1px solid var(--ink-border);
  border-radius: var(--ink-radius-md);
  padding: var(--ink-space-lg) var(--ink-space-md);
  text-align: center;

  &--link {
    cursor: pointer;
    transition: border-color 0.15s ease;
    &:hover {
      border-color: var(--ink-tertiary);
    }
  }

  &--skel {
    min-height: 88px;
  }

  &__value {
    font-family: var(--ink-font-serif);
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--ink-primary);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  &__label {
    margin-top: 6px;
    font-size: var(--ink-meta);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-secondary);
    font-weight: 600;
  }
}

.ink-home__empty-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.ink-home__rec {
  margin-top: var(--ink-space-2xl);
  width: 100%;
  max-width: 640px;
  text-align: left;
}

.ink-home__rec-grid {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.ink-rec-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--ink-surface);
  border: 1px solid var(--ink-border);
  border-radius: var(--ink-radius-md);

  &__title {
    font-family: var(--ink-font-serif);
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 2px;
    color: var(--ink-primary);
  }

  &__desc {
    margin: 0;
    font-size: var(--ink-body-sm);
    color: var(--ink-secondary);
  }

  &__body {
    flex: 1;
    min-width: 0;
  }
}

.ink-home__footer {
  text-align: center;
  padding-top: var(--ink-space-lg);
  border-top: 1px solid var(--ink-border);

  kbd {
    font-family: var(--ink-font-sans);
    font-size: 11px;
    font-weight: 600;
    padding: 1px 5px;
    border: 1px solid var(--ink-border);
    border-radius: 3px;
    background: var(--ink-surface);
    color: var(--ink-primary);
  }
}
</style>
