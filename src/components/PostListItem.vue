<template>
  <q-item
    class="post-item"
    :class="postClasses"
    :tabindex="0"
    role="article"
    :aria-label="`${postInfo.read ? '已读' : '未读'}：${postInfo.title}`"
    @click="handleCardClick"
    @contextmenu.prevent="openContextMenu"
    @keydown.enter="handleCardClick"
    @keydown.space.prevent="handleCardClick"
  >
    <q-card
      class="post-card"
      :class="{ 'is-read': postInfo.read }"
    >
      <!-- ── Header: title, unread dot, author, timestamp ── -->
      <q-card-section class="q-pb-none">
        <div class="row no-wrap items-start justify-between">
          <div class="col-grow q-pr-md" style="min-width: 0">
            <!-- Title row with unread indicator dot -->
            <div class="title-row">
              <q-icon
                v-if="!postInfo.read"
                name="fiber_manual_record"
                class="unread-dot"
                size="10px"
              />
              <div class="post-title text-h6 ellipsis" :class="{ 'is-unread': !postInfo.read }">
                {{ postInfo.title }}
              </div>
            </div>
            <!-- Author -->
            <div v-if="postInfo.author" class="post-author text-subtitle2 q-mt-xs">
              {{ postInfo.author }}
            </div>
          </div>
          <!-- Timestamp -->
          <div class="col-auto">
            <span class="post-time text-caption text-grey">{{ postInfo.updateTime }}</span>
          </div>
        </div>
      </q-card-section>

      <q-separator class="q-mt-sm"/>

      <!-- ── Description snippet ── -->
      <q-card-section class="q-py-sm">
        <div class="post-desc text-body1" :class="{ 'is-read': postInfo.read }">
          {{ extractTextFromHtml(postInfo.desc) }}
        </div>
      </q-card-section>

      <q-separator/>

      <!-- ── Action buttons ── -->
      <q-card-section class="q-pt-sm q-pb-sm">
        <div class="action-buttons">
          <q-btn
            label="阅读"
            color="primary"
            unelevated
            size="md"
            @click.stop="openContentPage"
          />
          <q-btn
            :label="postInfo.read ? '标为未读' : '标为已读'"
            :color="postInfo.read ? 'grey-7' : 'primary'"
            flat
            size="md"
            @click.stop="toggleReadStatus"
          />
          <q-btn
            icon="open_in_new"
            color="primary"
            flat
            size="md"
            @click.stop="openInBrowser"
          >
            <q-tooltip>在浏览器中打开原文</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>
    </q-card>

    <!-- ── Context menu (right-click) ── -->
    <q-menu
      ref="contextMenuRef"
      touch-position
      transition-show="scale"
      transition-hide="scale"
    >
      <q-list style="min-width: 140px">
        <q-item
          clickable
          v-close-popup
          @click="openContentPage"
        >
          <q-item-section avatar>
            <q-icon name="article"/>
          </q-item-section>
          <q-item-section>打开文章</q-item-section>
        </q-item>
        <q-item
          clickable
          v-close-popup
          @click="toggleReadStatus"
        >
          <q-item-section avatar>
            <q-icon :name="postInfo.read ? 'mark_email_unread' : 'drafts'"/>
          </q-item-section>
          <q-item-section>
            {{ postInfo.read ? '标为未读' : '标为已读' }}
          </q-item-section>
        </q-item>
        <q-separator/>
        <q-item
          clickable
          v-close-popup
          @click="openInBrowser"
        >
          <q-item-section avatar>
            <q-icon name="open_in_new"/>
          </q-item-section>
          <q-item-section>在浏览器中打开</q-item-section>
        </q-item>
        <q-separator/>
        <q-item
          clickable
          v-close-popup
          @click="toggleFavorite"
        >
          <q-item-section avatar>
            <q-icon :name="isFavorite ? 'favorite' : 'favorite_border'" :color="isFavorite ? 'red' : ''"/>
          </q-item-section>
          <q-item-section>{{ isFavorite ? '取消收藏' : '收藏文章' }}</q-item-section>
        </q-item>
      </q-list>
    </q-menu>

    <!-- ── Transition overlay for read-toggling animation ── -->
    <transition name="read-toggle">
      <div v-if="animating" class="read-toggle-overlay"/>
    </transition>
  </q-item>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { switchPage, extractTextFromHtml } from 'src/common/util'
import { PostIndexItem } from 'src/common/models'
import { useQuasar } from 'quasar'

const props = defineProps<{
  rssId: string
  postInfo: PostIndexItem
}>()

const emit = defineEmits<{
  (e: 'read-toggled', guid: string): void
}>()

const $q = useQuasar()
const contextMenuRef = ref<{ show: (evt: MouseEvent) => void } | null>(null)
const animating = ref(false)
const isFavorite = ref(false)

// ── Computed classes ──

const postClasses = computed(() => ({
  'post-item--unread': !props.postInfo.read,
  'post-item--read': props.postInfo.read,
  'post-item--dark': $q.dark.isActive,
}))

// ── Event handlers ──

/**
 * Open the content page and mark the article as read.
 */
const handleCardClick = () => {
  // If unread, mark as read first
  if (!props.postInfo.read) {
    markAsRead()
  }
  openContentPage()
}

/**
 * Open the context menu on right-click.
 */
const openContextMenu = (evt: MouseEvent) => {
  contextMenuRef.value?.show(evt)
}

/**
 * Mark the article as read via the backend API, then update local state.
 */
const markAsRead = async () => {
  try {
    await electronClient.toggleReadStatus(props.postInfo.guid)
    props.postInfo.read = true
    animateToggle()
    emit('read-toggled', props.postInfo.guid)
    $q.notify({
      message: '已标记为已读',
      color: 'positive',
      position: 'top',
      timeout: 1000,
    })
  } catch (err) {
    console.error('[PostListItem] markAsRead error:', err)
  }
}

/**
 * Toggle the read/unread status for this article.
 * Uses the domain-layer API (article:toggleReadStatus IPC channel),
 * which toggles the status server-side and updates unread counts.
 */
const toggleReadStatus = async () => {
  const currentState = props.postInfo.read
  try {
    await electronClient.toggleReadStatus(props.postInfo.guid)
    // The backend toggles server-side; mirror locally
    props.postInfo.read = !currentState
    animateToggle()
    emit('read-toggled', props.postInfo.guid)
    $q.notify({
      message: props.postInfo.read
        ? '已标记为已读'
        : '已标记为未读',
      color: 'positive',
      position: 'top',
      timeout: 1000,
    })
  } catch (err) {
    console.error('[PostListItem] toggleReadStatus error:', err)
    $q.notify({
      message: '操作失败，请重试',
      color: 'negative',
      position: 'top',
    })
  }
}

/**
 * Toggle the favorite status for this article.
 */
const toggleFavorite = async () => {
  try {
    const result = await electronClient.toggleFavorite(props.postInfo.guid)
    isFavorite.value = result
    $q.notify({
      message: result ? '已收藏' : '已取消收藏',
      color: 'positive',
      position: 'top',
      timeout: 1000,
    })
  } catch (err) {
    console.error('[PostListItem] toggleFavorite error:', err)
    $q.notify({
      message: '收藏操作失败',
      color: 'negative',
      position: 'top',
    })
  }
}

/**
 * Open the article URL in the default system browser.
 */
const openInBrowser = () => {
  if (props.postInfo.link) {
    electronClient.openLink(props.postInfo.link)
  }
}

/**
 * Navigate to the Content page with the current article ID.
 */
const openContentPage = () => {
  const postId = props.postInfo.guid || props.postInfo.link
  if (!postId) {
    $q.notify({
      type: 'negative',
      message: '无法获取文章标识',
      position: 'top',
    })
    return
  }
  switchPage('Content', {
    RssId: props.rssId,
    PostId: postId,
  })
}

/**
 * Brief CSS-driven animation on read status toggle.
 */
const animateToggle = () => {
  animating.value = true
  setTimeout(() => {
    animating.value = false
  }, 400)
}
</script>

<style scoped lang="scss">
// ── Layout ──

.post-item {
  width: 100%;
  padding: 6px 0;
  outline: none;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:focus-visible {
    .post-card {
      outline: 2px solid var(--q-primary, #1976d2);
      outline-offset: 2px;
    }
  }
}

.post-card {
  width: 100%;
  transition:
    transform 0.2s ease,
    box-shadow 0.25s ease,
    opacity 0.3s ease,
    border-color 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  }

  // ── Read vs unread styling ──
  &.is-read {
    opacity: 0.65;

    .post-title {
      font-weight: 400;
    }

    .post-desc {
      opacity: 0.7;
    }

    &:hover {
      opacity: 0.8;
    }
  }

  &:not(.is-read) {
    .post-title {
      font-weight: 700;
    }

    .post-desc {
      font-weight: 500;
    }
  }
}

// ── Title row with unread dot ──

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.unread-dot {
  color: var(--q-primary, #1976d2);
  flex-shrink: 0;
  animation: pulse-dot 2s ease-in-out 3;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.post-title {
  line-height: 1.4;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  transition:
    font-weight 0.2s ease,
    opacity 0.3s ease;

  &.is-unread {
    font-weight: 700;
  }
}

.post-author {
  color: var(--q-secondary);
  font-size: 0.85rem;
}

.post-time {
  white-space: nowrap;
  flex-shrink: 0;
}

.post-desc {
  line-height: 1.6;
  transition:
    font-weight 0.2s ease,
    opacity 0.3s ease;

  &.is-read {
    font-weight: 400;
    color: var(--q-grey-6);
  }
}

// ── Action buttons ──

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;

  .q-btn {
    flex-shrink: 0;
  }
}

// ── Read-toggle animation overlay ──

.read-toggle-overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: transparent;
}

.read-toggle-enter-active {
  animation: read-flash 0.4s ease;
}

@keyframes read-flash {
  0% {
    background: rgba(var(--q-primary-rgb, 25, 118, 210), 0.12);
    transform: scale(1);
  }
  100% {
    background: transparent;
    transform: scale(1);
  }
}

// ── Dark mode overrides ──

.post-item--dark {
  .post-card {
    &.is-read {
      opacity: 0.5;

      &:hover {
        opacity: 0.7;
      }
    }

    &:not(.is-read) {
      border-color: rgba(255, 255, 255, 0.12);
    }
  }

  .unread-dot {
    color: #6ba3ff;
  }

  .post-desc {
    &.is-read {
      color: var(--q-grey-5);
    }
  }
}

// ── Responsive ──

@media (max-width: 600px) {
  .post-item {
    padding: 4px 0;
  }

  .action-buttons {
    flex-direction: column;
    align-items: stretch;

    .q-btn {
      width: 100%;
    }
  }

  .post-title {
    font-size: 1rem;
  }
}
</style>
