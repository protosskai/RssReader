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
                  :class="{ 'text-weight-medium': prop.node.data.unread > 0 }"
                >
                  {{ prop.node.data.title }}
                  <!-- Unread count badge next to title -->
                  <q-badge
                    v-if="prop.node.data.unread > 0"
                    :color="$q.dark.isActive ? 'red-4' : 'red'"
                    text-color="white"
                    :label="formatUnread(prop.node.data.unread)"
                    class="q-ml-sm feed-unread-badge"
                    size="sm"
                    :title="`${prop.node.data.unread} 篇未读`"
                  />
                </q-item-label>
                <q-item-label
                  class="conversation__summary feed-meta"
                  caption
                >
                  <span v-if="prop.node.data.unread !== 0" class="unread-meta">
                    <q-icon name="mark_chat_unread" :color="$q.dark.isActive ? 'red-4' : 'red-6'" size="12px" />
                    {{ prop.node.data.unread }} 篇未读
                  </span>
                  <span v-else class="read-meta">
                    <q-icon name="check_circle" color="grey-5" size="12px" />
                    已读
                  </span>
                </q-item-label>
              </q-item-section>

              <q-item-section side class="feed-side">
                <q-item-label caption class="feed-time">
                  {{ prop.node.data.lastUpdateTime }}
                </q-item-label>
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
import { switchPage } from "src/common/util";
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

// ── Quasar ───────────────────────────────────────────────────────
const $q = useQuasar();

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
const openPostList = (RssId: number) => {
  switchPage('PostList', { RssId });
};
</script>

<style lang="scss" scoped>
// ============================
// Layout
// ============================
.subscription-list {
  min-height: 100px;
}

// ============================
// Loading
// ============================
.tree-loading {
  padding: 16px;
}

// ============================
// Empty & Error
// ============================
.tree-empty,
.tree-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
  min-height: 200px;
}

.empty-content,
.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

// ============================
// Toolbar / Controls
// ============================
.tree-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 8px !important;

  :deep(.q-separator) {
    height: 18px;
    margin: 0 4px;
  }
}

.total-unread-badge {
  font-size: 11px;
  padding: 1px 6px;
  min-width: 18px;
  text-align: center;
}

// ============================
// Folder Header
// ============================
.folder-header {
  .folder-avatar {
    min-width: 28px;
    padding-right: 4px;
  }

  .folder-label {
    font-size: 13px;
    font-weight: 500;
  }
}

// ============================
// Feed Items
// ============================
.feed-item {
  border-radius: 6px;
  margin: 1px 4px;
  padding: 4px 8px;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  outline: none;
  cursor: pointer;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  &:focus-visible {
    background-color: rgba(0, 0, 0, 0.06);
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.3);
  }

  &.feed-item-unread {
    background-color: rgba(255, 76, 76, 0.04);
    border-left: 2px solid rgba(255, 76, 76, 0.35);

    &:hover {
      background-color: rgba(255, 76, 76, 0.08);
    }
  }

  .feed-avatar {
    min-width: 32px;
    padding-right: 4px;
  }

  .feed-title {
    font-size: 13px;
    line-height: 1.4;

    .feed-unread-badge {
      font-size: 10px;
      padding: 0 5px;
      vertical-align: middle;
    }
  }

  .feed-meta {
    font-size: 11px;
    margin-top: 2px;

    .unread-meta {
      color: #e53935;
    }

    .read-meta {
      color: #9e9e9e;
    }
  }

  .feed-side {
    min-width: 50px;

    .feed-time {
      font-size: 10px;
      white-space: nowrap;
      color: #bdbdbd;
    }
  }
}

// ============================
// Dark Mode
// ============================
.body--dark {
  .tree-controls {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .feed-item {
    &:hover {
      background-color: rgba(255, 255, 255, 0.06);
    }

    &:focus-visible {
      background-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 0 0 2px rgba(100, 181, 246, 0.4);
    }

    &.feed-item-unread {
      background-color: rgba(255, 138, 128, 0.06);
      border-left-color: rgba(255, 138, 128, 0.45);

      &:hover {
        background-color: rgba(255, 138, 128, 0.1);
      }
    }

    .feed-meta {
      .unread-meta {
        color: #ef9a9a;
      }
    }

    .feed-time {
      color: #616161;
    }
  }

  .folder-header {
    .folder-label {
      color: #e0e0e0;
    }
  }
}

// ============================
// Transitions
// ============================
.fade-up-enter-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-up-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-up-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.fade-up-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.fade-in-enter-active {
  transition: opacity 0.25s ease;
}

.fade-in-leave-active {
  transition: opacity 0.15s ease;
}

.fade-in-enter-from,
.fade-in-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.slide-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

.badge-pop-enter-active {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease;
}

.badge-pop-leave-active {
  transition: transform 0.15s ease, opacity 0.1s ease;
}

.badge-pop-enter-from {
  transform: scale(0.5);
  opacity: 0;
}

.badge-pop-leave-to {
  transform: scale(1.3);
  opacity: 0;
}
</style>
