<template>
  <article
    class="ink-post"
    :class="postClasses"
    :tabindex="0"
    role="article"
    :aria-label="`${postInfo.read ? 'Read' : 'Unread'}: ${postInfo.title}`"
    @click="handleCardClick"
    @contextmenu.prevent="openContextMenu"
    @keydown.enter="handleCardClick"
    @keydown.space.prevent="handleCardClick"
  >
    <div class="ink-post__layout">
      <div class="ink-post__indicator">
        <div v-if="!postInfo.read" class="ink-post__dot"></div>
      </div>
      <div class="ink-post__content">
        <div class="ink-post__header">
          <h3 class="ink-post__title">{{ postInfo.title }}</h3>
          <span class="ink-post__time">{{ postInfo.updateTime }}</span>
        </div>
        <p class="ink-post__author" v-if="postInfo.author">{{ postInfo.author }}</p>
        <p v-if="postInfo.desc" class="ink-post__excerpt">
          {{ extractTextFromHtml(postInfo.desc) }}
        </p>
      </div>
    </div>

    <q-menu ref="contextMenuRef" touch-position transition-show="scale" transition-hide="scale">
      <q-list dense style="min-width: 160px">
        <q-item clickable v-close-popup @click="openContentPage">
          <q-item-section avatar><q-icon name="article" size="18px" /></q-item-section>
          <q-item-section>Open article</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="toggleReadStatus">
          <q-item-section avatar>
            <q-icon :name="postInfo.read ? 'mark_email_unread' : 'drafts'" size="18px" />
          </q-item-section>
          <q-item-section>{{ postInfo.read ? 'Mark unread' : 'Mark read' }}</q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable v-close-popup @click="openInBrowser">
          <q-item-section avatar><q-icon name="open_in_new" size="18px" /></q-item-section>
          <q-item-section>Open original</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="toggleFavorite">
          <q-item-section avatar>
            <q-icon :name="isFavorite ? 'star' : 'star_border'" :color="isFavorite ? 'amber' : undefined" size="18px" />
          </q-item-section>
          <q-item-section>{{ isFavorite ? 'Unfavorite' : 'Favorite' }}</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { electronClient } from 'src/services/electronClient';
import { useRouter } from 'vue-router';
import { extractTextFromHtml } from 'src/common/util';
import { PostIndexItem } from 'src/common/models';
import { useQuasar } from 'quasar';

const props = defineProps<{
  rssId: string;
  postInfo: PostIndexItem;
}>();

const emit = defineEmits<{
  (e: 'read-toggled', guid: string): void;
}>();

const $q = useQuasar();
const router = useRouter();
const contextMenuRef = ref<{ show: (evt: MouseEvent) => void } | null>(null);
const isFavorite = ref(false);

const postClasses = computed(() => ({
  'ink-post--unread': !props.postInfo.read,
  'ink-post--read': props.postInfo.read,
}));

const handleCardClick = () => {
  if (!props.postInfo.read) {
    props.postInfo.read = true;
    emit('read-toggled', props.postInfo.guid);
  }
  openContentPage();
};

const openContextMenu = (evt: MouseEvent) => {
  contextMenuRef.value?.show(evt);
};

const toggleReadStatus = async () => {
  const next = !props.postInfo.read;
  try {
    await electronClient.setReadStatus(props.postInfo.guid, next);
    props.postInfo.read = next;
    emit('read-toggled', props.postInfo.guid);
    $q.notify({
      message: props.postInfo.read ? 'Marked read' : 'Marked unread',
      color: 'positive',
      position: 'top',
      timeout: 1000,
    });
  } catch (err) {
    console.error('[PostListItem] setReadStatus error:', err);
    $q.notify({ message: 'Action failed', color: 'negative', position: 'top' });
  }
};

const toggleFavorite = async () => {
  try {
    const result = await electronClient.toggleFavorite(props.postInfo.guid);
    isFavorite.value = result;
    $q.notify({
      message: result ? 'Favorited' : 'Removed from favorites',
      color: 'positive',
      position: 'top',
      timeout: 1000,
    });
  } catch (err) {
    console.error('[PostListItem] toggleFavorite error:', err);
    $q.notify({ message: 'Favorite failed', color: 'negative', position: 'top' });
  }
};

const openInBrowser = async () => {
  if (props.postInfo.link) {
    electronClient.openLink(props.postInfo.link);
    if (!props.postInfo.read) {
      try {
        await electronClient.setReadStatus(props.postInfo.guid, true);
        props.postInfo.read = true;
        emit('read-toggled', props.postInfo.guid);
      } catch (err) {
        console.error('[PostListItem] setReadStatus error:', err);
      }
    }
  }
};

const openContentPage = () => {
  const postId = props.postInfo.guid || props.postInfo.link;
  if (!postId) {
    $q.notify({ type: 'negative', message: 'Missing article id', position: 'top' });
    return;
  }
  void router.push({
    name: 'Content',
    query: { rssId: props.rssId, postId },
  });
};
</script>

<style scoped lang="scss">
.ink-post {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ink-border);
  cursor: pointer;
  outline: none;
  background: transparent;
  
  /* Selection handles */
  .ink-postlist__item--selected & {
    background: var(--ink-tertiary);
    border-bottom-color: var(--ink-tertiary);
    
    .ink-post__title, .ink-post__time, .ink-post__author, .ink-post__excerpt {
      color: var(--ink-on-tertiary);
    }
    
    .ink-post__dot {
      background: var(--ink-on-tertiary);
    }
  }
}

.ink-post__layout {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.ink-post__indicator {
  width: 12px;
  display: flex;
  justify-content: center;
  padding-top: 6px;
  flex-shrink: 0;
}

.ink-post__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-tertiary);
}

.ink-post__content {
  flex: 1;
  min-width: 0;
}

.ink-post__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2px;
}

.ink-post__title {
  font-family: var(--ink-font-sans);
  font-size: 13px;
  line-height: 1.3;
  margin: 0;
  color: var(--ink-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  padding-right: 8px;
}

.ink-post--read .ink-post__title {
  font-weight: 400;
  color: var(--ink-secondary);
}

.ink-post--unread .ink-post__title {
  font-weight: 600;
  color: var(--ink-primary);
}

.ink-post__time {
  font-size: 11px;
  color: var(--ink-muted);
  flex-shrink: 0;
  white-space: nowrap;
}

.ink-post__author {
  font-size: 12px;
  color: var(--ink-muted);
  margin: 0 0 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ink-post__excerpt {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--ink-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
