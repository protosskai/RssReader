<template>
  <q-drawer
    :model-value="leftDrawerOpen"
    side="left"
    elevated
    :width="280"
    :breakpoint="1023"
    class="ink-drawer"
    @update:model-value="updateDrawer"
  >
    <div class="ink-drawer__search">
      <q-input
        ref="searchInputRef"
        v-model="searchQuery"
        dense
        outlined
        clearable
        placeholder="Search articles…"
        class="ink-search-field"
        @update:model-value="handleSearch"
      >
        <template #prepend>
          <q-icon name="search" size="18px" color="grey-7" />
        </template>
      </q-input>
    </div>

    <div v-if="searchQuery && isSearching" class="ink-drawer__status">
      <q-spinner size="20px" color="primary" />
      <span>Searching…</span>
    </div>

    <div v-else-if="searchQuery && searchResults.length > 0" class="ink-drawer__results">
      <div class="ink-eyebrow ink-drawer__section">Results · {{ searchResults.length }}</div>
      <q-list dense class="ink-result-list">
        <q-item
          v-for="article in searchResults"
          :key="article.guid"
          clickable
          class="ink-result-item"
          @click="openArticle(article)"
        >
          <q-item-section>
            <q-item-label class="ink-result-title">{{ article.title }}</q-item-label>
            <q-item-label caption class="ink-meta">
              {{ article.author || 'Unknown' }} · {{ formatDate(article.updateTime) }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <div v-else-if="searchQuery && !isSearching" class="ink-drawer__status ink-drawer__status--empty">
      <q-icon name="search_off" size="28px" />
      <span>No matching articles</span>
    </div>

    <div v-else class="ink-drawer__feeds">
      <div class="ink-eyebrow ink-drawer__section">Subscriptions</div>
      <subscription-list />
    </div>

    <edit-folder-dialog />
  </q-drawer>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref } from 'vue';
import {
  RSS_FOLDER_LIST_REF,
  TOGGLE_LAYOUT_LEFT_DRAWER_FUNC,
  TOGGLE_LAYOUT_LEFT_DRAWER_REF,
} from 'src/const/InjectionKey';
import SubscriptionList from 'components/SubscriptionList.vue';
import { useRssInfoStore } from 'stores/rssInfoStore';
import EditFolderDialog from 'components/EditFolderDialog.vue';
import { useSearchStore } from 'src/stores/searchStore';
import type { PostIndexItem } from 'src/common/models';
import { useRouter } from 'vue-router';

interface Props {
  leftDrawerOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  leftDrawerOpen: true,
});

const store = useRssInfoStore();
const searchStore = useSearchStore();
const router = useRouter();
const searchQuery = ref('');
const searchResults = ref<PostIndexItem[]>([]);
const isSearching = ref(false);
const searchInputRef = ref(null);

const leftDrawerOpenRef = inject(TOGGLE_LAYOUT_LEFT_DRAWER_REF);
const toggleLeftDrawerFunc = inject(TOGGLE_LAYOUT_LEFT_DRAWER_FUNC);

const leftDrawerOpen = computed(() => leftDrawerOpenRef?.value ?? props.leftDrawerOpen);

provide(
  RSS_FOLDER_LIST_REF,
  computed(() => store.rssFolderList),
);

/** Sync drawer model to layout state — do NOT toggle (toggle fights Quasar close). */
const updateDrawer = (val: boolean) => {
  if (leftDrawerOpenRef && typeof leftDrawerOpenRef === 'object' && 'value' in leftDrawerOpenRef) {
    (leftDrawerOpenRef as { value: boolean }).value = val;
    return;
  }
  // Fallback: only toggle when value actually diverges
  if (typeof toggleLeftDrawerFunc === 'function' && val !== leftDrawerOpen.value) {
    toggleLeftDrawerFunc();
  }
};

let searchTimer: ReturnType<typeof setTimeout> | null = null;
const handleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer);
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  searchTimer = setTimeout(async () => {
    isSearching.value = true;
    try {
      await searchStore.search(searchQuery.value);
      searchResults.value = searchStore.searchResults.slice(0, 12);
    } catch (error) {
      console.error('[AppDrawer] Search failed:', error);
    } finally {
      isSearching.value = false;
    }
  }, 220);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `${Math.max(0, minutes)}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
};

const openArticle = (article: PostIndexItem) => {
  void router.push({
    name: 'Content',
    query: {
      rssId: article.rssId || 'search',
      postId: article.guid,
    },
  });
  searchQuery.value = '';
};
</script>

<style lang="scss" scoped>
.ink-drawer {
  background: var(--ink-neutral) !important;
  border-right: 1px solid var(--ink-border);
}

.ink-drawer__search {
  padding: 12px;
  background: transparent;
  position: sticky;
  top: 0;
  z-index: 2;
  -webkit-app-region: drag; /* Makes the top draggable like a real native app */
}

.ink-search-field {
  -webkit-app-region: no-drag;
  :deep(.q-field__control) {
    background: var(--ink-border); /* Subtle darker background for search */
    border-radius: var(--ink-radius-md);
    height: 32px;
    min-height: 32px;
  }
  :deep(.q-field__marginal) {
    height: 32px;
  }
}

.ink-drawer__section {
  padding: 8px 12px 4px;
}

.ink-drawer__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--ink-secondary);
  font-size: var(--ink-body-sm);
}

.ink-drawer__feeds {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.ink-result-list {
  padding: 0 8px 16px;
}

.ink-result-item {
  border-radius: var(--ink-radius-sm);
  margin-bottom: 2px;

  &:hover {
    background: var(--ink-surface-raised);
  }
}

.ink-result-title {
  font-family: var(--ink-font-serif);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ink-primary);
}
</style>
