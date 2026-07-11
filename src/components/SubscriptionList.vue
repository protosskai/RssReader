<template>
  <div class="q-pa-sm subscription-list">
    <!-- ===== Loading State ===== -->
    <div v-if="isLoading" class="tree-loading">
      <q-skeleton v-for="n in 4" :key="'tl' + n" type="text" class="q-mb-sm" />
      <q-skeleton v-for="n in 2" :key="'ts' + n" type="QInput" class="q-mb-sm" height="36px" />
      <div class="text-caption text-grey-6 text-center q-mt-sm">正在加载订阅源...</div>
    </div>

    <!-- ===== Empty State ===== -->
    <div v-else-if="!hasData" class="tree-empty">
      <transition name="fade-up" appear>
        <div class="empty-content">
          <q-icon name="rss_feed" size="48px" color="grey-4" class="q-mb-md" />
          <div class="text-subtitle2 text-grey-6">暂无订阅源</div>
          <div class="text-caption text-grey-5 q-mt-xs">点击上方 <strong>+</strong> 按钮添加第一个订阅</div>
          <q-btn
            flat
            dense
            color="primary"
            label="添加订阅"
            icon="add_circle_outline"
            size="sm"
            class="q-mt-md"
            @click="$emit('showAddDialog')"
          />
        </div>
      </transition>
    </div>

    <!-- ===== Error State ===== -->
    <div v-else-if="loadError" class="tree-error">
      <transition name="fade-up" appear>
        <div class="error-content">
          <q-icon name="cloud_off" size="44px" color="negative" class="q-mb-sm" />
          <div class="text-body2 text-negative text-weight-medium">加载失败</div>
          <div class="text-caption text-negative q-mt-xs">{{ loadError }}</div>
          <q-btn
            flat
            dense
            color="primary"
            label="重试"
            @click="retry"
            size="sm"
            class="q-mt-md"
            icon="refresh"
          />
        </div>
      </transition>
    </div>

    <!-- ===== Normal Content ===== -->
    <template v-else>
      <!-- Toolbar -->
      <div class="tree-controls q-mb-sm">
        <q-btn
          icon="unfold_more"
          flat
          dense
          size="sm"
          @click="expandAll"
          :disable="allExpanded"
          aria-label="展开全部"
        >
          <q-tooltip>展开全部</q-tooltip>
        </q-btn>
        <q-btn
          icon="unfold_less"
          flat
          dense
          size="sm"
          @click="collapseAll"
          :disable="allCollapsed"
          aria-label="收起全部"
        >
          <q-tooltip>收起全部</q-tooltip>
        </q-btn>

        <q-separator vertical spaced="sm" class="q-mx-xs" />

        <!-- Sort Toggle -->
        <q-btn
          :icon="sortByUnread ? 'sort_by_alpha' : 'trending_down'"
          flat
          dense
          size="sm"
          @click="toggleSort"
          :color="sortByUnread ? 'primary' : undefined"
          :aria-label="sortByUnread ? '当前按名称排序，点击切换为按未读数排序' : '当前按未读数排序，点击切换为按名称排序'"
        >
          <q-tooltip>{{ sortByUnread ? '切换为按名称排序' : '切换为按未读数排序' }}</q-tooltip>
        </q-btn>

        <q-space />

        <transition name="badge-pop" mode="out-in">
          <q-badge
            v-if="totalUnread > 0"
            :key="totalUnread"
            :color="$q.dark.isActive ? 'red-4' : 'red'"
            text-color="white"
            :label="formatUnread(totalUnread)"
            class="total-unread-badge"
            :title="`共 ${totalUnread} 篇未读文章`"
          />
        </transition>
      </div>

      <!-- Feed Tree -->
      <q-tree
        :nodes="treeNodes"
        node-key="label"
        no-connectors
        dense
        default-expand-all
        v-model:expanded="expandedKeys"
        :expanded.sync="expandedKeys"
        class="feed-tree"
        :class="{ 'dark-mode': $q.dark.isActive }"
      >
        <!-- Folder Header -->
        <template #default-header="props">
          <transition name="fade-in" appear>
            <div v-if="!props.node.data" class="folder-header">
              <q-item
                dense
                :class="{ 'dark-item': $q.dark.isActive }"
                :aria-label="`文件夹: ${props.node.label}`"
                role="treeitem"
                :aria-expanded="expandedKeys.includes(props.node.label)"
              >
                <q-item-section avatar class="folder-avatar" @click="onFolderClick(props.node.label)">
                  <q-icon
                    :name="expandedKeys.includes(props.node.label) ? 'folder_open' : 'folder'"
                    :color="$q.dark.isActive ? 'amber-4' : 'amber-8'"
                    size="20px"
                  />
                </q-item-section>
                <q-item-section @click="onFolderClick(props.node.label)">
                  <q-item-label class="folder-label" lines="1">
                    {{ props.node.label }}
                    <q-badge
                      v-if="folderUnreadCount(props.node.label) > 0"
                      :color="$q.dark.isActive ? 'red-4' : 'red'"
                      text-color="white"
                      :label="String(folderUnreadCount(props.node.label))"
                      class="q-ml-sm unread-badge"
                      size="sm"
                      :title="`${folderUnreadCount(props.node.label)} 篇未读`"
                    />
                  </q-item-label>
                </q-item-section>
                <folder-context-menu :folder-name="props.node.label" />
              </q-item>
            </div>
          </transition>
        </template>

        <!-- Feed Item Body -->
        <template #default-body="prop">
          <transition name="slide-fade" appear>
            <q-item
              v-if="prop.node.data"
              clickable
              v-ripple
              @click="openPostList(prop.node.data.id)"
              @keydown.enter="openPostList(prop.node.data.id)"
              @keydown.space.prevent="openPostList(prop.node.data.id)"
              :tabindex="0"
              :aria-label="`订阅源: ${prop.node.data.title}${prop.node.data.unread > 0 ? `，${prop.node.data.unread} 篇未读` : '，全部已读'}`"
              role="treeitem"
              class="feed-item"
              :class="{
                'feed-item-unread': prop.node.data.unread > 0,
                'dark-item': $q.dark.isActive,
                'dark-item-unread': $q.dark.isActive && prop.node.data.unread > 0
              }"
            >
              <q-item-section avatar class="feed-avatar">
                <rss-icon
                  :src="prop.node.data.avatar"
                  :title="prop.node.data.title"
                  style="width: 28px; height: 28px"
                />
              </q-item-section>

              <q-item-section>
                <q-item-label
                  :lines="1"
                  class="feed-title"
                  :class="{ 'text-weight-bold': prop.node.data.unread > 0 }"
                >
                  {{ prop.node.data.title }}
                </q-item-label>
              </q-item-section>

              <q-item-section side class="feed-side" v-if="prop.node.data.unread > 0">
                <q-badge
                  color="primary"
                  text-color="white"
                  :label="formatUnread(prop.node.data.unread)"
                  class="feed-unread-badge"
                  size="sm"
                  :title="`${prop.node.data.unread} 篇未读`"
                />
              </q-item-section>

              <sub-subscription-item-context-menu
                :rss-info="prop.node.data"
                :folder-name="prop.node.folderName"
              />
            </q-item>
          </transition>
        </template>
      </q-tree>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { useQuasar } from "quasar";
import { RSS_FOLDER_LIST_REF } from "src/const/InjectionKey";
import SubSubscriptionItemContextMenu from "components/SubSubscriptionItemContextMenu.vue";
import { useRouter } from "vue-router";
import FolderContextMenu from "components/FolderContextMenu.vue";
import RssIcon from "components/RssIcon.vue";
import { useRssInfoStore } from "stores/rssInfoStore";

// ── Emits ────────────────────────────────────────────────────────
const emit = defineEmits<{
  (e: 'showAddDialog'): void;
}>();

// ── Injects ──────────────────────────────────────────────────────
const RssFolderList = inject(RSS_FOLDER_LIST_REF);
const rssStore = useRssInfoStore();

// ── Quasar / Router ──────────────────────────────────────────────
const $q = useQuasar();
const router = useRouter();

// ── State ────────────────────────────────────────────────────────
const expandedKeys = ref<string[]>([]);
const sortByUnread = ref(false);

// ── Computed: Loading state ──────────────────────────────────────
const isLoading = computed(() => rssStore.isLoading && (RssFolderList?.value.length === 0));
const loadError = computed(() => rssStore.error);
const hasData = computed(() => RssFolderList?.value && RssFolderList.value.length > 0);

// ── Retry ────────────────────────────────────────────────────────
const retry = () => {
  rssStore.refresh();
};

// ── Computed: Tree nodes ─────────────────────────────────────────
const treeNodes = computed(() => {
  const nodes = RssFolderList?.value.map(item => {
    // Sort children within each folder
    const children = [...(item.data ?? [])].map(item1 => ({
      label: item1.title,
      avatar: item1.avatar,
      data: item1,
      folderName: item.folderName
    }));

    if (sortByUnread.value) {
      children.sort((a, b) => (b.data?.unread ?? 0) - (a.data?.unread ?? 0));
    } else {
      children.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
    }

    return {
      label: item.folderName,
      icon: 'folder',
      children
    };
  }) ?? [];

  // Initialize expanded state
  if (expandedKeys.value.length === 0 && nodes.length > 0) {
    expandedKeys.value = nodes.map(n => n.label);
  }

  return nodes;
});

// ── Computed: Expand / collapse helpers ──────────────────────────
const allFolderKeys = computed(() => treeNodes.value.map(n => n.label));
const allExpanded = computed(() =>
  expandedKeys.value.length >= allFolderKeys.value.length && allFolderKeys.value.length > 0
);
const allCollapsed = computed(() => expandedKeys.value.length === 0);

const expandAll = () => {
  expandedKeys.value = [...allFolderKeys.value];
};

const collapseAll = () => {
  expandedKeys.value = [];
};

// ── Computed: Total unread count ─────────────────────────────────
const totalUnread = computed(() =>
  RssFolderList?.value.reduce((sum, folder) =>
    sum + folder.data.reduce((s, feed) => s + (feed.unread || 0), 0), 0
  ) ?? 0
);

// ── Folder unread count helper ───────────────────────────────────
const folderUnreadCount = (folderName: string): number => {
  const folder = RssFolderList?.value.find(f => f.folderName === folderName);
  if (!folder) return 0;
  return folder.data.reduce((sum, feed) => sum + (feed.unread || 0), 0);
};

// ── Folder click: toggle folder expansion ────────────────────────
const onFolderClick = (folderName: string) => {
  const idx = expandedKeys.value.indexOf(folderName);
  if (idx >= 0) {
    expandedKeys.value.splice(idx, 1);
  } else {
    expandedKeys.value.push(folderName);
  }
};

// ── Sort toggle ──────────────────────────────────────────────────
const toggleSort = () => {
  sortByUnread.value = !sortByUnread.value;
};

// ── Format unread number ─────────────────────────────────────────
const formatUnread = (count: number): string => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(count);
};

// ── Navigation ───────────────────────────────────────────────────
const openPostList = (RssId: string | number) => {
  void router.push({ name: 'PostList', params: { RssId: String(RssId) } });
};
</script>

<style lang="scss" scoped>
/* Inkline rail list */
.subscription-list {
  min-height: 100px;
  font-family: var(--ink-font-sans);
  color: var(--ink-on-surface);
}
.tree-loading { padding: var(--ink-space-md); }
.tree-empty, .tree-error {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 16px; text-align: center; min-height: 200px; color: var(--ink-secondary);
}
.empty-content, .error-content { display: flex; flex-direction: column; align-items: center; }
.tree-controls {
  display: flex; align-items: center; gap: 2px; padding: 4px 8px;
  border-bottom: 1px solid var(--ink-border); margin-bottom: 8px !important;
  :deep(.q-separator) { height: 18px; margin: 0 4px; background: var(--ink-border); }
  :deep(.q-btn) { color: var(--ink-secondary); }
}
.total-unread-badge {
  font-size: 11px; padding: 1px 6px; min-width: 18px; text-align: center;
  background: var(--ink-tertiary) !important;
}
.folder-header {
  .folder-avatar { min-width: 28px; padding-right: 4px; }
  .folder-label {
    font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
    text-transform: uppercase; color: var(--ink-secondary);
  }
  :deep(.q-icon) { color: var(--ink-secondary) !important; }
}
.feed-item {
  border-radius: var(--ink-radius-sm); margin: 1px 8px; padding: 2px 8px;
  min-height: 32px;
  transition: background-color 0.15s ease; outline: none; cursor: pointer;
  border-left: none;
  &:hover { background-color: var(--ink-surface-raised); }
  &:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--ink-tertiary) 40%, transparent); }
  &.feed-item-unread {
    background-color: transparent;
    &:hover { background-color: var(--ink-surface-raised); }
  }
  .feed-avatar { min-width: 24px; padding-right: 8px; }
  .feed-title {
    font-size: 13px; line-height: 1.2; font-weight: 400; color: var(--ink-primary);
  }
  .feed-unread-badge { 
    font-size: 11px; padding: 2px 6px; border-radius: 12px; background: var(--ink-tertiary) !important; font-weight: 600;
  }
}
.feed-tree {
  padding: 0 4px 16px;
  :deep(.q-tree__node-header) { border-radius: var(--ink-radius-sm); }
  :deep(.q-tree__node-header:hover) { background: transparent; }
}
.unread-badge { background: var(--ink-tertiary) !important; }
.fade-up-enter-active, .fade-in-enter-active, .slide-fade-enter-active { transition: opacity 0.15s ease; }
.fade-up-enter-from, .fade-in-enter-from, .slide-fade-enter-from { opacity: 0; }
.badge-pop-enter-active { transition: transform 0.15s ease; }
.badge-pop-enter-from { transform: scale(0.8); }
</style>
